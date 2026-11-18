import { Controller, Get, Injectable, Module, UseFilters, UseGuards, UseInterceptors } from '@nestjs/common';
import { EnrollmentStatus, GlobalRole, ProgramStatus, SubmissionStatus, UserStatus } from '@prisma/client';
import { AuthModule } from '../auth/auth.module.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { ApiExceptionFilter } from '../common/api-errors.js';
import { PrivateCacheInterceptor } from '../common/private-cache.interceptor.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  ADMIN_OVERVIEW_NEW_LEARNER_DAYS,
  ADMIN_OVERVIEW_PROGRAMS_LIMIT,
  ADMIN_OVERVIEW_ROLES,
  type AdminOverviewProgram,
  type AdminOverviewResponse,
} from '../types/admin-overview.contract.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const CATALOG_STATUSES = [ProgramStatus.PUBLISHED, ProgramStatus.ONGOING];
const AWAITING_REVIEW = [SubmissionStatus.SUBMITTED, SubmissionStatus.UNDER_REVIEW];

const pct = (value: number | null | undefined) => Math.round((value ?? 0) * 10) / 10;

/** Read-only counts for the dashboard's staff home page (types/admin-overview.contract.ts). */
@Injectable()
export class AdminOverviewService {
  constructor(private readonly prisma: PrismaService) {}

  async overview(now = new Date()): Promise<AdminOverviewResponse> {
    const notDeletedStudent = { globalRole: GlobalRole.STUDENT, status: { not: UserStatus.ARCHIVED } };
    const since = new Date(now.getTime() - ADMIN_OVERVIEW_NEW_LEARNER_DAYS * DAY_MS);

    const [learners, newLearners, byStatus, awaitingReview, programs] = await Promise.all([
      this.prisma.user.count({ where: notDeletedStudent }),
      this.prisma.user.count({ where: { ...notDeletedStudent, createdAt: { gte: since } } }),
      this.prisma.enrollment.groupBy({
        by: ['status'],
        _count: { _all: true },
        _avg: { progressPct: true },
      }),
      this.prisma.submission.count({ where: { status: { in: AWAITING_REVIEW } } }),
      this.prisma.program.findMany({
        where: { status: { in: CATALOG_STATUSES } },
        // Postgres sorts NULL last on ascending order: programs without a start date go last.
        orderBy: [{ startDate: 'asc' }, { createdAt: 'desc' }],
        take: ADMIN_OVERVIEW_PROGRAMS_LIMIT,
        select: { id: true, title: true, slug: true, status: true, startDate: true, maxSeats: true },
      }),
    ]);

    const statusRow = (status: EnrollmentStatus) => byStatus.find((r) => r.status === status);

    const perProgram = programs.length
      ? await this.prisma.enrollment.groupBy({
          by: ['programId', 'status'],
          where: {
            programId: { in: programs.map((p) => p.id) },
            status: { in: [EnrollmentStatus.PENDING, EnrollmentStatus.ACTIVE, EnrollmentStatus.COMPLETED] },
          },
          _count: { _all: true },
          _avg: { progressPct: true },
        })
      : [];

    const programRows: AdminOverviewProgram[] = programs.map((p) => {
      const row = (status: EnrollmentStatus) => perProgram.find((r) => r.programId === p.id && r.status === status);
      return {
        id: p.id,
        title: p.title,
        slug: p.slug,
        status: p.status as AdminOverviewProgram['status'],
        startDate: p.startDate?.toISOString() ?? null,
        maxSeats: p.maxSeats,
        pending: row(EnrollmentStatus.PENDING)?._count._all ?? 0,
        active: row(EnrollmentStatus.ACTIVE)?._count._all ?? 0,
        completed: row(EnrollmentStatus.COMPLETED)?._count._all ?? 0,
        averageProgressPct: pct(row(EnrollmentStatus.ACTIVE)?._avg.progressPct),
      };
    });

    return {
      generatedAt: now.toISOString(),
      learners: { total: learners, newRecently: newLearners },
      pendingApplications: statusRow(EnrollmentStatus.PENDING)?._count._all ?? 0,
      submissionsAwaitingReview: awaitingReview,
      enrollments: {
        active: statusRow(EnrollmentStatus.ACTIVE)?._count._all ?? 0,
        completed: statusRow(EnrollmentStatus.COMPLETED)?._count._all ?? 0,
        averageProgressPct: pct(statusRow(EnrollmentStatus.ACTIVE)?._avg.progressPct),
      },
      programs: programRows,
    };
  }
}

/** GET /v1/admin/overview: staff only (ADMIN_OVERVIEW_ROLES). */
@Controller('v1/admin/overview')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...(ADMIN_OVERVIEW_ROLES as readonly GlobalRole[]))
@UseFilters(ApiExceptionFilter)
@UseInterceptors(PrivateCacheInterceptor)
export class AdminOverviewController {
  constructor(private readonly service: AdminOverviewService) {}

  @Get()
  get() {
    return this.service.overview();
  }
}

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [AdminOverviewController],
  providers: [AdminOverviewService],
})
export class AdminOverviewModule {}
