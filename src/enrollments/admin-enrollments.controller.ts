import { Body, Controller, Get, Param, Patch, Query, Req, UseFilters, UseGuards, UseInterceptors } from '@nestjs/common';
import { GlobalRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { ApiExceptionFilter } from '../common/api-errors.js';
import { PrivateCacheInterceptor } from '../common/private-cache.interceptor.js';
import { ENROLLMENT_MANAGER_ROLES } from '../types/api.contract.js';
import { EnrollmentsService } from './enrollments.service.js';
import { AdminEnrollmentListQueryDto, UpdateEnrollmentStatusDto } from './dto/admin-enrollment.dto.js';

/** Dashboard review of applications (api.contract.ts, "Enrollments (admin)"). */
@Controller('v1/admin/enrollments')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...(ENROLLMENT_MANAGER_ROLES as readonly GlobalRole[]))
@UseFilters(ApiExceptionFilter)
@UseInterceptors(PrivateCacheInterceptor)
export class AdminEnrollmentsController {
  constructor(private readonly enrollments: EnrollmentsService) {}

  @Get()
  list(@Query() query: AdminEnrollmentListQueryDto) {
    return this.enrollments.list(query);
  }

  @Get(':id')
  detail(@Param('id') id: string) {
    return this.enrollments.detail(id);
  }

  /** Approve (ACTIVE), reject (REJECTED), suspend, complete... see ENROLLMENT_STATUS_TRANSITIONS. */
  @Patch(':id/status')
  changeStatus(@Req() req: any, @Param('id') id: string, @Body() dto: UpdateEnrollmentStatusDto) {
    return this.enrollments.changeStatus(req.user, id, dto);
  }
}
