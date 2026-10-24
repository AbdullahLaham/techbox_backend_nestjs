import { Module } from '@nestjs/common';
import { EnrollmentsService } from './enrollments.service.js';
import { EnrollmentsController } from './enrollments.controller.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { AuthModule } from '../auth/auth.module.js'; // <--- استيراد موديول المصادقة

@Module({
  imports: [
    PrismaModule,
    AuthModule, // <--- أضفه هنا لكي يتعرف NestJS على الـ JwtAuthGuard
  ],
  controllers: [EnrollmentsController],
  providers: [EnrollmentsService],
  exports: [EnrollmentsService],
})
export class EnrollmentsModule {}