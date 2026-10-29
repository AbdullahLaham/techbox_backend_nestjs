import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UploadedFile,
  UseFilters,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { EnrollmentsService } from './enrollments.service.js';
import { EnrollDto } from './dto/enroll.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { ApiExceptionFilter } from '../common/api-errors.js';
import { PrivateCacheInterceptor } from '../common/private-cache.interceptor.js';
import { UploadRateLimitGuard } from '../common/uploads.js';
import { ENROLLMENT_RECEIPT_LIMITS } from '../types/api.contract.js';

/**
 * Student enrollment API (api.contract.ts, "Enrollments (student)").
 * `/enrollments` is kept for app versions already installed; new clients use `/v1/enrollments`.
 */
@Controller(['v1/enrollments', 'enrollments'])
@UseGuards(JwtAuthGuard)
@UseFilters(ApiExceptionFilter)
@UseInterceptors(PrivateCacheInterceptor)
export class EnrollmentsController {
  constructor(private readonly enrollmentsService: EnrollmentsService) {}

  /** Apply (or apply again after REJECTED / DROPPED) with the personal data and an optional receipt. */
  @Post(':programId')
  @UseGuards(UploadRateLimitGuard)
  @UseInterceptors(
    FileInterceptor('receipt', {
      storage: memoryStorage(),
      limits: { fileSize: ENROLLMENT_RECEIPT_LIMITS.maxBytes, files: 1 },
      // Phones and browsers send UTF-8 file names; Multer's default (latin1) garbles them.
      defParamCharset: 'utf8',
    } as Parameters<typeof FileInterceptor>[1]),
  )
  enroll(
    @Param('programId') programId: string,
    @Req() req: any,
    @Body() dto: EnrollDto,
    @UploadedFile() receipt?: Express.Multer.File,
  ) {
    return this.enrollmentsService.apply(req.user.id, programId, dto, receipt);
  }

  /** The caller's own applications and enrollments, newest first. */
  @Get('my-enrollments')
  myEnrollments(@Req() req: any) {
    return this.enrollmentsService.myEnrollments(req.user.id);
  }
}
