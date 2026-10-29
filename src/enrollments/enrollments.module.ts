import { Module } from '@nestjs/common';
import { EnrollmentsService } from './enrollments.service.js';
import { EnrollmentsController } from './enrollments.controller.js';
import { AdminEnrollmentsController } from './admin-enrollments.controller.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { StorageModule } from '../storage/storage.module.js';
import { UploadRateLimitGuard } from '../common/uploads.js';

@Module({
  imports: [PrismaModule, AuthModule, StorageModule],
  controllers: [AdminEnrollmentsController, EnrollmentsController],
  providers: [EnrollmentsService, UploadRateLimitGuard],
  exports: [EnrollmentsService],
})
export class EnrollmentsModule {}
