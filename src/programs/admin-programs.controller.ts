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
import { CONTENT_MANAGER_ROLES, CONTENT_OWNER_ROLES } from '../types/api.contract.js';
import { AdminProgramsService } from './admin-programs.service.js';
import { AdminProgramListQuery } from './dto/admin-program-list.query.js';
import { CreateProgramDto } from './dto/create-program.dto.js';
import { UpdateProgramDto } from './dto/update-program.dto.js';
import { CreateTrackDto } from './dto/create-track.dto.js';
import { UpdateTrackDto } from './dto/update-track.dto.js';
import { CreateModuleDto } from './dto/create-module.dto.js';
import { UpdateModuleDto } from './dto/update-module.dto.js';
import { CreateNodeDto } from './dto/create-node.dto.js';
import { UpdateNodeDto } from './dto/update-node.dto.js';

const MANAGERS = CONTENT_MANAGER_ROLES as readonly GlobalRole[];
const OWNERS = CONTENT_OWNER_ROLES as readonly GlobalRole[];

/**
 * Dashboard program and curriculum management (api.contract.ts, "Programs (admin)").
 * Content managers create and edit; only owners delete. Paths with two segments
 * (tracks/:id, modules/:id, nodes/:id) never clash with `:id`.
 */
@Controller('v1/admin/programs')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...MANAGERS)
@UseFilters(ApiExceptionFilter)
@UseInterceptors(PrivateCacheInterceptor)
export class AdminProgramsController {
  constructor(private readonly programs: AdminProgramsService) {}

  /* ------------------------------- Programs ------------------------------- */

  @Get()
  list(@Query() query: AdminProgramListQuery) {
    return this.programs.list(query);
  }

  @Get(':idOrSlug')
  detail(@Param('idOrSlug') idOrSlug: string) {
    return this.programs.detail(idOrSlug);
  }

  @Post()
  create(@Req() req: any, @Body() dto: CreateProgramDto) {
    return this.programs.create(req.user, dto);
  }

  @Patch(':id')
  update(@Req() req: any, @Param('id') id: string, @Body() dto: UpdateProgramDto) {
    return this.programs.update(req.user, id, dto);
  }

  @Delete(':id')
  @Roles(...OWNERS)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Req() req: any, @Param('id') id: string) {
    return this.programs.remove(req.user, id);
  }

  /* -------------------------------- Tracks -------------------------------- */

  @Post(':programId/tracks')
  createTrack(@Req() req: any, @Param('programId') programId: string, @Body() dto: CreateTrackDto) {
    return this.programs.createTrack(req.user, programId, dto);
  }

  @Patch('tracks/:trackId')
  updateTrack(@Req() req: any, @Param('trackId') trackId: string, @Body() dto: UpdateTrackDto) {
    return this.programs.updateTrack(req.user, trackId, dto);
  }

  @Delete('tracks/:trackId')
  @Roles(...OWNERS)
  @HttpCode(HttpStatus.NO_CONTENT)
  removeTrack(@Req() req: any, @Param('trackId') trackId: string) {
    return this.programs.removeTrack(req.user, trackId);
  }

  /* ------------------------------- Modules -------------------------------- */

  @Post('tracks/:trackId/modules')
  createModule(@Req() req: any, @Param('trackId') trackId: string, @Body() dto: CreateModuleDto) {
    return this.programs.createModule(req.user, trackId, dto);
  }

  @Patch('modules/:moduleId')
  updateModule(@Req() req: any, @Param('moduleId') moduleId: string, @Body() dto: UpdateModuleDto) {
    return this.programs.updateModule(req.user, moduleId, dto);
  }

  @Delete('modules/:moduleId')
  @Roles(...OWNERS)
  @HttpCode(HttpStatus.NO_CONTENT)
  removeModule(@Req() req: any, @Param('moduleId') moduleId: string) {
    return this.programs.removeModule(req.user, moduleId);
  }

  /* -------------------------------- Lessons ------------------------------- */

  @Post('modules/:moduleId/nodes')
  createNode(@Req() req: any, @Param('moduleId') moduleId: string, @Body() dto: CreateNodeDto) {
    return this.programs.createNode(req.user, moduleId, dto);
  }

  @Patch('nodes/:nodeId')
  updateNode(@Req() req: any, @Param('nodeId') nodeId: string, @Body() dto: UpdateNodeDto) {
    return this.programs.updateNode(req.user, nodeId, dto);
  }

  @Delete('nodes/:nodeId')
  @Roles(...OWNERS)
  @HttpCode(HttpStatus.NO_CONTENT)
  removeNode(@Req() req: any, @Param('nodeId') nodeId: string) {
    return this.programs.removeNode(req.user, nodeId);
  }
}
