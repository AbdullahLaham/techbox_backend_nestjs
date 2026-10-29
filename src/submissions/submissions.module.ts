import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { StorageModule } from '../storage/storage.module.js';
import { UploadRateLimitGuard } from '../common/uploads.js';
import { SubmissionsService } from './submissions.service.js';
import { AdminSubmissionsController, SubmissionsController } from './submissions.controllers.js';

/** Assignment submissions (student hand-in) and grading (reviewers). */
@Module({
  imports: [PrismaModule, AuthModule, StorageModule],
  controllers: [AdminSubmissionsController, SubmissionsController],
  providers: [SubmissionsService, UploadRateLimitGuard],
})
export class SubmissionsModule {}
