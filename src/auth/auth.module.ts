// import { Module } from '@nestjs/common';
// import { AuthService } from './auth.service.js';
// import { AuthController } from './auth.controller.js';
// import { JwtModule } from '@nestjs/jwt';
// import { PassportModule } from '@nestjs/passport';
// import { JwtStrategy } from './strategies/jwt.strategy.js';
// import { PrismaModule } from '../prisma/prisma.module.js';

// @Module({
//   imports: [
//     PrismaModule,
//     PassportModule.register({ defaultStrategy: 'jwt' }),
//     JwtModule.register({
//       secret: process.env.JWT_ACCESS_SECRET || 'super-secret-key',
//       signOptions: { expiresIn: '15m' },
//     }),
//   ],
//   controllers: [AuthController],
//   providers: [AuthService, JwtStrategy],
//   exports: [AuthService, JwtStrategy, PassportModule],
// })
// export class AuthModule {}





// import { Module } from '@nestjs/common';
// import { ConfigModule, ConfigService } from '@nestjs/config';
// import { JwtModule } from '@nestjs/jwt';
// import { PassportModule } from '@nestjs/passport';
// import { AuthService } from './auth.service.js';
// import { AuthController } from './auth.controller.js';
// import { JwtStrategy } from './strategies/jwt.strategy.js';
// import { PrismaModule } from '../prisma/prisma.module.js';

// @Module({
//   imports: [
//     PrismaModule,
//     ConfigModule,
//     PassportModule.register({ defaultStrategy: 'jwt' }),
//     JwtModule.registerAsync({
//       imports: [ConfigModule],
//       inject: [ConfigService],
//       useFactory: (configService: ConfigService) => ({
//         secret: configService.get<string>('JWT_ACCESS_SECRET') || 'super-secret-key',
//         signOptions: {
//           expiresIn: (configService.get<string>('JWT_ACCESS_EXPIRATION') || '15m') as any, // <--- إزالة الخطأ هنا
//         },
//       }),
//     }),
//   ],
//   controllers: [AuthController],
//   providers: [AuthService, JwtStrategy],
//   exports: [AuthService, JwtStrategy, PassportModule],
// })
// export class AuthModule {}





import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service.js';
import { AuthController } from './auth.controller.js';
import { JwtStrategy } from './strategies/jwt.strategy.js';
import { PrismaModule } from '../prisma/prisma.module.js';

@Module({
  imports: [
    PrismaModule,
    ConfigModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        return {
          // Required at startup (src/config/env.validation.ts); no fallback secret.
          secret: configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
          signOptions: {
            expiresIn: (configService.get<string>('JWT_ACCESS_EXPIRATION') || '15m') as any,
          },
        };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService, JwtStrategy, PassportModule, JwtModule],
})
export class AuthModule {}