/**
 * Lessons (nodes) and quizzes against src/types/nodes.contract.ts.
 * WIPES the database: runs only when its name ends with `_test` (see assignments.e2e-spec.ts).
 */
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { EnrollmentStatus, GlobalRole, ProgramStatus } from '@prisma/client';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import type {
  AdminNodeDetail,
  AdminQuiz,
  AdminQuizAttemptDetail,
  AdminQuizAttemptList,
  NodeContent,
  QuizAttemptResult,
  StudentQuiz,
} from '../src/types/nodes.contract.js';

const dbName = new URL(process.env.DATABASE_URL ?? 'postgres://x/none').pathname.slice(1);
const storageDir = mkdtempSync(join(tmpdir(), 'nodes-e2e-'));
process.env.STORAGE_LOCAL_DIR = storageDir;
process.env.STORAGE_SIGNING_SECRET = 'e2e-secret';
process.env.PUBLIC_API_URL = 'http://localhost';

const PDF = Buffer.from('%PDF-1.4\n1 0 obj << /Type /Catalog >> endobj\ntrailer << /Root 1 0 R >>\n%%EOF\n');
const options = (correct: number) => [0, 1, 2, 3].map((i) => ({ text: `خيار ${i + 1}`, isCorrect: i === correct }));

describe.skipIf(!dbName.endsWith('_test'))('Nodes and quizzes (e2e, nodes.contract.ts)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const tokens: Record<string, string> = {};
  const ids: Record<string, string> = {};
  let quiz: AdminQuiz;

  const http = () => request(app.getHttpServer());
  const as = (who: string) => ({ Authorization: `Bearer ${tokens[who]}` });

  async function createUser(key: string, role: GlobalRole) {
    const user = await prisma.user.create({ data: { email: `${key}@e2e.test`, passwordHash: 'x', globalRole: role } });
    ids[key] = user.id;
    tokens[key] = app.get(JwtService).sign({ sub: user.id, email: user.email, globalRole: role });
  }

  const correctOf = (q: AdminQuiz['questions'][number]) => q.options.find((o) => o.isCorrect)!.id;
  const wrongOf = (q: AdminQuiz['questions'][number]) => q.options.find((o) => !o.isCorrect)!.id;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);

    await prisma.$executeRawUnsafe(
      'TRUNCATE "Submission", "AssignmentAttachment", "Assignment", "QuizAttempt", "QuizOption", "QuizQuestion", "Quiz", "NodeResource", "ProgressLog", "VideoAsset", "ActivityNode", "Module", "Track", "Enrollment", "Program", "UserSession", "UserProfile", "Notification", "User" CASCADE',
    );
    await createUser('admin', GlobalRole.SUPER_ADMIN);
    await createUser('instructor', GlobalRole.INSTRUCTOR);
    await createUser('student', GlobalRole.STUDENT);
    await createUser('outsider', GlobalRole.STUDENT);

    const program = await prisma.program.create({
      data: {
        title: 'Program',
        slug: 'nodes-program',
        status: ProgramStatus.ONGOING,
        tracks: { create: { title: 'T', modules: { create: { title: 'M' } } } },
      },
      include: { tracks: { include: { modules: true } } },
    });
    ids.module = program.tracks[0].modules[0].id;
    await prisma.enrollment.create({ data: { userId: ids.student, programId: program.id, status: EnrollmentStatus.ACTIVE } });
  });

  afterAll(async () => {
    await app?.close();
    rmSync(storageDir, { recursive: true, force: true });
  });

  it('manages only QUIZ, VIDEO_LECTURE and READING_MATERIAL lessons, with role guards', async () => {
    const live = await http().post('/v1/admin/nodes').set(as('instructor')).send({ moduleId: ids.module, type: 'LIVE_SESSION', title: 'x' }).expect(400);
    expect(live.body.details.type).toBeDefined();
    await http().post('/v1/admin/nodes').set(as('student')).send({ moduleId: ids.module, type: 'QUIZ', title: 'x' }).expect(403);

    const noVideo = await http().post('/v1/admin/nodes').set(as('instructor')).send({ moduleId: ids.module, type: 'VIDEO_LECTURE', title: 'v' }).expect(400);
    expect(noVideo.body.details.video).toBeDefined();
    const linkOnQuiz = await http()
      .post('/v1/admin/nodes')
      .set(as('instructor'))
      .send({ moduleId: ids.module, type: 'QUIZ', title: 'q', link: 'https://docs.example/x' })
      .expect(400);
    expect(linkOnQuiz.body.details.link).toBeDefined();

    const video = await http()
      .post('/v1/admin/nodes')
      .set(as('instructor'))
      .send({ moduleId: ids.module, type: 'VIDEO_LECTURE', title: 'مقدمة', video: { playbackUrl: 'https://iframe.mediadelivery.net/embed/1/abc', durationSec: 300 } })
      .expect(201);
    expect((video.body as AdminNodeDetail).video).toMatchObject({ externalId: 'abc', durationSec: 300 });
    ids.video = video.body.id;

    const reading = await http()
      .post('/v1/admin/nodes')
      .set(as('instructor'))
      .send({ moduleId: ids.module, type: 'READING_MATERIAL', title: 'قراءة', link: 'https://docs.example/read' })
      .expect(201);
    expect(reading.body).toMatchObject({ orderIndex: 1, resource: { kind: 'LINK', url: 'https://docs.example/read' } });
    ids.reading = reading.body.id;

    const list = await http().get('/v1/admin/nodes').query({ moduleId: ids.module }).set(as('admin')).expect(200);
    expect((list.body as AdminNodeDetail[]).map((n) => n.type)).toEqual(['VIDEO_LECTURE', 'READING_MATERIAL']);
  });

  it('stores reading files privately and serves them to enrolled learners only', async () => {
    const up = await http()
      .post(`/v1/admin/nodes/${ids.reading}/file`)
      .set(as('instructor'))
      .attach('file', PDF, 'الدرس الأول.pdf')
      .expect(201);
    expect(up.body.resource).toMatchObject({ kind: 'FILE', fileName: 'الدرس الأول.pdf', mimeType: 'application/pdf' });

    await http().get(`/v1/nodes/${ids.reading}`).set(as('outsider')).expect(404);
    const content = (await http().get(`/v1/nodes/${ids.reading}`).set(as('student')).expect(200)).body as NodeContent;
    expect(content).toMatchObject({ type: 'READING_MATERIAL', program: { slug: 'nodes-program' }, quiz: null });
    const url = new URL(content.resource!.url);
    const file = await http().get(url.pathname + url.search).buffer(true).expect(200);
    expect(Buffer.compare(file.body, PDF)).toBe(0);

    await http().post(`/v1/admin/nodes/${ids.video}/file`).set(as('instructor')).attach('file', PDF, 'x.pdf').expect(400);
  });

  it('builds a quiz: 4 options, one correct, publish only when complete', async () => {
    const node = await http()
      .post('/v1/admin/nodes')
      .set(as('instructor'))
      .send({ moduleId: ids.module, type: 'QUIZ', title: 'اختبار الوحدة', quiz: { passingScore: 3, maxAttempts: 2 } })
      .expect(201);
    ids.quizNode = node.body.id;
    ids.quiz = node.body.quiz.id;
    expect(node.body.quiz).toMatchObject({ isPublished: false, questionCount: 0, passingScore: 3 });

    const notReady = await http().patch(`/v1/admin/quizzes/${ids.quiz}`).set(as('instructor')).send({ isPublished: true }).expect(409);
    expect(notReady.body.code).toBe('QUIZ_NOT_READY');

    const three = await http()
      .post(`/v1/admin/quizzes/${ids.quiz}/questions`)
      .set(as('instructor'))
      .send({ text: 'س', options: options(0).slice(0, 3) })
      .expect(400);
    expect(three.body.details.options).toBeDefined();
    const twoCorrect = await http()
      .post(`/v1/admin/quizzes/${ids.quiz}/questions`)
      .set(as('instructor'))
      .send({ text: 'س', options: options(0).map((o, i) => ({ ...o, isCorrect: i < 2 })) })
      .expect(400);
    expect(twoCorrect.body.details.options).toBeDefined();

    await http().post(`/v1/admin/quizzes/${ids.quiz}/questions`).set(as('instructor')).send({ text: 'السؤال الأول', points: 2, explanation: 'لأن…', options: options(1) }).expect(201);
    const second = await http().post(`/v1/admin/quizzes/${ids.quiz}/questions`).set(as('instructor')).send({ text: 'السؤال الثاني', points: 3, options: options(2) }).expect(201);
    expect((second.body as AdminQuiz).totalScore).toBe(5);

    // Hidden from learners until published.
    await http().get(`/v1/quizzes/${ids.quiz}`).set(as('student')).expect(404);
    const before = (await http().get('/v1/programs/nodes-program').set(as('student')).expect(200)).body;
    expect(JSON.stringify(before)).not.toContain(ids.quizNode);

    const published = await http().patch(`/v1/admin/quizzes/${ids.quiz}`).set(as('instructor')).send({ isPublished: true }).expect(200);
    quiz = published.body;
    expect(quiz).toMatchObject({ isPublished: true, isLocked: false, questions: [{ points: 2 }, { points: 3 }] });

    const tooHigh = await http().patch(`/v1/admin/quizzes/${ids.quiz}`).set(as('instructor')).send({ passingScore: 6 }).expect(409);
    expect(tooHigh.body.code).toBe('QUIZ_NOT_READY');
  });

  it('never sends isCorrect to learners', async () => {
    const res = await http().get(`/v1/quizzes/${ids.quiz}`).set(as('student')).expect(200);
    const body = res.body as StudentQuiz;
    expect(JSON.stringify(body)).not.toContain('isCorrect');
    expect(body).toMatchObject({ questionCount: 2, totalScore: 5, passingScore: 3, attemptsUsed: 0, attemptsRemaining: 2 });
    expect(body.questions[0].options).toHaveLength(4);
    expect(Object.keys(body.questions[0].options[0]).sort()).toEqual(['id', 'text']);

    const content = (await http().get(`/v1/nodes/${ids.quizNode}`).set(as('student')).expect(200)).body as NodeContent;
    expect(content.quiz).toMatchObject({ id: ids.quiz, passed: false });
    expect(JSON.stringify(content)).not.toContain('isCorrect');
    await http().get(`/v1/quizzes/${ids.quiz}`).set(as('outsider')).expect(404);
  });

  it('validates answers and grades by question weight', async () => {
    const [q1, q2] = quiz.questions;
    const unknown = await http().post(`/v1/quizzes/${ids.quiz}/attempts`).set(as('student')).send({ answers: [{ questionId: 'nope', optionId: null }] }).expect(400);
    expect(unknown.body.code).toBe('VALIDATION_FAILED');
    await http()
      .post(`/v1/quizzes/${ids.quiz}/attempts`)
      .set(as('student'))
      .send({ answers: [{ questionId: q1.id, optionId: correctOf(q2) }] })
      .expect(400);

    // Staff preview: graded, not saved.
    const preview = (await http()
      .post(`/v1/quizzes/${ids.quiz}/attempts`)
      .set(as('instructor'))
      .send({ answers: [{ questionId: q1.id, optionId: correctOf(q1) }] })
      .expect(201)).body as QuizAttemptResult;
    expect(preview).toMatchObject({ id: null, score: 2 });

    // Q1 right (2 points), Q2 wrong: 2 / 5, passing score 3 -> failed.
    const first = (await http()
      .post(`/v1/quizzes/${ids.quiz}/attempts`)
      .set(as('student'))
      .send({ answers: [{ questionId: q1.id, optionId: correctOf(q1) }, { questionId: q2.id, optionId: wrongOf(q2) }] })
      .expect(201)).body as QuizAttemptResult;
    expect(first).toMatchObject({ score: 2, totalScore: 5, percentage: 40, passed: false, correctCount: 1, attemptNumber: 1, attemptsRemaining: 1 });
    expect(first.questions[0]).toMatchObject({ isCorrect: true, pointsAwarded: 2, correctOptionId: correctOf(q1), explanation: 'لأن…' });
    expect(first.questions[1]).toMatchObject({ isCorrect: false, pointsAwarded: 0, correctOptionId: correctOf(q2) });
    ids.firstAttempt = first.id!;

    // Unanswered Q2 still counts: 2 + 3 with both right -> passed, lesson completed.
    const second = (await http()
      .post(`/v1/quizzes/${ids.quiz}/attempts`)
      .set(as('student'))
      .send({ answers: [{ questionId: q1.id, optionId: correctOf(q1) }, { questionId: q2.id, optionId: correctOf(q2) }] })
      .expect(201)).body as QuizAttemptResult;
    expect(second).toMatchObject({ score: 5, passed: true, attemptNumber: 2, attemptsRemaining: 0 });

    const third = await http().post(`/v1/quizzes/${ids.quiz}/attempts`).set(as('student')).send({ answers: [] }).expect(409);
    expect(third.body.code).toBe('MAX_ATTEMPTS_REACHED');

    const content = (await http().get(`/v1/nodes/${ids.quizNode}`).set(as('student')).expect(200)).body as NodeContent;
    expect(content).toMatchObject({ isCompleted: true, quiz: { passed: true, bestScore: 5, attemptsUsed: 2 } });

    const mine = await http().get(`/v1/quizzes/${ids.quiz}/attempts`).set(as('student')).expect(200);
    expect(mine.body.map((a: { attemptNumber: number }) => a.attemptNumber)).toEqual([2, 1]);
    await http().get(`/v1/quizzes/attempts/${ids.firstAttempt}`).set(as('outsider')).expect(404);
  });

  it('hides correct answers in results when the quiz says so', async () => {
    await http().patch(`/v1/admin/quizzes/${ids.quiz}`).set(as('instructor')).send({ showCorrectAnswers: false }).expect(200);
    const res = (await http().get(`/v1/quizzes/attempts/${ids.firstAttempt}`).set(as('student')).expect(200)).body as QuizAttemptResult;
    expect(res.showCorrectAnswers).toBe(false);
    expect(res.questions.every((q) => q.correctOptionId === null && q.explanation === null)).toBe(true);
    expect(res.questions[1].isCorrect).toBe(false);
  });

  it('locks scoring once attempted, keeps wording editable, and reviews attempts', async () => {
    const [q1] = quiz.questions;
    const add = await http().post(`/v1/admin/quizzes/${ids.quiz}/questions`).set(as('instructor')).send({ text: 'جديد', options: options(0) }).expect(409);
    expect(add.body.code).toBe('QUIZ_HAS_ATTEMPTS');
    await http().patch(`/v1/admin/quizzes/questions/${q1.id}`).set(as('instructor')).send({ options: options(3) }).expect(409);
    await http().patch(`/v1/admin/quizzes/questions/${q1.id}`).set(as('instructor')).send({ points: 4 }).expect(409);
    await http().patch(`/v1/admin/quizzes/${ids.quiz}`).set(as('instructor')).send({ passingScore: 4 }).expect(409);
    await http().delete(`/v1/admin/quizzes/questions/${q1.id}`).set(as('instructor')).expect(409);

    const reworded = await http()
      .patch(`/v1/admin/quizzes/questions/${q1.id}`)
      .set(as('instructor'))
      .send({ text: 'السؤال الأول (مُعدّل)', options: options(1).map((o) => ({ ...o, text: `${o.text}!` })) })
      .expect(200);
    expect(reworded.body.isLocked).toBe(true);
    expect((reworded.body as AdminQuiz).questions[0]).toMatchObject({ text: 'السؤال الأول (مُعدّل)', points: 2 });
    expect(reworded.body.questions[0].options[1]).toMatchObject({ text: 'خيار 2!', isCorrect: true });

    const list = (await http().get(`/v1/admin/quizzes/${ids.quiz}/attempts`).set(as('instructor')).expect(200)).body as AdminQuizAttemptList;
    expect(list).toMatchObject({ total: 2, stats: { attempts: 2, students: 1, passedStudents: 1, averagePercentage: 70 } });
    const passed = await http().get(`/v1/admin/quizzes/${ids.quiz}/attempts`).query({ passed: 'false' }).set(as('instructor')).expect(200);
    expect(passed.body.total).toBe(1);
    const detail = (await http().get(`/v1/admin/quizzes/attempts/${ids.firstAttempt}`).set(as('instructor')).expect(200)).body as AdminQuizAttemptDetail;
    expect(detail.questions[1].correctOptionId).not.toBeNull(); // admins always see answers

    const del = await http().delete(`/v1/admin/nodes/${ids.quizNode}`).set(as('admin')).expect(409);
    expect(del.body.code).toBe('QUIZ_HAS_ATTEMPTS');
    const mod = await http().delete(`/v1/admin/programs/modules/${ids.module}`).set(as('admin')).expect(409);
    expect(mod.body.code).toBe('QUIZ_HAS_ATTEMPTS');
    await http().delete(`/v1/admin/nodes/${ids.reading}`).set(as('instructor')).expect(403);
    await http().delete(`/v1/admin/nodes/${ids.reading}`).set(as('admin')).expect(204);
  });
});
