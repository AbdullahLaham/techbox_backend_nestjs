import { Controller, Get, Param, Req, UseFilters, UseGuards, UseInterceptors } from '@nestjs/common';
import { AssignmentsService } from './assignments.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { ApiExceptionFilter } from '../common/api-errors.js';
import { PrivateCacheInterceptor } from '../common/private-cache.interceptor.js';

/** Student API (ASSIGNMENTS_SPEC.md section 8): any signed-in user, filtered by enrollment. */
@Controller('v1/assignments')
@UseGuards(JwtAuthGuard)
@UseFilters(ApiExceptionFilter)
@UseInterceptors(PrivateCacheInterceptor)
export class AssignmentsController {
  constructor(private readonly assignmentsService: AssignmentsService) {}

  @Get()
  getAssignments(@Req() req: any) {
    return this.assignmentsService.getStudentAssignments(req.user.id);
  }

  @Get(':id')
  getAssignment(@Req() req: any, @Param('id') id: string) {
    return this.assignmentsService.getStudentAssignment(req.user.id, id);
  }
}
