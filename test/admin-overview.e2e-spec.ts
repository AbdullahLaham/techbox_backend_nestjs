/**
 * GET /v1/admin/overview (types/admin-overview.contract.ts) and GET /health.
 * WIPES the database: runs only when its name ends with `_test` (see assignments.e2e-spec.ts).
 */
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { EnrollmentStatus, GlobalRole, NodeType, ProgramStatus, SubmissionStatus, UserStatus } from '@prisma/client';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import type { AdminOverviewResponse } from '../src/types/admin-overview.contract.js';

const dbName = new URL(process.env.DATABASE_URL ?? 'postgres://x/none').pathname.slice(1);
const DAY = 24 * 60 * 60 * 1000;

describe.skipIf(!dbName.endsWith('_test'))('Admin overview and health (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const tokens: Record<string, string> = {};
  const ids: Record<string, string> = {};

  const http = () => request(app.getHttpServer());
  const as = (who: string) => ({ Authorization: `Bearer ${tokens[who]}` });

  async function user(key: string, role: GlobalRole, extra: { status?: UserStatus; createdAt?: Date } = {}) {
    const u = await prisma.user.create({
      data: { email: `${key}@e2e.test`, passwordHash: 'x', globalRole: role, ...extra },
    });
    ids[key] = u.id;
    tokens[key] = app.get(JwtService).sign({ sub: u.id, email: u.email, globalRole: role });
  }

  async function program(slug: string, status: ProgramStatus, startDate: Date | null) {
    const p = await prisma.program.create({ data: { title: `برنامج ${slug}`, slug, status, startDate, maxSeats: 20 } });
    ids[slug] = p.id;
  }

  const enroll = (who: string, slug: string, status: EnrollmentStatus, progressPct = 0) =>
    prisma.enrollment.create({ data: { userId: ids[who], programId: ids[slug], status, progressPct } });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);

    await prisma.$executeRawUnsafe(
      'TRUNCATE "Certificate", "LearningActivity", "Submission", "AssignmentAttachment", "Assignment", "QuizAttempt", "QuizOption", "QuizQuestion", "Quiz", "NodeResource", "ProgressLog", "VideoAsset", "ActivityNode", "Module", "Track", "Enrollment", "Program", "UserSession", "UserProfile", "Notification", "User" CASCADE',
    );

    const now = Date.now();
    await user('admin', GlobalRole.SUPER_ADMIN);
    await user('mentor', GlobalRole.MENTOR);
    await user('a', GlobalRole.STUDENT);
    await user('b', GlobalRole.STUDENT);
    await user('c', GlobalRole.STUDENT, { createdAt: new Date(now - 60 * DAY) });
    await user('gone', GlobalRole.STUDENT, { status: UserStatus.ARCHIVED });

    await program('later', ProgramStatus.PUBLISHED, new Date(now + 20 * DAY));
    await program('soon', ProgramStatus.ONGOING, new Date(now + 2 * DAY));
    await program('undated', ProgramStatus.PUBLISHED, null);
    await program('draft', ProgramStatus.DRAFT, new Date(now + DAY));

    await enroll('a', 'soon', EnrollmentStatus.ACTIVE, 40);
    await enroll('b', 'soon', EnrollmentStatus.ACTIVE, 60);
    await enroll('c', 'soon', EnrollmentStatus.COMPLETED, 100);
    await enroll('a', 'later', EnrollmentStatus.PENDING);
    await enroll('b', 'later', EnrollmentStatus.REJECTED);
    await enroll('c', 'draft', EnrollmentStatus.ACTIVE, 10);

    const module = await prisma.module.create({
      data: { title: 'M', track: { create: { title: 'T', programId: ids.soon } } },
    });
    const assignment = await prisma.assignment.create({
      data: {
        instructions: 'x',
        node: { create: { title: 'واجب', type: NodeType.ASSIGNMENT, moduleId: module.id } },
      },
    });
    for (const [who, status] of [
      ['a', SubmissionStatus.SUBMITTED],
      ['b', SubmissionStatus.UNDER_REVIEW],
      ['c', SubmissionStatus.GRADED],
      ['a', SubmissionStatus.NEEDS_REVISION],
    ] as const) {
      await prisma.submission.create({ data: { assignmentId: assignment.id, studentId: ids[who], payload: {}, status } });
    }
  });

  afterAll(async () => {
    await app?.close();
  });

  it('counts learners, applications, reviews and progress from the database', async () => {
    const res = await http().get('/v1/admin/overview').set(as('admin')).expect(200);
    const body = res.body as AdminOverviewResponse;

    expect(res.headers['cache-control']).toContain('private');
    // ARCHIVED (deleted) accounts are not learners; c signed up 60 days ago.
    expect(body.learners).toEqual({ total: 3, newRecently: 2 });
    expect(body.pendingApplications).toBe(1);
    expect(body.submissionsAwaitingReview).toBe(2);
    // ACTIVE everywhere, drafts included: (40 + 60 + 10) / 3.
    expect(body.enrollments).toEqual({ active: 3, completed: 1, averageProgressPct: 36.7 });

    // Catalog only (no draft), soonest start first, undated last.
    expect(body.programs.map((p) => p.slug)).toEqual(['soon', 'later', 'undated']);
    expect(body.programs[0]).toMatchObject({
      status: 'ONGOING',
      maxSeats: 20,
      pending: 0,
      active: 2,
      completed: 1,
      averageProgressPct: 50,
    });
    expect(body.programs[1]).toMatchObject({ pending: 1, active: 0, completed: 0, averageProgressPct: 0 });
  });

  it('is for staff only', async () => {
    await http().get('/v1/admin/overview').set(as('mentor')).expect(200);
    await http().get('/v1/admin/overview').set(as('a')).expect(403);
    await http().get('/v1/admin/overview').expect(401);
  });

  it('GET /health checks the database and is never cached', async () => {
    const res = await http().get('/health').expect(200);
    expect(res.body).toEqual({ status: 'ok', database: 'ok' });
    expect(res.headers['cache-control']).toBe('no-store');
  });
});
