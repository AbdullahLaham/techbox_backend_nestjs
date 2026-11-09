import { Injectable } from '@nestjs/common';
import { AssignmentStatus, EnrollmentStatus, NodeType, Prisma, ProgramType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { EMPTY_PROGRESS, ProgressService } from '../progress/progress.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { ActivityService } from '../activity/activity.service.js';
import { visibleTo } from '../assignments/assignments.service.js';
import {
  CATALOG_STATUSES,
  PUBLIC_DETAIL_STATUSES,
  enrollmentBlockReason,
  enrollmentCountsByProgram,
  seatsTaken,
  type StatusCounts,
} from '../programs/program-mapping.js';
import { CONTENT_ACCESS_STATUSES, SEAT_HOLDING_STATUSES } from '../types/api.contract.js';
import {
  getAssignmentBucket,
  getAssignmentState,
  type AssignmentSubmission,
} from '../types/assignments.contract.js';
import {
  HOME_RECOMMENDED_LIMIT,
  HOME_UPCOMING_ASSIGNMENTS_LIMIT,
  type HomeAssignmentTodoState,
  type HomeAssignmentsSummary,
  type HomeContinueLearning,
  type HomeIncubator,
  type HomeProgramRef,
  type HomeRecommendedProgram,
  type HomeResponse,
  type HomeStats,
  type HomeUpcomingAssignment,
} from '../types/home.contract.js';
import { activityWindowStart, buildWeeklyActivity } from './home-week.js';

/* --------------------------------- Selects -------------------------------- */

const PROGRAM_REF_SELECT = { id: true, title: true, slug: true, type: true, coverImage: true } satisfies Prisma.ProgramSelect;

const ENROLLMENT_SELECT = {
  id: true,
  status: true,
  program: { select: { ...PROGRAM_REF_SELECT, status: true } },
} satisfies Prisma.EnrollmentSelect;

/** What enrollmentBlockReason needs, plus the card fields. */
const PROGRAM_CARD_SELECT = {
  ...PROGRAM_REF_SELECT,
  status: true,
  startDate: true,
  endDate: true,
  maxSeats: true,
  isEnrollmentOpen: true,
} satisfies Prisma.ProgramSelect;

const NOTIFICATION_PREVIEW_SELECT = {
  id: true,
  type: true,
  title: true,
  message: true,
  actionUrl: true,
  createdAt: true,
} satisfies Prisma.NotificationSelect;

/** Only what the home summary needs; the latest submission's status decides the state. */
function assignmentSelect(userId: string) {
  return {
    id: true,
    dueDate: true,
    node: {
      select: {
        title: true,
        module: { select: { track: { select: { program: { select: { id: true, title: true, slug: true } } } } } },
      },
    },
    submissions: {
      where: { studentId: userId },
      orderBy: { createdAt: 'desc' },
      take: 1,
      select: { status: true },
    },
  } satisfies Prisma.AssignmentSelect;
}

const NEXT_LESSON_SELECT = {
  id: true,
  title: true,
  type: true,
  isMandatory: true,
  assignment: { select: { id: true } },
  module: { select: { title: true, track: { select: { title: true } } } },
} satisfies Prisma.ActivityNodeSelect;

/** Curriculum order (ProgramsService: orderIndex, then createdAt, at every level). */
const CURRICULUM_ORDER: Prisma.ActivityNodeOrderByWithRelationInput[] = [
  { module: { track: { orderIndex: 'asc' } } },
  { module: { track: { createdAt: 'asc' } } },
  { module: { orderIndex: 'asc' } },
  { module: { createdAt: 'asc' } },
  { orderIndex: 'asc' },
  { createdAt: 'asc' },
];

type EnrollmentRow = Prisma.EnrollmentGetPayload<{ select: typeof ENROLLMENT_SELECT }>;
type ProgramCardRow = Prisma.ProgramGetPayload<{ select: typeof PROGRAM_CARD_SELECT }>;
type AssignmentRow = Prisma.AssignmentGetPayload<{ select: ReturnType<typeof assignmentSelect> }>;

/**
 * GET /v1/home: read-only aggregation for the mobile Home tab (types/home.contract.ts).
 *
 * Reuses the rule holders of the other modules (ProgressService, visibleTo, the assignment
 * state helpers, the seat rules of program-mapping, NotificationsService) and changes nothing.
 * Two parallel stages, a fixed number of queries whatever the amount of data.
 */
@Injectable()
export class HomeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly progress: ProgressService,
    private readonly notifications: NotificationsService,
    private readonly activity: ActivityService,
  ) {}

  async home(userId: string, timeZone: string): Promise<HomeResponse> {
    const now = new Date();

    /* Stage 1: everything that only needs the user id. */
    const [profile, enrollments, unread, latestUnread, assignmentRows, activity, lastTouched, candidates, incubatorRow] =
      await Promise.all([
        this.prisma.userProfile.findUnique({
          where: { userId },
          select: { firstName: true, lastName: true, avatarUrl: true },
        }),
        this.prisma.enrollment.findMany({
          where: { userId },
          select: ENROLLMENT_SELECT,
          orderBy: { createdAt: 'desc' },
        }),
        this.notifications.unreadCount(userId),
        this.prisma.notification.findFirst({
          where: { userId, isRead: false },
          select: NOTIFICATION_PREVIEW_SELECT,
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        }),
        this.prisma.assignment.findMany({ where: visibleTo(userId), select: assignmentSelect(userId) }),
        this.activity.since(userId, activityWindowStart(now, timeZone)),
        // The ACTIVE program the student worked in last. Assignment lessons are left out:
        // their progress row is written when a grader grades, not by the student.
        this.prisma.progressLog.findFirst({
          where: {
            userId,
            node: {
              type: { not: NodeType.ASSIGNMENT },
              module: {
                track: {
                  program: {
                    status: { in: PUBLIC_DETAIL_STATUSES },
                    enrollments: { some: { userId, status: EnrollmentStatus.ACTIVE } },
                  },
                },
              },
            },
          },
          orderBy: { updatedAt: 'desc' },
          select: { updatedAt: true, node: { select: { module: { select: { track: { select: { programId: true } } } } } } },
        }),
        // A few more than shown: the ones that cannot take applications go last.
        this.prisma.program.findMany({
          where: {
            status: { in: CATALOG_STATUSES },
            enrollments: { none: { userId, status: { in: [...SEAT_HOLDING_STATUSES] } } },
          },
          select: PROGRAM_CARD_SELECT,
          orderBy: [{ isEnrollmentOpen: 'desc' }, { createdAt: 'desc' }],
          take: HOME_RECOMMENDED_LIMIT * 2,
        }),
        this.prisma.program.findFirst({
          where: { type: ProgramType.INCUBATOR_BATCH, status: { in: CATALOG_STATUSES } },
          select: { ...PROGRAM_CARD_SELECT, enrollments: { where: { userId }, select: { status: true }, take: 1 } },
          orderBy: [{ isEnrollmentOpen: 'desc' }, { createdAt: 'desc' }],
        }),
      ]);

    const assignments = summarizeAssignments(assignmentRows, now);
    const current = pickCurrentEnrollment(enrollments, lastTouched?.node.module.track.programId);
    const withAccess = enrollments.filter((e) => CONTENT_ACCESS_STATUSES.includes(e.status));
    const cardIds = [...new Set([...candidates.map((c) => c.id), ...(incubatorRow ? [incubatorRow.id] : [])])];

    /* Stage 2: what depends on stage 1. */
    const [progress, seatCounts, lessonStats, nextLesson] = await Promise.all([
      this.progress.forEnrollments(withAccess.map((e) => e.id)),
      enrollmentCountsByProgram(this.prisma, cardIds),
      this.lessonStats(candidates.map((c) => c.id)),
      current
        ? this.prisma.activityNode.findFirst({
            where: nextLessonWhere(userId, current.program.id, assignments.closedIds),
            select: NEXT_LESSON_SELECT,
            orderBy: CURRICULUM_ORDER,
          })
        : null,
    ]);

    const stats: HomeStats = {
      activePrograms: enrollments.filter((e) => e.status === EnrollmentStatus.ACTIVE).length,
      completedPrograms: enrollments.filter((e) => e.status === EnrollmentStatus.COMPLETED).length,
      pendingApplications: enrollments.filter((e) => e.status === EnrollmentStatus.PENDING).length,
      completedLessons: withAccess.reduce((sum, e) => sum + (progress.get(e.id) ?? EMPTY_PROGRESS).completedLessons, 0),
      totalLessons: withAccess.reduce((sum, e) => sum + (progress.get(e.id) ?? EMPTY_PROGRESS).totalLessons, 0),
    };

    let continueLearning: HomeContinueLearning | null = null;
    if (current) {
      const p = progress.get(current.id) ?? EMPTY_PROGRESS;
      continueLearning = {
        enrollmentId: current.id,
        program: toProgramRef(current.program),
        progressPct: p.percent,
        completedLessons: p.completedLessons,
        totalLessons: p.totalLessons,
        nextLesson: nextLesson
          ? {
              id: nextLesson.id,
              title: nextLesson.title,
              type: nextLesson.type,
              isMandatory: nextLesson.isMandatory,
              moduleTitle: nextLesson.module.title,
              trackTitle: nextLesson.module.track.title,
              assignmentId: nextLesson.type === NodeType.ASSIGNMENT ? (nextLesson.assignment?.id ?? null) : null,
            }
          : null,
        lastActivityAt:
          lastTouched?.node.module.track.programId === current.program.id ? lastTouched.updatedAt.toISOString() : null,
      };
    }

    return {
      generatedAt: now.toISOString(),
      user: {
        id: userId,
        firstName: profile?.firstName ?? null,
        lastName: profile?.lastName ?? null,
        avatarUrl: profile?.avatarUrl ?? null,
      },
      notifications: {
        unreadCount: unread.unreadCount,
        latestUnread: latestUnread ? { ...latestUnread, createdAt: latestUnread.createdAt.toISOString() } : null,
      },
      continueLearning,
      stats,
      weeklyActivity: buildWeeklyActivity(now, timeZone, activity),
      assignments: assignments.summary,
      recommendedPrograms: recommend(candidates, seatCounts, lessonStats, now),
      incubator: incubatorRow ? toIncubator(incubatorRow, seatCounts.get(incubatorRow.id), now) : null,
    };
  }

  /** Visible lessons (same rule as the curriculum) and total video length per program. One query. */
  private async lessonStats(programIds: string[]): Promise<Map<string, { lessons: number; seconds: number }>> {
    const result = new Map<string, { lessons: number; seconds: number }>();
    if (programIds.length === 0) return result;
    const rows = await this.prisma.$queryRaw<Array<{ programId: string; lessons: number; seconds: number }>>`
      SELECT t."programId" AS "programId",
             count(n."id")::int AS lessons,
             coalesce(sum(v."durationSec"), 0)::int AS seconds
      FROM "Track" t
      JOIN "Module" m ON m."trackId" = t."id"
      JOIN "ActivityNode" n ON n."moduleId" = m."id"
        AND (n."type" <> 'ASSIGNMENT' OR EXISTS (
              SELECT 1 FROM "Assignment" a WHERE a."nodeId" = n."id" AND a."status" = 'PUBLISHED'))
        AND (n."type" <> 'QUIZ' OR EXISTS (
              SELECT 1 FROM "Quiz" q WHERE q."nodeId" = n."id" AND q."isPublished"))
      LEFT JOIN "VideoAsset" v ON v."nodeId" = n."id"
      WHERE t."programId" IN (${Prisma.join(programIds)})
      GROUP BY t."programId"`;
    for (const r of rows) result.set(r.programId, { lessons: r.lessons, seconds: r.seconds });
    return result;
  }
}

