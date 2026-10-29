/**
 * Lesson completion and program progress (docs/updates/01-program-progress.md).
 * WIPES the database: runs only when its name ends with `_test` (see assignments.e2e-spec.ts).
 */
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { AssignmentStatus, EnrollmentStatus, GlobalRole, NodeType, ProgramStatus, SubmissionType } from '@prisma/client';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import type { MyEnrollment, ProgramDetail } from '../src/types/api.contract.js';
import type { LessonProgressResult, NodeContent } from '../src/types/nodes.contract.js';

const dbName = new URL(process.env.DATABASE_URL ?? 'postgres://x/none').pathname.slice(1);
const storageDir = mkdtempSync(join(tmpdir(), 'progress-e2e-'));
process.env.STORAGE_LOCAL_DIR = storageDir;
process.env.STORAGE_SIGNING_SECRET = 'e2e-secret';
process.env.PUBLIC_API_URL = 'http://localhost';

describe.skipIf(!dbName.endsWith('_test'))('Program progress (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const tokens: Record<string, string> = {};
  const ids: Record<string, string> = {};

  const http = () => request(app.getHttpServer());
  const as = (who: string) => ({ Authorization: `Bearer ${tokens[who]}` });
  const progressOf = async () =>
    ((await http().get('/v1/programs/progress-program').set(as('student')).expect(200)).body as ProgramDetail).myEnrollment!;

  async function node(key: string, type: NodeType, extra: Record<string, unknown> = {}) {
    const n = await prisma.activityNode.create({ data: { moduleId: ids.module, title: key, type, ...extra } });
    ids[key] = n.id;
    return n;
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);

    await prisma.$executeRawUnsafe(
      'TRUNCATE "Submission", "AssignmentAttachment", "Assignment", "QuizAttempt", "QuizOption", "QuizQuestion", "Quiz", "NodeResource", "ProgressLog", "VideoAsset", "ActivityNode", "Module", "Track", "Enrollment", "Program", "UserSession", "UserProfile", "Notification", "User" CASCADE',
    );
    for (const [k, role] of [['student', GlobalRole.STUDENT], ['admin', GlobalRole.SUPER_ADMIN]] as const) {
      const u = await prisma.user.create({ data: { email: `${k}@e2e.test`, passwordHash: 'x', globalRole: role } });
      ids[k] = u.id;
      tokens[k] = app.get(JwtService).sign({ sub: u.id, email: u.email, globalRole: role });
    }
    const program = await prisma.program.create({
      data: { title: 'P', slug: 'progress-program', status: ProgramStatus.ONGOING, tracks: { create: { title: 'T', modules: { create: { title: 'M' } } } } },
      include: { tracks: { include: { modules: true } } },
    });
    ids.module = program.tracks[0].modules[0].id;
    ids.enrollment = (await prisma.enrollment.create({ data: { userId: ids.student, programId: program.id, status: EnrollmentStatus.ACTIVE } })).id;

    // Counted: video, reading, published quiz, published assignment. Not counted: optional
    // reading, unpublished quiz, draft assignment.
    await node('video', NodeType.VIDEO_LECTURE, { video: { create: { externalId: 'v', playbackUrl: 'https://v.example/1', durationSec: 600 } } });
    await node('reading', NodeType.READING_MATERIAL);
    await node('optional', NodeType.READING_MATERIAL, { isMandatory: false });
    await node('quiz', NodeType.QUIZ, {
      quiz: {
        create: {
          title: 'Q',
          passingScore: 1,
          isPublished: true,
          questions: {
            create: {
              text: 'q',
              points: 1,
              options: { create: [0, 1, 2, 3].map((i) => ({ text: `o${i}`, isCorrect: i === 0, orderIndex: i })) },
            },
          },
        },
      },
    });
    await node('draftQuiz', NodeType.QUIZ, { quiz: { create: { title: 'D' } } });
    await node('assignment', NodeType.ASSIGNMENT, {
      assignment: { create: { instructions: 'x', allowedType: SubmissionType.TEXT_CONTENT, status: AssignmentStatus.PUBLISHED, publishedAt: new Date() } },
    });
    await node('draftAssignment', NodeType.ASSIGNMENT, { assignment: { create: { instructions: 'x' } } });
  });

  afterAll(async () => {
    await app?.close();
    rmSync(storageDir, { recursive: true, force: true });
  });

  it('starts at 0 of the 4 counted lessons', async () => {
    expect(await progressOf()).toMatchObject({ completedLessons: 0, totalLessons: 4, progressPct: 0 });
  });

  it('video: position is saved, completes at 90%', async () => {
    const half = (await http().post(`/v1/nodes/${ids.video}/progress`).set(as('student')).send({ positionSec: 300 }).expect(200))
      .body as LessonProgressResult;
    expect(half).toMatchObject({ isCompleted: false, completionPct: 50, lastPositionSec: 300, recorded: true, programProgress: { percent: 0 } });

    // Seeking back keeps the furthest point reached.
    await http().post(`/v1/nodes/${ids.video}/progress`).set(as('student')).send({ positionSec: 120 }).expect(200);
    const content = (await http().get(`/v1/nodes/${ids.video}`).set(as('student')).expect(200)).body as NodeContent;
    expect(content.progress).toEqual({ isCompleted: false, completionPct: 50, lastPositionSec: 120, watchedSeconds: 300 });

    const done = (await http().post(`/v1/nodes/${ids.video}/progress`).set(as('student')).send({ positionSec: 545 }).expect(200))
      .body as LessonProgressResult;
    expect(done).toMatchObject({ isCompleted: true, completionPct: 100, programProgress: { completedLessons: 1, totalLessons: 4, percent: 25 } });

    // Never un-completed.
    const again = await http().post(`/v1/nodes/${ids.video}/progress`).set(as('student')).send({ positionSec: 10 }).expect(200);
    expect(again.body.isCompleted).toBe(true);
  });

  it('reading: marked done; optional lessons do not count', async () => {
    await http().post(`/v1/nodes/${ids.reading}/progress`).set(as('student')).send({ positionSec: 5 }).expect(400);
    const res = await http().post(`/v1/nodes/${ids.reading}/progress`).set(as('student')).send({ completed: true }).expect(200);
    expect(res.body.programProgress).toMatchObject({ completedLessons: 2, percent: 50 });

    const optional = await http().post(`/v1/nodes/${ids.optional}/progress`).set(as('student')).send({ completed: true }).expect(200);
    expect(optional.body.programProgress).toMatchObject({ completedLessons: 2, totalLessons: 4, percent: 50 });

    const detail = (await http().get('/v1/programs/progress-program').set(as('student')).expect(200)).body as ProgramDetail;
    const ticks = Object.fromEntries(detail.tracks[0].modules[0].nodes.map((n) => [n.title, n.isCompleted]));
    expect(ticks).toEqual({ video: true, reading: true, optional: true, quiz: false, assignment: false });
  });

  it('quiz and assignment lessons complete through their own flows', async () => {
    const manual = await http().post(`/v1/nodes/${ids.quiz}/progress`).set(as('student')).send({ completed: true }).expect(400);
    expect(manual.body.code).toBe('VALIDATION_FAILED');

    const quiz = await prisma.quiz.findUniqueOrThrow({ where: { nodeId: ids.quiz }, include: { questions: { include: { options: true } } } });
    const q = quiz.questions[0];
    await http()
      .post(`/v1/quizzes/${quiz.id}/attempts`)
      .set(as('student'))
      .send({ answers: [{ questionId: q.id, optionId: q.options.find((o) => o.isCorrect)!.id }] })
      .expect(201);
    expect(await progressOf()).toMatchObject({ completedLessons: 3, progressPct: 75 });

    const assignment = await prisma.assignment.findUniqueOrThrow({ where: { nodeId: ids.assignment } });
    const sub = await http().post(`/v1/assignments/${assignment.id}/submit`).set(as('student')).send({ text: 'إجابة' }).expect(201);
    await http().patch(`/v1/admin/submissions/${sub.body.id}/grade`).set(as('admin')).send({ status: 'GRADED', score: 90 }).expect(200);

    const mine = (await http().get('/v1/enrollments/my-enrollments').set(as('student')).expect(200)).body as MyEnrollment[];
    expect(mine[0]).toMatchObject({ completedLessons: 4, totalLessons: 4, progressPct: 100 });
    // The stored column follows (used by anything reading Enrollment.progressPct).
    expect((await prisma.enrollment.findUniqueOrThrow({ where: { id: ids.enrollment } })).progressPct).toBe(100);

    const admin = await http().get(`/v1/admin/enrollments/${ids.enrollment}`).set(as('admin')).expect(200);
    expect(admin.body).toMatchObject({ progressPct: 100, completedLessons: 4, totalLessons: 4 });
  });

  it('adding a lesson lowers the percentage; staff previews are not recorded', async () => {
    await node('extra', NodeType.READING_MATERIAL);
    expect(await progressOf()).toMatchObject({ completedLessons: 4, totalLessons: 5, progressPct: 80 });

    const staff = await http().post(`/v1/nodes/${ids.extra}/progress`).set(as('admin')).send({ completed: true }).expect(200);
    expect(staff.body).toMatchObject({ recorded: false, programProgress: null });
    expect(await prisma.progressLog.count({ where: { userId: ids.admin } })).toBe(0);
  });
});
