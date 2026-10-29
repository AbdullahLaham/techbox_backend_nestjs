import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { StorageModule } from '../storage/storage.module.js';
import { UploadRateLimitGuard } from '../common/uploads.js';
import { NodesService } from './nodes.service.js';
import { NodeAccessService } from './node-access.service.js';
import { AdminNodesController, NodesController } from './nodes.controllers.js';

/** Lessons of type QUIZ, VIDEO_LECTURE and READING_MATERIAL. Quiz content lives in QuizzesModule. */
@Module({
  imports: [PrismaModule, AuthModule, StorageModule],
  controllers: [AdminNodesController, NodesController],
  providers: [NodesService, NodeAccessService, UploadRateLimitGuard],
  exports: [NodeAccessService],
})
export class NodesModule {}