/* --------------------------------- Helpers -------------------------------- */

const toProgramRef = (p: HomeProgramRef): HomeProgramRef => ({
  id: p.id,
  title: p.title,
  slug: p.slug,
  type: p.type,
  coverImage: p.coverImage,
});

/**
 * The hero program: the ACTIVE enrollment worked in last, else the newest ACTIVE one.
 * Programs whose page students cannot open (draft, archived) are skipped.
 */
function pickCurrentEnrollment(enrollments: EnrollmentRow[], lastTouchedProgramId?: string): EnrollmentRow | null {
  const eligible = enrollments.filter(
    (e) => e.status === EnrollmentStatus.ACTIVE && PUBLIC_DETAIL_STATUSES.includes(e.program.status),
  );
  return eligible.find((e) => e.program.id === lastTouchedProgramId) ?? eligible[0] ?? null;
}

/**
 * First lesson in curriculum order that is visible (published assignments and quizzes only),
 * not completed, and actionable (assignments already submitted or closed are skipped).
 */
function nextLessonWhere(userId: string, programId: string, closedAssignmentIds: string[]): Prisma.ActivityNodeWhereInput {
  return {
    module: { track: { programId } },
    progress: { none: { userId, isCompleted: true } },
    AND: [
      {
        OR: [
          { type: { not: NodeType.ASSIGNMENT } },
          { assignment: { is: { status: AssignmentStatus.PUBLISHED, id: { notIn: closedAssignmentIds } } } },
        ],
      },
      { OR: [{ type: { not: NodeType.QUIZ } }, { quiz: { is: { isPublished: true } } }] },
    ],
  };
}

