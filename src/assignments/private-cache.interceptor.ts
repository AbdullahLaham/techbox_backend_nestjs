import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import type { Response } from 'express';
import type { Observable } from 'rxjs';

/** `Cache-Control: private, max-age=0` on every admin and student assignment response (spec 12). */
@Injectable()
export class PrivateCacheInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    context.switchToHttp().getResponse<Response>().setHeader('Cache-Control', 'private, max-age=0');
    return next.handle();
  }
}
