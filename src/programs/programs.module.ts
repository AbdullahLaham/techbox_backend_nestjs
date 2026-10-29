import { Module } from '@nestjs/common';
import { ProgramsService } from './programs.service.js';
import { ProgramsController } from './programs.controller.js';
import { AdminProgramsService } from './admin-programs.service.js';
import { AdminProgramsController } from './admin-programs.controller.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { StorageModule } from '../storage/storage.module.js';
import { AssignmentsModule } from '../assignments/assignments.module.js';

@Module({
  imports: [PrismaModule, AuthModule, StorageModule, AssignmentsModule],
  controllers: [AdminProgramsController, ProgramsController],
  providers: [ProgramsService, AdminProgramsService],
  exports: [ProgramsService],
})
export class ProgramsModule {}