/** State, bucket and overdue flag exactly as GET /v1/assignments (assignments.service.ts toItem). */
function summarizeAssignments(rows: AssignmentRow[], now: Date): { summary: HomeAssignmentsSummary; closedIds: string[] } {
  const todo: HomeUpcomingAssignment[] = [];
  const closedIds: string[] = [];
  let awaitingReviewCount = 0;

  for (const row of rows) {
    const latest = row.submissions[0];
    // getAssignmentState only reads `status`.
    const state = getAssignmentState({ submission: latest ? ({ status: latest.status } as AssignmentSubmission) : null });
    const bucket = getAssignmentBucket(state);
    if (bucket !== 'TODO') {
      closedIds.push(row.id);
      if (bucket === 'SUBMITTED') awaitingReviewCount++;
      continue;
    }
    const program = row.node.module.track.program;
    todo.push({
      id: row.id,
      title: row.node.title,
      dueDate: row.dueDate?.toISOString() ?? null,
      isOverdue: row.dueDate !== null && row.dueDate.getTime() < now.getTime(),
      state: state as HomeAssignmentTodoState,
      program: { id: program.id, title: program.title, slug: program.slug },
    });
  }

  // Nearest deadline first (overdue ones are the earliest), no deadline last.
  todo.sort((a, b) => {
    if (a.dueDate === b.dueDate) return a.title.localeCompare(b.title);
    if (a.dueDate === null) return 1;
    if (b.dueDate === null) return -1;
    return a.dueDate < b.dueDate ? -1 : 1;
  });

  return {
    summary: {
      todoCount: todo.length,
      overdueCount: todo.filter((a) => a.isOverdue).length,
      awaitingReviewCount,
      upcoming: todo.slice(0, HOME_UPCOMING_ASSIGNMENTS_LIMIT),
    },
    closedIds,
  };
}

