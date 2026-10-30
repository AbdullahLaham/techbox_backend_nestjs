import { Controller, Post, Body, Get, UseGuards, Req, HttpCode, HttpStatus } from '@nestjs/common';
import { AuthService } from './auth.service.js';
import { RegisterDto } from './dto/register.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { RefreshTokenDto } from './dto/refresh-token.dto.js';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';
import type { Request } from 'express';
import { AUTH_RATE_RULES, RateLimit, RateLimitGuard } from '../common/rate-limit.js';

/** Sign-up, sign-in and sessions. Login, register and refresh are rate limited (src/common/rate-limit.ts). */
@Controller('auth')
@UseGuards(RateLimitGuard)
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @RateLimit(...AUTH_RATE_RULES.register)
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  @RateLimit(...AUTH_RATE_RULES.login)
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  // Public: the access token is usually already expired when this is called.
  @Post('refresh')
  @RateLimit(...AUTH_RATE_RULES.refresh)
  @HttpCode(HttpStatus.OK)
  async refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refresh(dto.refreshToken);
  }

  // Public so a client holding an expired access token can still revoke its session.
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Body() dto: RefreshTokenDto) {
    await this.authService.logout(dto.refreshToken);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  getProfile(@Req() req: Request) {
    return req.user
  }
}
