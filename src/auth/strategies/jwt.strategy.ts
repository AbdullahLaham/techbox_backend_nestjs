// import { Injectable, UnauthorizedException } from '@nestjs/common';
// import { PassportStrategy } from '@nestjs/passport';
// import { ExtractJwt, Strategy } from 'passport-jwt';
// import { PrismaService } from '../../prisma/prisma.service.js';

// export interface JwtPayload {
//   sub: string;
//   email: string;
//   globalRole: string;
// }

// @Injectable()
// export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
//   constructor(private prisma: PrismaService) {
//     super({
//       jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
//       ignoreExpiration: false,
//       secretOrKey: process.env.JWT_ACCESS_SECRET || 'super-secret-key',
//     });
//   }

//   async validate(payload: JwtPayload) {
//     const user = await this.prisma.user.findUnique({
//       where: { id: payload.sub },
//       select: { id: true, email: true, globalRole: true, status: true },
//     });

//     if (!user || user.status !== 'ACTIVE') {
//       throw new UnauthorizedException('الحساب غير نشط أو غير موجود');
//     }

//     return user; // Attached to Request context as req.user
//   }
// }




// import { Injectable, UnauthorizedException } from '@nestjs/common';
// import { ConfigService } from '@nestjs/config';
// import { PassportStrategy } from '@nestjs/passport';
// import { ExtractJwt, Strategy } from 'passport-jwt';
// import { PrismaService } from '../../prisma/prisma.service.js';

// export interface JwtPayload {
//   sub: string;
//   email: string;
//   globalRole: string;
// }

// @Injectable()
// export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
//   constructor(
//     private prisma: PrismaService,
//     private configService: ConfigService,
//   ) {
//     super({
//       jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
//       ignoreExpiration: false,
//       secretOrKey: configService.get<string>('JWT_ACCESS_SECRET')!,
//     });
//   }

//   async validate(payload: JwtPayload) {
//     console.log('🔍 [JwtStrategy] Payload received:', payload);

//     const user = await this.prisma.user.findUnique({
//       where: { id: payload.sub },
//       select: {
//         id: true,
//         email: true,
//         globalRole: true,
//         status: true,
//         profile: {
//           select: {
//             firstName: true,
//             lastName: true,
//           },
//         },
//       },
//     });

//     if (!user) {
//       console.log('❌ [JwtStrategy] User not found');
//       throw new UnauthorizedException('المستخدم غير موجود');
//     }

//     // إذا كانت حالة الحساب في القاعدة ليست ACTIVE (مثلاً PENDING)
//     if (user.status && user.status !== 'ACTIVE') {
//       console.log(`❌ [JwtStrategy] Account status is: ${user.status}`);
//       throw new UnauthorizedException('الحساب غير نشط');
//     }

//     return {
//       id: user.id,
//       email: user.email,
//       globalRole: user.globalRole,
//       firstName: user.profile?.firstName,
//       lastName: user.profile?.lastName,
//     };
//   }
// }


import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UserStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';

export interface JwtPayload {
  sub: string;
  email: string;
  globalRole: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {
    // نحدد المفتاح بشكل واضح مع توفير نفس القيمة الاحتياطية الموحدة
    const secret =
      configService.get<string>('JWT_ACCESS_SECRET') ||
      'your-super-secret-access-key-techbox';

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  async validate(payload: JwtPayload) {
    if (!payload || !payload.sub) {
      throw new UnauthorizedException('التوكن غير صالح');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        globalRole: true,
        status: true,
        profile: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException('المستخدم غير موجود');
    }

    // الحسابات الموقوفة أو المؤرشفة ترفض في كل المسارات (ASSIGNMENTS_SPEC.md 4.5)
    if (user.status === UserStatus.SUSPENDED || user.status === UserStatus.ARCHIVED) {
      throw new UnauthorizedException('الحساب غير نشط');
    }

    return {
      id: user.id,
      email: user.email,
      globalRole: user.globalRole,
      firstName: user.profile?.firstName,
      lastName: user.profile?.lastName,
    };
  }
}