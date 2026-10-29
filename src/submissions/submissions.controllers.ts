import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UploadedFiles,
  UseFilters,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { GlobalRole } from '@prisma/client';
import { memoryStorage } from 'multer';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { ApiExceptionFilter } from '../common/api-errors.js';
import { PrivateCacheInterceptor } from '../common/private-cache.interceptor.js';
import { UploadRateLimitGuard } from '../common/uploads.js';
import { SUBMISSION_LIMITS, SUBMISSION_REVIEWER_ROLES } from '../types/submissions.contract.js';
import { SubmissionsService } from './submissions.service.js';
import { AdminSubmissionListQueryDto, GradeSubmissionDto, SubmitAssignmentDto } from './dto/submission.dto.js';

/**
 * Student submissions (api-contract-mobile.md, "Assignment submissions").
 * `/assignments/...` without `v1` is kept for app versions already installed.
 */
@Controller(['v1/assignments', 'assignments'])
@UseGuards(JwtAuthGuard)
@UseFilters(ApiExceptionFilter)
@UseInterceptors(PrivateCacheInterceptor)
export class SubmissionsController {
  constructor(private readonly submissions: SubmissionsService) {}

  /** JSON, or multipart/form-data with `text`, `links` and up to 5 `files`. */
  @Post(':assignmentId/submit')
  @UseGuards(UploadRateLimitGuard)
  @UseInterceptors(
    FilesInterceptor('files', SUBMISSION_LIMITS.maxFiles, {
      storage: memoryStorage(),
      limits: { fileSize: SUBMISSION_LIMITS.maxFileBytes, files: SUBMISSION_LIMITS.maxFiles },
      defParamCharset: 'utf8', // keeps Arabic file names intact
    } as Parameters<typeof FilesInterceptor>[2]),
  )
  submit(
    @Req() req: any,
    @Param('assignmentId') assignmentId: string,
    @Body() dto: SubmitAssignmentDto,
    @UploadedFiles() files?: Express.Multer.File[],
  ) {
    return this.submissions.submit(req.user, assignmentId, dto, files ?? []);
  }

  @Get(':assignmentId/my-submission')
  mine(@Req() req: any, @Param('assignmentId') assignmentId: string) {
    return this.submissions.mine(req.user, assignmentId);
  }
}

const REVIEWERS = SUBMISSION_REVIEWER_ROLES as readonly GlobalRole[];

/** Reviewing and grading (api-contract-admin.md, "Assignment submissions"). */
@Controller('v1/admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...REVIEWERS)
@UseFilters(ApiExceptionFilter)
@UseInterceptors(PrivateCacheInterceptor)
export class AdminSubmissionsController {
  constructor(private readonly submissions: SubmissionsService) {}

  @Get('assignments/:assignmentId/submissions')
  list(@Param('assignmentId') assignmentId: string, @Query() query: AdminSubmissionListQueryDto) {
    return this.submissions.list(assignmentId, query);
  }

  @Get('submissions/:submissionId')
  detail(@Param('submissionId') submissionId: string) {
    return this.submissions.detail(submissionId);
  }

  @Patch('submissions/:submissionId/grade')
  grade(@Req() req: any, @Param('submissionId') submissionId: string, @Body() dto: GradeSubmissionDto) {
    return this.submissions.grade(req.user, submissionId, dto);
  }
}
