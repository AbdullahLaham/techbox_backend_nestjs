import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseFilters,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { GlobalRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { ApiExceptionFilter } from '../common/api-errors.js';
import { PrivateCacheInterceptor } from '../common/private-cache.interceptor.js';
import { CONTENT_MANAGER_ROLES } from '../types/api.contract.js';
import { AdminQuizzesService } from './admin-quizzes.service.js';
import { QuizzesService } from './quizzes.service.js';
import {
  AdminQuizAttemptListQueryDto,
  CreateQuizQuestionDto,
  SubmitQuizDto,
  UpdateQuizDto,
  UpdateQuizQuestionDto,
} from './dto/quiz.dto.js';

/**
 * Dashboard quiz editing and attempt review (api-contract-admin.md, "Quizzes").
 * Two-segment paths (questions/:id, attempts/:id) never clash with `:quizId`.
 */
@Controller('v1/admin/quizzes')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...(CONTENT_MANAGER_ROLES as readonly GlobalRole[]))
@UseFilters(ApiExceptionFilter)
@UseInterceptors(PrivateCacheInterceptor)
export class AdminQuizzesController {
  constructor(private readonly quizzes: AdminQuizzesService) {}

  @Get('attempts/:attemptId')
  attempt(@Param('attemptId') attemptId: string) {
    return this.quizzes.attempt(attemptId);
  }

  @Get(':quizId')
  get(@Param('quizId') quizId: string) {
    return this.quizzes.get(quizId);
  }

  @Patch(':quizId')
  update(@Req() req: any, @Param('quizId') quizId: string, @Body() dto: UpdateQuizDto) {
    return this.quizzes.update(req.user, quizId, dto);
  }

  @Post(':quizId/questions')
  addQuestion(@Req() req: any, @Param('quizId') quizId: string, @Body() dto: CreateQuizQuestionDto) {
    return this.quizzes.addQuestion(req.user, quizId, dto);
  }

  @Patch('questions/:questionId')
  updateQuestion(@Req() req: any, @Param('questionId') questionId: string, @Body() dto: UpdateQuizQuestionDto) {
    return this.quizzes.updateQuestion(req.user, questionId, dto);
  }

  @Delete('questions/:questionId')
  removeQuestion(@Req() req: any, @Param('questionId') questionId: string) {
    return this.quizzes.removeQuestion(req.user, questionId);
  }

  @Get(':quizId/attempts')
  attempts(@Param('quizId') quizId: string, @Query() query: AdminQuizAttemptListQueryDto) {
    return this.quizzes.attempts(quizId, query);
  }
}

/** Learner quiz API (api-contract-mobile.md, "Quizzes"). */
@Controller('v1/quizzes')
@UseGuards(JwtAuthGuard)
@UseFilters(ApiExceptionFilter)
@UseInterceptors(PrivateCacheInterceptor)
export class QuizzesController {
  constructor(private readonly quizzes: QuizzesService) {}

  @Get('attempts/:attemptId')
  attempt(@Req() req: any, @Param('attemptId') attemptId: string) {
    return this.quizzes.attemptResult(req.user, attemptId);
  }

  @Get(':quizId')
  get(@Req() req: any, @Param('quizId') quizId: string) {
    return this.quizzes.getQuiz(req.user, quizId);
  }

  @Post(':quizId/attempts')
  submit(@Req() req: any, @Param('quizId') quizId: string, @Body() dto: SubmitQuizDto) {
    return this.quizzes.submit(req.user, quizId, dto);
  }

  @Get(':quizId/attempts')
  myAttempts(@Req() req: any, @Param('quizId') quizId: string) {
    return this.quizzes.myAttempts(req.user, quizId);
  }
}
