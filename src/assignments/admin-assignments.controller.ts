import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UploadedFile,
  UseFilters,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { GlobalRole } from '@prisma/client';
import { memoryStorage } from 'multer';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { AdminAssignmentsService } from './admin-assignments.service.js';
import { AssignmentExceptionFilter } from './assignment-errors.js';
import { parseCreateBody, parseListQuery, parseStatusBody, parseUpdateBody } from './assignment-validation.js';
import { UploadRateLimitGuard } from './attachment-file.js';
import { PrivateCacheInterceptor } from './private-cache.interceptor.js';
import { ASSIGNMENT_MANAGER_ROLES, ATTACHMENT_LIMITS } from '../types/assignments.admin.contract.js';

/**
 * Dashboard API (ASSIGNMENTS_SPEC.md section 6). Bodies are typed `unknown` so the
 * global ValidationPipe skips them; assignment-validation.ts parses them instead.
 */
@Controller('v1/admin/assignments')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...(ASSIGNMENT_MANAGER_ROLES as readonly GlobalRole[]))
@UseFilters(AssignmentExceptionFilter)
@UseInterceptors(PrivateCacheInterceptor)
export class AdminAssignmentsController {
  constructor(private readonly assignments: AdminAssignmentsService) {}

  // A9 is declared before `:id` so "targets" is not read as an id.
  @Get('targets')
  targets() {
    return this.assignments.targets();
  }

  @Post()
  create(@Req() req: any, @Body() body: unknown) {
    return this.assignments.create(req.user.id, parseCreateBody(body));
  }

  @Get()
  list(@Query() query: Record<string, unknown>) {
    return this.assignments.list(parseListQuery(query));
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.assignments.findOne(id);
  }

  @Patch(':id')
  update(@Req() req: any, @Param('id') id: string, @Body() body: unknown) {
    return this.assignments.update(req.user.id, id, parseUpdateBody(body));
  }

  @Patch(':id/status')
  changeStatus(@Req() req: any, @Param('id') id: string, @Body() body: unknown) {
    return this.assignments.changeStatus(req.user.id, id, parseStatusBody(body));
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Req() req: any, @Param('id') id: string) {
    return this.assignments.remove(req.user.id, id);
  }

  @Post(':id/attachments')
  @UseGuards(UploadRateLimitGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      // The size limit is enforced while receiving (413 as soon as it is exceeded).
      limits: { fileSize: ATTACHMENT_LIMITS.maxBytes, files: 1 },
      // Browsers send UTF-8 file names; Multer's default (latin1) garbles Arabic names.
      defParamCharset: 'utf8',
    } as Parameters<typeof FileInterceptor>[1]),
  )
  addAttachment(@Req() req: any, @Param('id') id: string, @UploadedFile() file?: Express.Multer.File) {
    return this.assignments.addAttachment(req.user.id, id, file);
  }

  @Delete(':id/attachments/:attachmentId')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeAttachment(@Req() req: any, @Param('id') id: string, @Param('attachmentId') attachmentId: string) {
    return this.assignments.removeAttachment(req.user.id, id, attachmentId);
  }
}
