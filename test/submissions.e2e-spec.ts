/**
 * Assignment submissions and grading against src/types/submissions.contract.ts.
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
import type { AdminSubmissionList, MySubmissionResponse, SubmissionView } from '../src/types/submissions.contract.js';

const dbName = new URL(process.env.DATABASE_URL ?? 'postgres://x/none').pathname.slice(1);
const storageDir = mkdtempSync(join(tmpdir(), 'submissions-e2e-'));
process.env.STORAGE_LOCAL_DIR = storageDir;
process.env.STORAGE_SIGNING_SECRET = 'e2e-secret';
process.env.PUBLIC_API_URL = 'http://localhost';

const DAY = 24 * 60 * 60 * 1000;
const PDF = Buffer.from('%PDF-1.4\n1 0 obj << /Type /Catalog >> endobj\ntrailer << /Root 1 0 R >>\n%%EOF\n');
const PNG = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c6360000002000100e221bc330000000049454e44ae426082', 'hex');
const EXE = Buffer.concat([Buffer.from('MZ'), Buffer.alloc(62), Buffer.from('PE\0\0'), Buffer.alloc(200)]);

describe.skipIf(!dbName.endsWith('_test'))('Assignment submissions (e2e, submissions.contract.ts)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const tokens: Record<string, string> = {};
  const ids: Record<string, string> = {};

  const http = () => request(app.getHttpServer());
  const as = (who: string) => ({ Authorization: `Bearer ${tokens[who]}` });

  async function createUser(key: string, role: GlobalRole) {
    const user = await prisma.user.create({
      data: { email: `${key}@e2e.test`, passwordHash: 'x', globalRole: role, profile: { create: { firstName: key, lastName: 'Test' } } },
    });
    ids[key] = user.id;
    tokens[key] = app.get(JwtService).sign({ sub: user.id, email: user.email, globalRole: role });
  }

  async function createAssignment(key: string, allowedType: SubmissionType, extra: { dueDate?: Date; status?: AssignmentStatus } = {}) {
    const node = await prisma.activityNode.create({ data: { moduleId: ids.module, title: `واجب ${key}`, type: NodeType.ASSIGNMENT } });
    const a = await prisma.assignment.create({
      data: {
        nodeId: node.id,
        instructions: 'x',
        allowedType,
        maxScore: 10,
        dueDate: extra.dueDate ?? new Date(Date.now() + 7 * DAY),
        status: extra.status ?? AssignmentStatus.PUBLISHED,
        publishedAt: new Date(),
      },
    });
    ids[key] = a.id;
    ids[`${key}Node`] = node.id;
  }

  const submitJson = (who: string, key: string, body: object) => http().post(`/v1/assignments/${ids[key]}/submit`).set(as(who)).send(body);

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);

    await prisma.$executeRawUnsafe(
      'TRUNCATE "Submission", "AssignmentAttachment", "Assignment", "QuizAttempt", "QuizOption", "QuizQuestion", "Quiz", "NodeResource", "ProgressLog", "VideoAsset", "ActivityNode", "Module", "Track", "Enrollment", "Program", "UserSession", "UserProfile", "Notification", "User" CASCADE',
    );
    for (const [k, r] of [
      ['admin', GlobalRole.SUPER_ADMIN],
      ['instructor', GlobalRole.INSTRUCTOR],
      ['mentor', GlobalRole.MENTOR],
      ['student', GlobalRole.STUDENT],
      ['other', GlobalRole.STUDENT],
      ['outsider', GlobalRole.STUDENT],
    ] as const) {
      await createUser(k, r);
    }
    const program = await prisma.program.create({
      data: { title: 'P', slug: 'sub-program', status: ProgramStatus.ONGOING, tracks: { create: { title: 'T', modules: { create: { title: 'M' } } } } },
      include: { tracks: { include: { modules: true } } },
    });
    ids.module = program.tracks[0].modules[0].id;
    for (const k of ['student', 'other']) {
      await prisma.enrollment.create({ data: { userId: ids[k], programId: program.id, status: EnrollmentStatus.ACTIVE } });
    }
    await createAssignment('link', SubmissionType.URL_LINK);
    await createAssignment('text', SubmissionType.TEXT_CONTENT);
    await createAssignment('file', SubmissionType.FILE_UPLOAD);
    await createAssignment('media', SubmissionType.MULTIMEDIA);
    await createAssignment('late', SubmissionType.TEXT_CONTENT, { dueDate: new Date(Date.now() - DAY) });
    await createAssignment('draft', SubmissionType.TEXT_CONTENT, { status: AssignmentStatus.DRAFT });
  });

  afterAll(async () => {
    await app?.close();
    rmSync(storageDir, { recursive: true, force: true });
  });

  it('URL_LINK: JSON submit, then locked while awaiting review', async () => {
    const res = await submitJson('student', 'link', { links: ['https://github.com/sara/app'], text: 'ملاحظة' }).expect(201);
    const view = res.body as SubmissionView;
    expect(view).toMatchObject({
      status: 'SUBMITTED',
      attemptNumber: 1,
      isLate: false,
      score: null,
      maxScore: 10,
      reviewedAt: null,
      content: { type: 'URL_LINK', links: ['https://github.com/sara/app'], text: 'ملاحظة', files: [] },
    });
    ids.linkSubmission = view.id;

    const again = await submitJson('student', 'link', { links: ['https://github.com/sara/app2'] }).expect(409);
    expect(again.body.code).toBe('SUBMISSION_LOCKED');

    const bad = await submitJson('other', 'link', { links: ['javascript:alert(1)'] }).expect(400);
    expect(bad.body.code).toBe('VALIDATION_FAILED');
    const two = await submitJson('other', 'link', { links: ['https://a.example/1', 'https://a.example/2'] }).expect(400);
    expect(two.body.details.links).toBeDefined();
  });

  it('TEXT_CONTENT: requires text, refuses links and files', async () => {
    const missing = await submitJson('student', 'text', {}).expect(400);
    expect(missing.body.details.text).toBeDefined();
    const withLink = await submitJson('student', 'text', { text: 'إجابة', links: ['https://x.example/a'] }).expect(400);
    expect(withLink.body.details.links).toBeDefined();
    const withFile = await http()
      .post(`/v1/assignments/${ids.text}/submit`)
      .set(as('student'))
      .field('text', 'إجابة')
      .attach('files', PDF, 'a.pdf')
      .expect(400);
    expect(withFile.body.details.files).toBeDefined();

    const ok = await submitJson('student', 'text', { text: '  الإجابة النهائية  ' }).expect(201);
    expect(ok.body.content).toMatchObject({ type: 'TEXT_CONTENT', text: 'الإجابة النهائية' });
  });

  it('FILE_UPLOAD: multipart files with real type checks; storage keys never leak', async () => {
    const none = await http().post(`/v1/assignments/${ids.file}/submit`).set(as('student')).field('text', 'x').expect(400);
    expect(none.body.details.files).toBeDefined();
    const exe = await http().post(`/v1/assignments/${ids.file}/submit`).set(as('student')).attach('files', EXE, 'cv.pdf').expect(415);
    expect(exe.body.code).toBe('UNSUPPORTED_FILE_TYPE');

    const res = await http()
      .post(`/v1/assignments/${ids.file}/submit`)
      .set(as('student'))
      .field('text', 'مرفق الحل')
      .attach('files', PDF, 'الحل.pdf')
      .attach('files', PNG, 'لقطة.png')
      .expect(201);
    const view = res.body as SubmissionView;
    expect(view.content.files.map((f) => [f.fileName, f.mimeType])).toEqual([
      ['الحل.pdf', 'application/pdf'],
      ['لقطة.png', 'image/png'],
    ]);
    expect(JSON.stringify(view)).not.toContain('storageKey');
    expect(JSON.stringify(view)).not.toContain('submissions/');
    const url = new URL(view.content.files[0].url);
    const file = await http().get(url.pathname + url.search).buffer(true).expect(200);
    expect(Buffer.compare(file.body, PDF)).toBe(0);

    // Nothing stored for the refused upload, and the failed attempt did not count.
    const mine = (await http().get(`/v1/assignments/${ids.file}/my-submission`).set(as('student')).expect(200)).body as MySubmissionResponse;
    expect(mine.attempts).toHaveLength(1);
  });

  it('MULTIMEDIA: at least one link or file', async () => {
    const empty = await submitJson('student', 'media', { text: 'فقط نص' }).expect(400);
    expect(empty.body.details.links).toBeDefined();
    const ok = await submitJson('student', 'media', { links: ['https://youtu.be/abc', 'https://drive.example/v'] }).expect(201);
    expect(ok.body.content.links).toHaveLength(2);
  });

  it('access: not enrolled, draft, late flag, old path', async () => {
    await submitJson('outsider', 'link', { links: ['https://x.example'] }).expect(404);
    await submitJson('student', 'draft', { text: 'x' }).expect(404);
    await http().get(`/v1/assignments/${ids.link}/my-submission`).set(as('outsider')).expect(404);
    await http().post(`/v1/assignments/${ids.link}/submit`).send({ links: ['https://x.example'] }).expect(401);

    const late = await submitJson('student', 'late', { text: 'متأخر' }).expect(201);
    expect(late.body.isLate).toBe(true);

    const legacy = await http().get(`/assignments/${ids.late}/my-submission`).set(as('student')).expect(200);
    expect(legacy.body).toMatchObject({ canSubmit: false, submitBlockReason: 'AWAITING_REVIEW', latest: { isLate: true } });
  });

  it('reviewers list, grade and request revisions; the student resubmits', async () => {
    await http().get(`/v1/admin/assignments/${ids.link}/submissions`).set(as('student')).expect(403);
    await http().get(`/v1/admin/assignments/${ids.link}/submissions`).set(as('mentor')).expect(403);

    await submitJson('other', 'link', { links: ['https://github.com/other/app'] }).expect(201);
    const list = (await http().get(`/v1/admin/assignments/${ids.link}/submissions`).set(as('instructor')).expect(200)).body as AdminSubmissionList;
    expect(list).toMatchObject({ total: 2, statusCounts: { SUBMITTED: 2 } });
    expect(list.items[0]).toMatchObject({ student: { email: 'student@e2e.test' }, assignment: { maxScore: 10 }, grader: null });

    // Revision requested: the student may hand in again, as a new attempt.
    const revise = await http()
      .patch(`/v1/admin/submissions/${ids.linkSubmission}/grade`)
      .set(as('instructor'))
      .send({ status: 'NEEDS_REVISION', feedback: 'أضف ملف README' })
      .expect(200);
    expect(revise.body).toMatchObject({ status: 'NEEDS_REVISION', feedback: 'أضف ملف README', grader: { id: ids.instructor } });
    expect(revise.body.reviewedAt).not.toBeNull();

    const second = await submitJson('student', 'link', { links: ['https://github.com/sara/app-v2'] }).expect(201);
    expect(second.body.attemptNumber).toBe(2);

    const latest = (await http().get(`/v1/admin/assignments/${ids.link}/submissions`).set(as('instructor')).expect(200)).body as AdminSubmissionList;
    expect(latest.total).toBe(2); // one row per student
    const all = (await http().get(`/v1/admin/assignments/${ids.link}/submissions`).query({ latestOnly: 'false' }).set(as('instructor')).expect(200))
      .body as AdminSubmissionList;
    expect(all.total).toBe(3);
    const filtered = await http().get(`/v1/admin/assignments/${ids.link}/submissions`).query({ q: 'OTHER@' }).set(as('instructor')).expect(200);
    expect(filtered.body.total).toBe(1);

    // Grading rules.
    const noScore = await http().patch(`/v1/admin/submissions/${second.body.id}/grade`).set(as('admin')).send({ status: 'GRADED' }).expect(400);
    expect(noScore.body.details.score).toBeDefined();
    const tooHigh = await http().patch(`/v1/admin/submissions/${second.body.id}/grade`).set(as('admin')).send({ status: 'GRADED', score: 11 }).expect(400);
    expect(tooHigh.body.details.score).toBeDefined();
    await http().patch(`/v1/admin/submissions/${second.body.id}/grade`).set(as('admin')).send({ status: 'SUBMITTED' }).expect(400);

    const graded = await http()
      .patch(`/v1/admin/submissions/${second.body.id}/grade`)
      .set(as('admin'))
      .send({ status: 'GRADED', score: 8.5, feedback: 'عمل ممتاز' })
      .expect(200);
    expect(graded.body).toMatchObject({ status: 'GRADED', score: 8.5 });

    const progress = await prisma.progressLog.findUnique({ where: { userId_nodeId: { userId: ids.student, nodeId: ids.linkNode } } });
    expect(progress?.isCompleted).toBe(true);
    const notes = await prisma.notification.findMany({ where: { userId: ids.student }, orderBy: { createdAt: 'asc' } });
    expect(notes.map((n) => n.title)).toEqual(['واجبك يحتاج إلى تعديل', 'تم تقييم واجبك']);

    const mine = (await http().get(`/v1/assignments/${ids.link}/my-submission`).set(as('student')).expect(200)).body as MySubmissionResponse;
    expect(mine).toMatchObject({ canSubmit: false, submitBlockReason: 'GRADED', latest: { status: 'GRADED', score: 8.5, feedback: 'عمل ممتاز' } });
    expect(mine.attempts.map((a) => a.attemptNumber)).toEqual([2, 1]);

    // The student list reflects the latest attempt.
    const listItem = (await http().get('/v1/assignments').set(as('student')).expect(200)).body.items.find((i: { id: string }) => i.id === ids.link);
    expect(listItem.submission).toMatchObject({ status: 'GRADED', score: 8.5, attemptsCount: 2 });

    // maxScore cannot drop below an existing score (assignments rule still holds).
    await http().patch(`/v1/admin/assignments/${ids.link}`).set(as('admin')).send({ maxScore: 8 }).expect(409);

    const detail = await http().get(`/v1/admin/submissions/${second.body.id}`).set(as('instructor')).expect(200);
    expect(detail.body.content.links).toEqual(['https://github.com/sara/app-v2']);
    await http().get('/v1/admin/submissions/nope').set(as('instructor')).expect(404);
  });
});
