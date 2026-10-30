import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request, Response } from 'express';

/**
 * One limit: at most `limit` requests per `windowMs`, counted per client IP, or per the
 * value of a body field (e.g. the email of a login), normalised to lowercase.
 */
export type RateRule = { name: string; limit: number; windowMs: number; by: 'ip' | { body: string } };

const RATE_RULES = 'rateRules';

/** Applies the rules to a route; use with RateLimitGuard. All rules must pass. */
export const RateLimit = (...rules: RateRule[]) => SetMetadata(RATE_RULES, rules);

/**
 * In-memory sliding-window rate limiter for sensitive routes (login, register, refresh).
 * Per process: with several instances behind a load balancer the effective limit is
 * multiplied; move the counters to Redis when the API scales out. Behind a reverse proxy,
 * set TRUST_PROXY so `req.ip` is the client's address.
 */
@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly hits = new Map<string, number[]>();
  private checks = 0;

  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const rules = this.reflector.get<RateRule[] | undefined>(RATE_RULES, context.getHandler()) ?? [];
    if (rules.length === 0) return true;

    const req = context.switchToHttp().getRequest<Request>();
    const now = Date.now();
    const keys: Array<{ key: string; rule: RateRule }> = [];
    for (const rule of rules) {
      const subject = rule.by === 'ip' ? req.ip : String(req.body?.[rule.by.body] ?? '').trim().toLowerCase();
      if (subject) keys.push({ key: `${rule.name}:${subject}`, rule });
    }

    // Refuse when any rule is exhausted; count the request against every rule otherwise.
    for (const { key, rule } of keys) {
      const recent = (this.hits.get(key) ?? []).filter((t) => now - t < rule.windowMs);
      this.hits.set(key, recent);
      if (recent.length >= rule.limit) {
        const retryAfterSec = Math.max(1, Math.ceil((recent[0] + rule.windowMs - now) / 1000));
        context.switchToHttp().getResponse<Response>().setHeader('Retry-After', String(retryAfterSec));
        throw new HttpException(
          {
            statusCode: HttpStatus.TOO_MANY_REQUESTS,
            code: 'TOO_MANY_REQUESTS',
            message: 'محاولات كثيرة، يرجى المحاولة لاحقاً',
            retryAfterSec,
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    }
    for (const { key } of keys) this.hits.get(key)!.push(now);

    if (++this.checks % 1000 === 0) this.prune(now, Math.max(...rules.map((r) => r.windowMs)));
    return true;
  }

  /** Drops keys with no recent hits so the map does not grow forever. */
  private prune(now: number, windowMs: number) {
    for (const [key, times] of this.hits) {
      if (times.every((t) => now - t >= windowMs)) this.hits.delete(key);
    }
  }
}

const MIN = 60_000;

/** Limits used by the auth routes. */
export const AUTH_RATE_RULES = {
  login: [
    { name: 'login-email', limit: 10, windowMs: 15 * MIN, by: { body: 'email' } },
    { name: 'login-ip', limit: 30, windowMs: 15 * MIN, by: 'ip' },
  ],
  register: [{ name: 'register-ip', limit: 10, windowMs: 60 * MIN, by: 'ip' }],
  refresh: [{ name: 'refresh-ip', limit: 60, windowMs: 15 * MIN, by: 'ip' }],
} satisfies Record<string, RateRule[]>;
