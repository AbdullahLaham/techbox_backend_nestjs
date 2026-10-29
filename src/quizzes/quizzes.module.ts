import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { NodesModule } from '../nodes/nodes.module.js';
import { AdminQuizzesService } from './admin-quizzes.service.js';
import { QuizzesService } from './quizzes.service.js';
import { AdminQuizzesController, QuizzesController } from './quizzes.controllers.js';

/** Quiz questions, attempts and automatic grading. Quizzes are created with their QUIZ lesson (NodesModule). */
@Module({
  imports: [PrismaModule, AuthModule, NodesModule],
  controllers: [AdminQuizzesController, QuizzesController],
  providers: [AdminQuizzesService, QuizzesService],
})
export class QuizzesModule {}
