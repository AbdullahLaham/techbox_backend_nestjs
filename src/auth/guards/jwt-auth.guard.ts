import { Injectable, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext) {
    // Calls Passport's JwtStrategy validate() method
    return super.canActivate(context);
  }

  handleRequest(err: any, user: any, info: any) {
    // Handle invalid token or missing authorization header
    if (err || !user) {
      throw err || new UnauthorizedException('يرجى تسجيل الدخول للوصول إلى هذا المورد');
    }
    return user;
  }
}