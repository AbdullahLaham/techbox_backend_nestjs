import { ExecutionContext, Injectable } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard.js';

/**
 * Public routes that personalise their response (e.g. program detail with the
 * caller's own enrollment). Without an Authorization header the request passes as
 * anonymous (`req.user` undefined). With one, the token is checked as usual, so an
 * expired token still gets 401 and the client can refresh or log out.
 */
@Injectable()
export class OptionalJwtAuthGuard extends JwtAuthGuard {
  canActivate(context: ExecutionContext) {
    const { headers } = context.switchToHttp().getRequest();
    if (!headers.authorization) return true;
    return super.canActivate(context);
  }
}
