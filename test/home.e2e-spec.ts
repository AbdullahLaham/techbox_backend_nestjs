/**
 * Home screen feed, GET /v1/home (types/home.contract.ts).
 * WIPES the database: runs only when its name ends with `_test` (see assignments.e2e-spec.ts).
 */
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import {
  AssignmentStatus,
  EnrollmentStatus,
  GlobalRole,
  NodeType,
  Prisma,
  ProgramStatus,
  ProgramType,
  SubmissionType,
} from '@prisma/client';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { ActivityService } from '../src/activity/activity.service.js';
import type { MyEnrollment } from '../src/types/api.contract.js';
import type { HomeResponse } from '../src/types/home.contract.js';

const dbName = new URL(process.env.DATABASE_URL ?? 'postgres://x/none').pathname.slice(1);
const storageDir = mkdtempSync(join(tmpdir(), 'home-e2e-'));
process.env.STORAGE_LOCAL_DIR = storageDir;
process.env.STORAGE_SIGNING_SECRET = 'e2e-secret';
process.env.PUBLIC_API_URL = 'http://localhost';
const DAY = 24 * 60 * 60 * 1000;

describe.skipIf(!dbName.endsWith('_test'))('Home feed (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const tokens: Record<string, string> = {};
  const ids: Record<string, string> = {};

  const http = () => request(app.getHttpServer());
  const as = (who: string) => ({ Authorization: `Bearer ${tokens[who]}` });
  const home = async (who: string) =>
    (await http().get('/v1/home').query({ tz: 'UTC' }).set(as(who)).expect(200)).body as HomeResponse;
  const progress = (who: string, key: string, body: object) =>
    http().post(`/v1/nodes/${ids[key]}/progress`).set(as(who)).send(body).expect(200);

  let order = 0;
  async function program(slug: string, data: Partial<Prisma.ProgramCreateInput> = {}) {
    const p = await prisma.program.create({
      data: {
        title: `برنامج ${slug}`,
        slug,
        status: ProgramStatus.PUBLISHED,
        ...data,
        // Distinct createdAt so "newest" is deterministic.
        createdAt: new Date(Date.now() - DAY + order++ * 1000),
        tracks: { create: { title: `T-${slug}`, modules: { create: { title: `M-${slug}` } } } },
      },
      include: { tracks: { include: { modules: true } } },
    });
    ids[slug] = p.id;
    ids[`${slug}Module`] = p.tracks[0].modules[0].id;
    return p.id;
  }
  async function node(key: string, moduleKey: string, type: NodeType, extra: Partial<Prisma.ActivityNodeCreateInput> = {}) {
    const n = await prisma.activityNode.create({
      data: { module: { connect: { id: ids[`${moduleKey}Module`] } }, title: key, type, orderIndex: order++, ...extra },
      include: { assignment: true },
    });
    ids[key] = n.id;
    if (n.assignment) ids[`${key}Assignment`] = n.assignment.id;
  }
  const enroll = (who: string, slug: string, status: EnrollmentStatus) =>
    prisma.enrollment.create({ data: { userId: ids[who], programId: ids[slug], status, createdAt: new Date(Date.now() - DAY + order++ * 1000) } });
  const publishedAssignment = (dueDate: Date | null) => ({
    assignment: {
      create: { instructions: 'x', allowedType: SubmissionType.TEXT_CONTENT, status: AssignmentStatus.PUBLISHED, publishedAt: new Date(), dueDate },
    },
  });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);

    await prisma.$executeRawUnsafe(
      'TRUNCATE "Submission", "AssignmentAttachment", "Assignment", "QuizAttempt", "QuizOption", "QuizQuestion", "Quiz", "NodeResource", "ProgressLog", "VideoAsset", "ActivityNode", "Module", "Track", "Enrollment", "Program", "UserSession", "UserProfile", "Notification", "User" CASCADE',
    );
    for (const [k, role] of [['student', GlobalRole.STUDENT], ['newcomer', GlobalRole.STUDENT]] as const) {
      const u = await prisma.user.create({ data: { email: `${k}@e2e.test`, passwordHash: 'x', globalRole: role } });
      ids[k] = u.id;
      tokens[k] = app.get(JwtService).sign({ sub: u.id, email: u.email, globalRole: role });
    }
    await prisma.userProfile.create({ data: { userId: ids.student, firstName: 'سارة', lastName: 'أحمد' } });

    // The program the student works in: video, reading, unpublished quiz, assignment, video.
    await program('live', { status: ProgramStatus.ONGOING });
    await node('video1', 'live', NodeType.VIDEO_LECTURE, { video: { create: { externalId: 'v', playbackUrl: 'https://v.example/1', durationSec: 600 } } });
    await node('reading1', 'live', NodeType.READING_MATERIAL);
    await node('draftQuiz', 'live', NodeType.QUIZ, { quiz: { create: { title: 'D' } } });
    await node('task', 'live', NodeType.ASSIGNMENT, publishedAssignment(new Date(Date.now() + 5 * DAY)));
    await node('video2', 'live', NodeType.VIDEO_LECTURE, { video: { create: { externalId: 'v2', playbackUrl: 'https://v.example/2', durationSec: 300 } } });
    await node('lateTask', 'live', NodeType.ASSIGNMENT, publishedAssignment(new Date(Date.now() - 2 * DAY)));
    await node('draftTask', 'live', NodeType.ASSIGNMENT, { assignment: { create: { instructions: 'x' } } });
    await enroll('student', 'live', EnrollmentStatus.ACTIVE);

    // Joined later (so the newest ACTIVE one), never opened.
    await program('second', { status: ProgramStatus.ONGOING });
    await node('secondReading', 'second', NodeType.READING_MATERIAL);
    await node('secondQuiz', 'second', NodeType.QUIZ, {
      quiz: {
        create: {
          title: 'Q',
          passingScore: 1,
          isPublished: true,
          questions: { create: { text: 'q', points: 1, options: { create: [0, 1, 2, 3].map((i) => ({ text: `o${i}`, isCorrect: i === 0, orderIndex: i })) } } },
        },
      },
    });
    ids.secondQuizId = (await prisma.quiz.findUniqueOrThrow({ where: { nodeId: ids.secondQuiz }, select: { id: true } })).id;
    await enroll('student', 'second', EnrollmentStatus.ACTIVE);

    await program('finished', { status: ProgramStatus.COMPLETED });
    await node('finishedReading', 'finished', NodeType.READING_MATERIAL);
    await enroll('student', 'finished', EnrollmentStatus.COMPLETED);

    await program('waiting');
    await enroll('student', 'waiting', EnrollmentStatus.PENDING);

    await program('refused');
    await enroll('student', 'refused', EnrollmentStatus.REJECTED);

    // Catalog only.
    await program('closed', { isEnrollmentOpen: false });
    await program('open');
    await node('openVideo', 'open', NodeType.VIDEO_LECTURE, { video: { create: { externalId: 'o', playbackUrl: 'https://v.example/o', durationSec: 3600 } } });
    await node('openReading', 'open', NodeType.READING_MATERIAL, { isMandatory: false });
    await node('openDraftQuiz', 'open', NodeType.QUIZ, { quiz: { create: { title: 'D' } } });
    await program('hidden', { status: ProgramStatus.DRAFT });
    await program('incubator', { type: ProgramType.INCUBATOR_BATCH, status: ProgramStatus.ONGOING });

    await prisma.notification.createMany({
      data: [
        { userId: ids.student, title: 'قديم', message: 'm', createdAt: new Date(Date.now() - 3 * DAY) },
        { userId: ids.student, title: 'جديد', message: 'm', actionUrl: '/programs/live', createdAt: new Date(Date.now() - DAY) },
        { userId: ids.student, title: 'مقروء', message: 'm', isRead: true, createdAt: new Date() },
        { userId: ids.newcomer, title: 'لغيري', message: 'm' },
      ],
    });
  });

  afterAll(async () => {
    await app?.close();
    rmSync(storageDir, { recursive: true, force: true });
  });

  it('requires a token and a valid timezone; private cache', async () => {
    await http().get('/v1/home').expect(401);
    const bad = await http().get('/v1/home').query({ tz: 'Mars/Olympus' }).set(as('student')).expect(400);
    expect(bad.body.code).toBe('VALIDATION_FAILED');
    const ok = await http().get('/v1/home').set(as('student')).expect(200);
    expect(ok.headers['cache-control']).toBe('private, max-age=0');
    expect(ok.body.weeklyActivity.timeZone).toBe('Asia/Gaza');
  });

  it('a newcomer gets an empty dashboard and the catalog', async () => {
    const res = await home('newcomer');
    expect(res.user).toEqual({ id: ids.newcomer, firstName: null, lastName: null, avatarUrl: null });
    expect(res.notifications).toMatchObject({ unreadCount: 1, latestUnread: { title: 'لغيري' } });
    expect(res.continueLearning).toBeNull();
    expect(res.stats).toEqual({ activePrograms: 0, completedPrograms: 0, pendingApplications: 0, completedLessons: 0, totalLessons: 0 });
    expect(res.assignments).toEqual({ todoCount: 0, overdueCount: 0, awaitingReviewCount: 0, upcoming: [] });
    expect(res.weeklyActivity.days).toHaveLength(7);
    expect(res.weeklyActivity.activeDaysCount).toBe(0);
    // Catalog: open first then newest; COMPLETED and DRAFT programs are not listed.
    expect(res.recommendedPrograms.map((p) => p.slug)).toEqual(['incubator', 'open', 'refused', 'waiting', 'second', 'live']);
    expect(res.incubator).toMatchObject({ program: { slug: 'incubator' }, canEnroll: true, myEnrollmentStatus: null });
  });

  it('header, stats and recommendations of an enrolled student', async () => {
    const res = await home('student');
    expect(res.user).toMatchObject({ firstName: 'سارة', lastName: 'أحمد' });
    expect(res.notifications.unreadCount).toBe(2);
    expect(res.notifications.latestUnread).toMatchObject({ title: 'جديد', actionUrl: '/programs/live', type: 'SYSTEM' });
    expect((await http().get('/v1/notifications/unread-count').set(as('student')).expect(200)).body.unreadCount).toBe(2);

    expect(res.stats).toMatchObject({ activePrograms: 2, completedPrograms: 1, pendingApplications: 1, completedLessons: 0 });

    // Joined or applied programs are left out; REJECTED may apply again; closed ones go last.
    expect(res.recommendedPrograms.map((p) => p.slug)).toEqual(['incubator', 'open', 'refused', 'closed']);
    expect(res.recommendedPrograms[1]).toMatchObject({ lessonsCount: 2, videoDurationSec: 3600, canEnroll: true, seatsRemaining: 30 });
    expect(res.recommendedPrograms[3]).toMatchObject({ canEnroll: false, enrollmentBlockReason: 'CLOSED' });

    // Never opened anything: the newest ACTIVE program.
    expect(res.continueLearning).toMatchObject({
      program: { slug: 'second' },
      lastActivityAt: null,
      nextLesson: { id: ids.secondReading, type: 'READING_MATERIAL' },
    });
  });

  it('continue learning follows the program worked in last and its next actionable lesson', async () => {
    await progress('student', 'video1', { positionSec: 600 });
    let res = await home('student');
    expect(res.continueLearning).toMatchObject({
      program: { slug: 'live' },
      completedLessons: 1,
      nextLesson: { id: ids.reading1, type: 'READING_MATERIAL', moduleTitle: 'M-live', trackTitle: 'T-live', assignmentId: null },
    });
    expect(res.continueLearning!.lastActivityAt).not.toBeNull();

    // The unpublished quiz is skipped; the assignment is next, with its id for the app route.
    await progress('student', 'reading1', { completed: true });
    res = await home('student');
    expect(res.continueLearning!.nextLesson).toMatchObject({ id: ids.task, type: 'ASSIGNMENT', assignmentId: ids.taskAssignment });

    // Submitted (waiting for a grader): not actionable, the next video comes first.
    await http().post(`/v1/assignments/${ids.taskAssignment}/submit`).set(as('student')).send({ text: 'حل' }).expect(201);
    res = await home('student');
    expect(res.continueLearning!.nextLesson).toMatchObject({ id: ids.video2 });

    // Same numbers as the enrollments screen.
    const mine = (await http().get('/v1/enrollments/my-enrollments').set(as('student')).expect(200)).body as MyEnrollment[];
    const live = mine.find((e) => e.program.slug === 'live')!;
    expect(res.continueLearning).toMatchObject({
      progressPct: live.progressPct,
      completedLessons: live.completedLessons,
      totalLessons: live.totalLessons,
    });
    const withAccess = mine.filter((e) => e.status === 'ACTIVE' || e.status === 'COMPLETED');
    expect(res.stats.completedLessons).toBe(withAccess.reduce((s, e) => s + e.completedLessons, 0));
    expect(res.stats.totalLessons).toBe(withAccess.reduce((s, e) => s + e.totalLessons, 0));
  });

  it('assignments summary matches GET /v1/assignments', async () => {
    const res = await home('student');
    expect(res.assignments).toMatchObject({ todoCount: 1, overdueCount: 1, awaitingReviewCount: 1 });
    expect(res.assignments.upcoming).toEqual([
      expect.objectContaining({ id: ids.lateTaskAssignment, isOverdue: true, state: 'NOT_SUBMITTED', program: expect.objectContaining({ slug: 'live' }) }),
    ]);
    const list = (await http().get('/v1/assignments').set(as('student')).expect(200)).body.items as Array<{ id: string; isOverdue: boolean }>;
    expect(list.filter((a) => a.isOverdue).map((a) => a.id)).toEqual([ids.lateTaskAssignment]);
  });

  it("today's lesson and submission activity shows in the week", async () => {
    const week = (await home('student')).weeklyActivity;
    const today = week.days.find((d) => d.isToday)!;
    expect(today).toMatchObject({ isActive: true, isFuture: false, date: new Date().toISOString().slice(0, 10) });
    expect(week.activeDaysCount).toBe(1);
    expect(week.days[0].weekday).toBe('SAT');
    // Several actions in a row share 15-minute windows (at most 2 if the test crossed a boundary).
    const rows = await prisma.learningActivity.count({ where: { userId: ids.student } });
    expect(rows).toBeGreaterThanOrEqual(1);
    expect(rows).toBeLessThanOrEqual(2);
  });

  it('every kind of student action is logged, once per window; earlier days of the week count', async () => {
    const activity = app.get(ActivityService);
    const only = async (action: () => Promise<unknown>) => {
      await prisma.learningActivity.deleteMany({ where: { userId: ids.newcomer } });
      await action();
      return prisma.learningActivity.count({ where: { userId: ids.newcomer } });
    };
    await enroll('newcomer', 'second', EnrollmentStatus.ACTIVE);
    await enroll('newcomer', 'live', EnrollmentStatus.ACTIVE);

    expect(await only(() => progress('newcomer', 'secondReading', { completed: true }))).toBe(1);
    expect(
      await only(() => http().post(`/v1/assignments/${ids.taskAssignment}/submit`).set(as('newcomer')).send({ text: 'حل' }).expect(201)),
    ).toBe(1);
    // A failed attempt: logged as activity, and no lesson completed.
    expect(
      await only(() => http().post(`/v1/quizzes/${ids.secondQuizId}/attempts`).set(as('newcomer')).send({ answers: [] }).expect(201)),
    ).toBe(1);
    expect(
      await only(async () => {
        const at = new Date();
        await activity.record(ids.newcomer, at);
        await activity.record(ids.newcomer, at);
      }),
    ).toBe(1);

    // Activity at the very start of the week (from the log, not from today's actions).
    const before = await home('newcomer');
    const start = before.weeklyActivity.weekStart;
    await activity.record(ids.newcomer, new Date(`${start}T00:00:00Z`));
    const after = (await home('newcomer')).weeklyActivity;
    expect(after.days[0]).toMatchObject({ date: start, isActive: true });
    expect(after.activeDaysCount).toBe(new Set([start, new Date().toISOString().slice(0, 10)]).size);
  });

  it('incubator card shows the caller’s own application', async () => {
    await enroll('student', 'incubator', EnrollmentStatus.PENDING);
    const res = await home('student');
    expect(res.incubator).toMatchObject({ program: { slug: 'incubator' }, myEnrollmentStatus: 'PENDING' });
    expect(res.recommendedPrograms.map((p) => p.slug)).not.toContain('incubator');
    expect((await home('newcomer')).incubator!.myEnrollmentStatus).toBeNull();
  });

  it('is read-only: the stored progress cache is not written', async () => {
    await prisma.enrollment.updateMany({ where: { userId: ids.student }, data: { progressPct: 0 } });
    await home('student');
    const stored = await prisma.enrollment.findMany({ where: { userId: ids.student }, select: { progressPct: true } });
    expect(stored.every((e) => e.progressPct === 0)).toBe(true);
  });
});
