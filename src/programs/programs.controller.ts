// import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
// import { ProgramsService } from './programs.service.js';
// import { CreateProgramDto } from './dto/create-program.dto.js';
// import { CreateTrackDto } from './dto/create-track.dto.js';
// import { CreateModuleDto } from './dto/create-module.dto.js';
// import { CreateNodeDto } from './dto/create-node.dto.js';
// import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
// import { RolesGuard } from '../auth/guards/roles.guard.js';
// import { Roles } from '../auth/decorators/roles.decorator.js';
// import { GlobalRole } from '@prisma/client';

// @Controller('programs')
// export class ProgramsController {
//   constructor(private readonly programsService: ProgramsService) {}

//   @Get()
//   async findAll() {
//     return this.programsService.findAll();
//   }

//   @Get(':slug')
//   async findOne(@Param('slug') slug: string) {
//     return this.programsService.findOneWithStructure(slug);
//   }

//   @UseGuards(JwtAuthGuard, RolesGuard)
//   @Roles(GlobalRole.SUPER_ADMIN, GlobalRole.INCUBATOR_MANAGER, GlobalRole.INSTRUCTOR)
//   @Post()
//   async createProgram(@Body() dto: CreateProgramDto) {
//     return this.programsService.create(dto);
//   }

//   @UseGuards(JwtAuthGuard, RolesGuard)
//   @Roles(GlobalRole.SUPER_ADMIN, GlobalRole.INCUBATOR_MANAGER, GlobalRole.INSTRUCTOR)
//   @Post(':programId/tracks')
//   async createTrack(
//     @Param('programId') programId: string,
//     @Body() dto: CreateTrackDto,
//   ) {
//     return this.programsService.createTrack(programId, dto);
//   }

//   @UseGuards(JwtAuthGuard, RolesGuard)
//   @Roles(GlobalRole.SUPER_ADMIN, GlobalRole.INCUBATOR_MANAGER, GlobalRole.INSTRUCTOR)
//   @Post('tracks/:trackId/modules')
//   async createModule(
//     @Param('trackId') trackId: string,
//     @Body() dto: CreateModuleDto,
//   ) {
//     return this.programsService.createModule(trackId, dto);
//   }

//   @UseGuards(JwtAuthGuard, RolesGuard)
//   @Roles(GlobalRole.SUPER_ADMIN, GlobalRole.INCUBATOR_MANAGER, GlobalRole.INSTRUCTOR)
//   @Post('modules/:moduleId/nodes')
//   async createNode(
//     @Param('moduleId') moduleId: string,
//     @Body() dto: CreateNodeDto,
//   ) {
//     return this.programsService.createNode(moduleId, dto);
//   }
// }


import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ProgramsService } from './programs.service.js';
import { CreateProgramDto } from './dto/create-program.dto.js';
import { UpdateProgramDto } from './dto/update-program.dto.js';
import { CreateTrackDto } from './dto/create-track.dto.js';
import { UpdateTrackDto } from './dto/update-track.dto.js';
import { CreateModuleDto } from './dto/create-module.dto.js';
import { UpdateModuleDto } from './dto/update-module.dto.js';
import { CreateNodeDto } from './dto/create-node.dto.js';
import { UpdateNodeDto } from './dto/update-node.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { GlobalRole } from '@prisma/client';

@Controller('programs')
export class ProgramsController {
  constructor(private readonly programsService: ProgramsService) {}

  // ==================== PUBLIC ENDPOINTS ====================

  @Get()
  async findAll() {
    return this.programsService.findAll();
  }

  @Get(':slug')
  async findOne(@Param('slug') slug: string) {
    return this.programsService.findOneWithStructure(slug);
  }

  // ==================== PROGRAMS CRUD ====================

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(GlobalRole.SUPER_ADMIN, GlobalRole.INCUBATOR_MANAGER, GlobalRole.INSTRUCTOR)
  @Post()
  async createProgram(@Body() dto: CreateProgramDto) {
    return this.programsService.create(dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(GlobalRole.SUPER_ADMIN, GlobalRole.INCUBATOR_MANAGER, GlobalRole.INSTRUCTOR)
  @Patch(':id')
  async updateProgram(@Param('id') id: string, @Body() dto: UpdateProgramDto) {
    return this.programsService.updateProgram(id, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(GlobalRole.SUPER_ADMIN, GlobalRole.INCUBATOR_MANAGER)
  @Delete(':id')
  async removeProgram(@Param('id') id: string) {
    return this.programsService.removeProgram(id);
  }

  // ==================== TRACKS CRUD ====================

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(GlobalRole.SUPER_ADMIN, GlobalRole.INCUBATOR_MANAGER, GlobalRole.INSTRUCTOR)
  @Post(':programId/tracks')
  async createTrack(@Param('programId') programId: string, @Body() dto: CreateTrackDto) {
    return this.programsService.createTrack(programId, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(GlobalRole.SUPER_ADMIN, GlobalRole.INCUBATOR_MANAGER, GlobalRole.INSTRUCTOR)
  @Patch('tracks/:trackId')
  async updateTrack(@Param('trackId') trackId: string, @Body() dto: UpdateTrackDto) {
    return this.programsService.updateTrack(trackId, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(GlobalRole.SUPER_ADMIN, GlobalRole.INCUBATOR_MANAGER)
  @Delete('tracks/:trackId')
  async removeTrack(@Param('trackId') trackId: string) {
    return this.programsService.removeTrack(trackId);
  }

  // ==================== MODULES CRUD ====================

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(GlobalRole.SUPER_ADMIN, GlobalRole.INCUBATOR_MANAGER, GlobalRole.INSTRUCTOR)
  @Post('tracks/:trackId/modules')
  async createModule(@Param('trackId') trackId: string, @Body() dto: CreateModuleDto) {
    return this.programsService.createModule(trackId, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(GlobalRole.SUPER_ADMIN, GlobalRole.INCUBATOR_MANAGER, GlobalRole.INSTRUCTOR)
  @Patch('modules/:moduleId')
  async updateModule(@Param('moduleId') moduleId: string, @Body() dto: UpdateModuleDto) {
    return this.programsService.updateModule(moduleId, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(GlobalRole.SUPER_ADMIN, GlobalRole.INCUBATOR_MANAGER)
  @Delete('modules/:moduleId')
  async removeModule(@Param('moduleId') moduleId: string) {
    return this.programsService.removeModule(moduleId);
  }

  // ==================== ACTIVITY NODES CRUD ====================

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(GlobalRole.SUPER_ADMIN, GlobalRole.INCUBATOR_MANAGER, GlobalRole.INSTRUCTOR)
  @Post('modules/:moduleId/nodes')
  async createNode(@Param('moduleId') moduleId: string, @Body() dto: CreateNodeDto) {
    return this.programsService.createNode(moduleId, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(GlobalRole.SUPER_ADMIN, GlobalRole.INCUBATOR_MANAGER, GlobalRole.INSTRUCTOR)
  @Patch('nodes/:nodeId')
  async updateNode(@Param('nodeId') nodeId: string, @Body() dto: UpdateNodeDto) {
    return this.programsService.updateNode(nodeId, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(GlobalRole.SUPER_ADMIN, GlobalRole.INCUBATOR_MANAGER)
  @Delete('nodes/:nodeId')
  async removeNode(@Param('nodeId') nodeId: string) {
    return this.programsService.removeNode(nodeId);
  }
}