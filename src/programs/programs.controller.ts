import { Controller, Get, Param, Req, UseFilters, UseGuards } from '@nestjs/common';
import { ProgramsService } from './programs.service.js';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard.js';
import { ApiExceptionFilter } from '../common/api-errors.js';

/**
 * Public catalog and program detail (api.contract.ts: ProgramSummary, ProgramDetail).
 * `/programs` is kept for app versions already installed; new clients use `/v1/programs`.
 * Program management moved to /v1/admin/programs (AdminProgramsController).
 */
@Controller(['v1/programs', 'programs'])
@UseFilters(ApiExceptionFilter)
export class ProgramsController {
  constructor(private readonly programsService: ProgramsService) {}

  @Get()
  catalog() {
    return this.programsService.catalog();
  }

  /** Optional Bearer token: adds the caller's enrollment and unlocks content for accepted students and staff. */
  @Get(':slug')
  @UseGuards(OptionalJwtAuthGuard)
  detail(@Param('slug') slug: string, @Req() req: any) {
    return this.programsService.detail(slug, req.user);
  }
}
