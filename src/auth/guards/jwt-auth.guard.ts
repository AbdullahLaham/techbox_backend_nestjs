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


// import { Injectable, UnauthorizedException } from '@nestjs/common';
// import { AuthGuard } from '@nestjs/passport';

// @Injectable()
// export class JwtAuthGuard extends AuthGuard('jwt') {
//   handleRequest(err: any, user: any, info: any) {
//     // 🚨 سيطبع هذا السطر في ترمينال NestJS السبب الحقيقي لرفض التوكن!
//     if (info) {
//       console.log('🚨 [JwtAuthGuard Error Info]:', info.message || info);
//     }
//     if (err) {
//       console.log('🚨 [JwtAuthGuard Exception]:', err);
//     }
//     if (!user) {
//       console.log('🚨 [JwtAuthGuard]: User object is null/undefined!');
//       throw err || new UnauthorizedException('تأكيد الهوية فشل');
//     }
//     return user;
//   }
// }