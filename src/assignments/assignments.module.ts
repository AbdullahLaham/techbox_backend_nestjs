import { Module } from '@nestjs/common';
import { AssignmentsController } from './assignments.controller.js';
import { AssignmentsService } from './assignments.service.js';
import { AdminAssignmentsController } from './admin-assignments.controller.js';
import { AdminAssignmentsService } from './admin-assignments.service.js';
import { UploadRateLimitGuard } from './attachment-file.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { StorageModule } from '../storage/storage.module.js';

@Module({
  imports: [PrismaModule, AuthModule, StorageModule],
  controllers: [AdminAssignmentsController, AssignmentsController],
  providers: [AssignmentsService, AdminAssignmentsService, UploadRateLimitGuard],
})
export class AssignmentsModule {}