function seatInfo(row: ProgramCardRow, counts: StatusCounts | undefined, now: Date) {
  const taken = counts ? seatsTaken(counts) : 0;
  const reason = enrollmentBlockReason(row, taken, now);
  return {
    seatsRemaining: row.maxSeats === null ? null : Math.max(0, row.maxSeats - taken),
    canEnroll: reason === null,
    enrollmentBlockReason: reason,
  };
}

/** Open programs first (stable: keeps the open-then-newest order of the query). */
function recommend(
  candidates: ProgramCardRow[],
  seatCounts: Map<string, StatusCounts>,
  lessonStats: Map<string, { lessons: number; seconds: number }>,
  now: Date,
): HomeRecommendedProgram[] {
  const cards = candidates.map((row): HomeRecommendedProgram => {
    const stats = lessonStats.get(row.id);
    return {
      ...toProgramRef(row),
      startDate: row.startDate?.toISOString() ?? null,
      lessonsCount: stats?.lessons ?? 0,
      videoDurationSec: stats?.seconds ?? 0,
      ...seatInfo(row, seatCounts.get(row.id), now),
    };
  });
  return [...cards.filter((c) => c.canEnroll), ...cards.filter((c) => !c.canEnroll)].slice(0, HOME_RECOMMENDED_LIMIT);
}

function toIncubator(
  row: ProgramCardRow & { enrollments: Array<{ status: EnrollmentStatus }> },
  counts: StatusCounts | undefined,
  now: Date,
): HomeIncubator {
  const { canEnroll, enrollmentBlockReason } = seatInfo(row, counts, now);
  return {
    program: toProgramRef(row),
    canEnroll,
    enrollmentBlockReason,
    myEnrollmentStatus: row.enrollments[0]?.status ?? null,
  };
}
