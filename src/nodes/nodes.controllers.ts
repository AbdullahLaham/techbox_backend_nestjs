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
import { ApiExceptionFilter } from '../common/api-errors.js';
import { PrivateCacheInterceptor } from '../common/private-cache.interceptor.js';
import { UploadRateLimitGuard } from '../common/uploads.js';
import { CONTENT_MANAGER_ROLES, CONTENT_OWNER_ROLES } from '../types/api.contract.js';
import { NODE_FILE_LIMITS } from '../types/nodes.contract.js';
import { NodesService } from './nodes.service.js';
import { CreateNodeDto, ListNodesQuery, UpdateLessonProgressDto, UpdateNodeDto } from './dto/node.dto.js';

/** Dashboard lesson management (api-contract-admin.md, "Nodes"). */
@Controller('v1/admin/nodes')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...(CONTENT_MANAGER_ROLES as readonly GlobalRole[]))
@UseFilters(ApiExceptionFilter)
@UseInterceptors(PrivateCacheInterceptor)
export class AdminNodesController {
  constructor(private readonly nodes: NodesService) {}

  @Get()
  list(@Query() query: ListNodesQuery) {
    return this.nodes.list(query.moduleId);
  }

  @Get(':nodeId')
  detail(@Param('nodeId') nodeId: string) {
    return this.nodes.detail(nodeId);
  }

  @Post()
  create(@Req() req: any, @Body() dto: CreateNodeDto) {
    return this.nodes.create(req.user, dto);
  }

  @Patch(':nodeId')
  update(@Req() req: any, @Param('nodeId') nodeId: string, @Body() dto: UpdateNodeDto) {
    return this.nodes.update(req.user, nodeId, dto);
  }

  @Post(':nodeId/file')
  @UseGuards(UploadRateLimitGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: NODE_FILE_LIMITS.maxBytes, files: 1 },
      defParamCharset: 'utf8', // keeps Arabic file names intact
    } as Parameters<typeof FileInterceptor>[1]),
  )
  uploadFile(@Req() req: any, @Param('nodeId') nodeId: string, @UploadedFile() file?: Express.Multer.File) {
    return this.nodes.uploadFile(req.user, nodeId, file);
  }

  @Delete(':nodeId/resource')
  removeResource(@Req() req: any, @Param('nodeId') nodeId: string) {
    return this.nodes.removeResource(req.user, nodeId);
  }

  @Delete(':nodeId')
  @Roles(...(CONTENT_OWNER_ROLES as readonly GlobalRole[]))
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Req() req: any, @Param('nodeId') nodeId: string) {
    return this.nodes.remove(req.user, nodeId);
  }
}

/** Learner lesson content (api-contract-mobile.md, "Lessons"). */
@Controller('v1/nodes')
@UseGuards(JwtAuthGuard)
@UseFilters(ApiExceptionFilter)
@UseInterceptors(PrivateCacheInterceptor)
export class NodesController {
  constructor(private readonly nodes: NodesService) {}

  @Get(':nodeId')
  content(@Req() req: any, @Param('nodeId') nodeId: string) {
    return this.nodes.content(req.user, nodeId);
  }

  /** Video position / completion, reading completion (LessonProgressResult). */
  @Post(':nodeId/progress')
  @HttpCode(HttpStatus.OK)
  recordProgress(@Req() req: any, @Param('nodeId') nodeId: string, @Body() dto: UpdateLessonProgressDto) {
    return this.nodes.recordProgress(req.user, nodeId, dto);
  }
}
