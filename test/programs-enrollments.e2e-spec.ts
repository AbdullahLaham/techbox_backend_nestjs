/**
 * Programs, curriculum and enrollments against src/types/api.contract.ts.
 *
 * Runs against a real database that it WIPES, so it refuses to run unless the
 * database name ends with `_test` (see test/assignments.e2e-spec.ts for the commands).
 */
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { GlobalRole, SubmissionStatus, UserStatus } from '@prisma/client';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import type {
  AdminEnrollmentDetail,
  AdminEnrollmentList,
  AdminProgram,
  AdminProgramDetail,
  MyEnrollment,
  ProgramDetail,
  ProgramSummary,
} from '../src/types/api.contract.js';

const dbName = new URL(process.env.DATABASE_URL ?? 'postgres://x/none').pathname.slice(1);
const storageDir = mkdtempSync(join(tmpdir(), 'programs-e2e-'));
process.env.STORAGE_LOCAL_DIR = storageDir;
process.env.STORAGE_SIGNING_SECRET = 'e2e-secret';
process.env.PUBLIC_API_URL = 'http://localhost';

const ADMIN = '/v1/admin/programs';
const DAY = 24 * 60 * 60 * 1000;
const JPG = Buffer.from('ffd8ffe000104a46494600010100000100010000ffdb004300' + '08'.repeat(64) + 'ffd9', 'hex');
const EXE = Buffer.concat([Buffer.from('MZ'), Buffer.alloc(62), Buffer.from('PE\0\0'), Buffer.alloc(200)]);
const APPLICATION = {
  fullNameEn: 'Sara Ahmad',
  fullNameAr: 'سارة أحمد محمد',
  age: '22',
  phoneWhatsApp: '+970599000000',
  nationalId: '401234567',
  governorate: 'غزة',
};

describe.skipIf(!dbName.endsWith('_test'))('Programs and enrollments (e2e, api.contract.ts)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const tokens: Record<string, string> = {};
  const ids: Record<string, string> = {};

  const http = () => request(app.getHttpServer());
  const as = (who: string) => ({ Authorization: `Bearer ${tokens[who]}` });

  async function createUser(key: string, role: GlobalRole, status: UserStatus = UserStatus.ACTIVE) {
    const user = await prisma.user.create({
      data: {
        email: `${key}@e2e.test`,
        passwordHash: 'x',
        globalRole: role,
        status,
        profile: { create: { firstName: key, lastName: 'Test' } },
      },
    });
    ids[key] = user.id;
    tokens[key] = app.get(JwtService).sign({ sub: user.id, email: user.email, globalRole: role });
  }

  async function createProgram(body: Record<string, unknown>): Promise<AdminProgram> {
    const res = await http().post(ADMIN).set(as('admin')).send({ title: 'برنامج تجريبي', ...body }).expect(201);
    return res.body;
  }

  function apply(who: string, programId: string, receipt?: { buffer: Buffer; name: string }) {
    const req = http().post(`/v1/enrollments/${programId}`).set(as(who));
    for (const [k, v] of Object.entries(APPLICATION)) req.field(k, v);
    if (receipt) req.attach('receipt', receipt.buffer, receipt.name);
    return req;
  }

  async function setStatus(enrollmentId: string, status: string, note?: string) {
    return http()
      .patch(`/v1/admin/enrollments/${enrollmentId}/status`)
      .set(as('manager'))
      .send({ status, ...(note ? { note } : {}) });
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);

    await prisma.$executeRawUnsafe(
      'TRUNCATE "Submission", "AssignmentAttachment", "Assignment", "ProgressLog", "VideoAsset", "ActivityNode", "Module", "Track", "Enrollment", "Program", "UserSession", "UserProfile", "Notification", "User" CASCADE',
    );
    await createUser('admin', GlobalRole.SUPER_ADMIN);
    await createUser('manager', GlobalRole.INCUBATOR_MANAGER);
    await createUser('instructor', GlobalRole.INSTRUCTOR);
    await createUser('student', GlobalRole.STUDENT);
    await createUser('other', GlobalRole.STUDENT);
    await createUser('third', GlobalRole.STUDENT);
  });

  afterAll(async () => {
    await app?.close();
    rmSync(storageDir, { recursive: true, force: true });
  });

  /* ------------------------------- Programs ------------------------------- */

  it('creates programs with validation, Arabic slugs and unique slugs', async () => {
    const bad = await http().post(ADMIN).set(as('admin')).send({ title: 'Bad', slug: 'Has Spaces!' }).expect(400);
    expect(bad.body).toMatchObject({ statusCode: 400, code: 'VALIDATION_FAILED' });
    expect(bad.body.details.slug).toBeDefined();

    const created = await createProgram({
      slug: 'ادارة-المشاريع',
      coverImage: '',
      description: '  ',
      maxSeats: 2,
      startDate: new Date(Date.now() + DAY).toISOString(),
      endDate: new Date(Date.now() + 60 * DAY).toISOString(),
    });
    expect(created).toMatchObject({
      slug: 'ادارة-المشاريع',
      status: 'DRAFT',
      coverImage: null,
      description: null,
      maxSeats: 2,
      isEnrollmentOpen: true,
      seats: { max: 2, taken: 0, remaining: 2 },
      enrollmentCounts: { PENDING: 0, ACTIVE: 0, REJECTED: 0 },
    });
    ids.draft = created.id;

    const dup = await http().post(ADMIN).set(as('admin')).send({ title: 'Dup', slug: 'ادارة-المشاريع' }).expect(409);
    expect(dup.body.code).toBe('SLUG_TAKEN');

    const dates = await http()
      .patch(`${ADMIN}/${created.id}`)
      .set(as('admin'))
      .send({ endDate: new Date(Date.now() - DAY).toISOString() })
      .expect(400);
    expect(dates.body.details.endDate).toBeDefined();

    await http().post(ADMIN).set(as('student')).send({ title: 'Nope', slug: 'nope' }).expect(403);
    await http().post(ADMIN).send({ title: 'Nope', slug: 'nope' }).expect(401);
  });

  it('admin list shows every status; the public catalog and detail hide drafts', async () => {
    const live = await createProgram({ slug: 'live-program', status: 'ONGOING', maxSeats: 2 });
    ids.live = live.id;

    const admin = await http().get(ADMIN).set(as('instructor')).expect(200);
    expect((admin.body as AdminProgram[]).map((p) => p.id)).toEqual(expect.arrayContaining([ids.draft, ids.live]));
    const drafts = await http().get(ADMIN).query({ status: 'DRAFT' }).set(as('admin')).expect(200);
    expect((drafts.body as AdminProgram[]).map((p) => p.id)).toEqual([ids.draft]);

    const catalog = await http().get('/v1/programs').expect(200);
    const slugs = (catalog.body as ProgramSummary[]).map((p) => p.slug);
    expect(slugs).toContain('live-program');
    expect(slugs).not.toContain('ادارة-المشاريع');
    expect(catalog.body[0]).toMatchObject({ canEnroll: true, enrollmentBlockReason: null, _count: { enrollments: 0 } });

    // Old path still answers for installed app versions.
    await http().get('/programs').expect(200);

    const encoded = encodeURIComponent('ادارة-المشاريع');
    await http().get(`/v1/programs/${encoded}`).expect(404);
    await http().get(`/v1/programs/${encoded}`).set(as('student')).expect(404);
    await http().get(`/v1/programs/${encoded}`).set(as('instructor')).expect(200); // staff preview
    await http().get(`${ADMIN}/${encoded}`).set(as('admin')).expect(200); // admin detail by slug
  });

  /* ------------------------------ Curriculum ------------------------------ */

  it('builds the curriculum with default positions and lesson rules', async () => {
    const track = await http().post(`${ADMIN}/${ids.live}/tracks`).set(as('instructor')).send({ title: 'المسار الأول' }).expect(201);
    const track2 = await http().post(`${ADMIN}/${ids.live}/tracks`).set(as('instructor')).send({ title: 'المسار الثاني' }).expect(201);
    expect([track.body.orderIndex, track2.body.orderIndex]).toEqual([0, 1]);
    expect(track.body.modules).toEqual([]);
    ids.track = track.body.id;

    const mod = await http().post(`${ADMIN}/tracks/${ids.track}/modules`).set(as('instructor')).send({ title: 'الوحدة 1' }).expect(201);
    ids.module = mod.body.id;

    const video = await http()
      .post(`${ADMIN}/modules/${ids.module}/nodes`)
      .set(as('instructor'))
      .send({
        title: 'مقدمة',
        type: 'VIDEO_LECTURE',
        videoData: { externalId: 'vid-1', durationSec: 600, playbackUrl: 'https://video.example/1' },
      })
      .expect(201);
    expect(video.body).toMatchObject({ orderIndex: 0, video: { playbackUrl: 'https://video.example/1' }, assignment: null });
    ids.videoNode = video.body.id;

    const quiz = await http()
      .post(`${ADMIN}/modules/${ids.module}/nodes`)
      .set(as('instructor'))
      .send({ title: 'اختبار', type: 'QUIZ' })
      .expect(201);
    expect(quiz.body.orderIndex).toBe(1);

    const badVideo = await http()
      .post(`${ADMIN}/modules/${ids.module}/nodes`)
      .set(as('instructor'))
      .send({ title: 'x', type: 'QUIZ', videoData: { externalId: 'v', durationSec: 1, playbackUrl: 'https://video.example/2' } })
      .expect(400);
    expect(badVideo.body.details.videoData).toBeDefined();
    const nested = await http()
      .post(`${ADMIN}/modules/${ids.module}/nodes`)
      .set(as('instructor'))
      .send({ title: 'x', type: 'VIDEO_LECTURE', videoData: { externalId: 'v', durationSec: 1, playbackUrl: 'not a url' } })
      .expect(400);
    expect(nested.body.details['videoData.playbackUrl']).toBeDefined();

    // Assignment lessons follow the assignment permissions and rules.
    const assignmentBody = {
      title: 'واجب الوحدة',
      type: 'ASSIGNMENT',
      assignmentData: { instructions: 'ابنِ صفحة', maxScore: 50 },
    };
    await http().post(`${ADMIN}/modules/${ids.module}/nodes`).set(as('instructor')).send(assignmentBody).expect(403);
    const missing = await http()
      .post(`${ADMIN}/modules/${ids.module}/nodes`)
      .set(as('admin'))
      .send({ title: 'واجب', type: 'ASSIGNMENT' })
      .expect(400);
    expect(missing.body.details.assignmentData).toBeDefined();
    const pastDue = await http()
      .post(`${ADMIN}/modules/${ids.module}/nodes`)
      .set(as('admin'))
      .send({ ...assignmentBody, assignmentData: { instructions: 'x', dueDate: new Date(Date.now() - DAY).toISOString() } })
      .expect(400);
    expect(pastDue.body.details.dueDate).toBeDefined();

    const assignment = await http().post(`${ADMIN}/modules/${ids.module}/nodes`).set(as('admin')).send(assignmentBody).expect(201);
    expect(assignment.body).toMatchObject({ type: 'ASSIGNMENT', orderIndex: 2, assignment: { status: 'DRAFT', maxScore: 50 } });
    ids.assignmentNode = assignment.body.id;
    ids.assignment = assignment.body.assignment.id;
    await http().get(`/v1/admin/assignments/${ids.assignment}`).set(as('admin')).expect(200);

    const locked = await http().patch(`${ADMIN}/nodes/${ids.videoNode}`).set(as('instructor')).send({ type: 'QUIZ' }).expect(409);
    expect(locked.body.code).toBe('NODE_TYPE_LOCKED');
    const renamed = await http()
      .patch(`${ADMIN}/nodes/${ids.videoNode}`)
      .set(as('instructor'))
      .send({ title: 'مقدمة البرنامج', type: 'VIDEO_LECTURE', videoData: { durationSec: 900 } })
      .expect(200);
    expect(renamed.body).toMatchObject({ title: 'مقدمة البرنامج', video: { durationSec: 900, externalId: 'vid-1' } });

    const detail = await http().get(`${ADMIN}/${ids.live}`).set(as('admin')).expect(200);
    const body = detail.body as AdminProgramDetail;
    expect(body.tracks.map((t) => t.title)).toEqual(['المسار الأول', 'المسار الثاني']);
    expect(body.tracks[0].modules[0].nodes.map((n) => n.type)).toEqual(['VIDEO_LECTURE', 'QUIZ', 'ASSIGNMENT']);
  });

  /* ------------------------------ Enrollments ----------------------------- */

  it('applies with a receipt and refuses duplicates, bad files and missing fields', async () => {
    const res = await apply('student', ids.live, { buffer: JPG, name: 'إيصال.jpg' }).expect(201);
    const mine = res.body as MyEnrollment;
    expect(mine).toMatchObject({ status: 'PENDING', hasReceipt: true, reviewNote: null, program: { id: ids.live } });
    ids.studentEnrollment = mine.id;

    const again = await apply('student', ids.live).expect(409);
    expect(again.body.code).toBe('ALREADY_ENROLLED');

    const exe = await apply('other', ids.live, { buffer: EXE, name: 'receipt.jpg' }).expect(415);
    expect(exe.body.code).toBe('UNSUPPORTED_FILE_TYPE');

    const invalid = await http().post(`/v1/enrollments/${ids.live}`).set(as('other')).field('fullNameEn', 'A').expect(400);
    expect(invalid.body.code).toBe('VALIDATION_FAILED');
    expect(invalid.body.details.age).toBeDefined();

    const profile = await prisma.userProfile.findUniqueOrThrow({ where: { userId: ids.student } });
    expect(profile).toMatchObject({ fullNameAr: 'سارة أحمد محمد', age: 22, governorate: 'غزة' });
  });

  it('refuses applications to drafts, closed and full programs', async () => {
    await apply('other', ids.draft).expect(404);

    const closed = await createProgram({ slug: 'closed-program', status: 'PUBLISHED', isEnrollmentOpen: false });
    const res = await apply('other', closed.id).expect(409);
    expect(res.body.code).toBe('ENROLLMENT_CLOSED');

    await apply('other', ids.live).expect(201); // second of 2 seats
    const full = await apply('third', ids.live).expect(409);
    expect(full.body.code).toBe('PROGRAM_FULL');

    const catalog = await http().get('/v1/programs').expect(200);
    const live = (catalog.body as ProgramSummary[]).find((p) => p.id === ids.live)!;
    expect(live).toMatchObject({ canEnroll: false, enrollmentBlockReason: 'FULL', seats: { taken: 2, remaining: 0 } });
  });

  it('my-enrollments returns only the caller\'s own (was every student\'s)', async () => {
    const res = await http().get('/v1/enrollments/my-enrollments').set(as('student')).expect(200);
    expect((res.body as MyEnrollment[]).map((e) => e.id)).toEqual([ids.studentEnrollment]);
    const legacy = await http().get('/enrollments/my-enrollments').set(as('third')).expect(200);
    expect(legacy.body).toEqual([]);
  });

  it('program detail never leaks other enrollments and locks content until accepted', async () => {
    // Publish the assignment so it shows in the curriculum.
    await http().patch(`/v1/admin/assignments/${ids.assignment}/status`).set(as('admin')).send({ status: 'PUBLISHED' }).expect(200);

    const anon = (await http().get('/v1/programs/live-program').expect(200)).body as ProgramDetail;
    expect(anon).toMatchObject({ myEnrollment: null, enrollments: [], canAccessContent: false });
    const anonNodes = anon.tracks[0].modules[0].nodes;
    expect(anonNodes.every((n) => n.isLocked)).toBe(true);
    // The QUIZ lesson is hidden: its quiz is not published.
    expect(anonNodes.map((n) => n.type)).toEqual(['VIDEO_LECTURE', 'ASSIGNMENT']);
    expect(anonNodes[0].video).toEqual({ durationSec: 900, playbackUrl: null });
    expect(anonNodes[1].assignment).toMatchObject({ id: ids.assignment, instructions: null, maxScore: 50 });
    expect(JSON.stringify(anon)).not.toContain('receipt');

    const third = (await http().get('/v1/programs/live-program').set(as('third')).expect(200)).body as ProgramDetail;
    expect(third.myEnrollment).toBeNull(); // not someone else's

    const pending = (await http().get('/v1/programs/live-program').set(as('student')).expect(200)).body as ProgramDetail;
    expect(pending).toMatchObject({ canAccessContent: false, myEnrollment: { id: ids.studentEnrollment, status: 'PENDING' } });
    expect(pending.enrollments).toHaveLength(1);
  });

  it('admin reviews applications: list, receipt, approve, reject and re-apply', async () => {
    await http().get('/v1/admin/enrollments').set(as('student')).expect(403);
    await http().get('/v1/admin/enrollments').set(as('instructor')).expect(403);

    const list = (await http().get('/v1/admin/enrollments').query({ programId: ids.live }).set(as('manager')).expect(200))
      .body as AdminEnrollmentList;
    expect(list).toMatchObject({ total: 2, page: 1, pageSize: 20 });
    expect(list.statusCounts).toMatchObject({ PENDING: 2, ACTIVE: 0 });
    const search = (await http().get('/v1/admin/enrollments').query({ q: 'STUDENT@e2e' }).set(as('manager')).expect(200))
      .body as AdminEnrollmentList;
    expect(search.items.map((i) => i.id)).toEqual([ids.studentEnrollment]);

    const detail = (await http().get(`/v1/admin/enrollments/${ids.studentEnrollment}`).set(as('manager')).expect(200))
      .body as AdminEnrollmentDetail;
    expect(detail).toMatchObject({ receiptMimeType: 'image/jpeg', user: { nationalId: '401234567', age: 22 } });
    const url = new URL(detail.receiptUrl!);
    const download = await http().get(url.pathname + url.search).buffer(true).expect(200);
    expect(Buffer.compare(download.body, JPG)).toBe(0);

    // Approve: content unlocks and the published assignment reaches the student.
    const approved = await setStatus(ids.studentEnrollment, 'ACTIVE', 'أهلاً بك');
    expect(approved.status).toBe(200);
    expect(approved.body).toMatchObject({ status: 'ACTIVE', reviewNote: 'أهلاً بك' });
    expect(approved.body.reviewedAt).not.toBeNull();
    const unlocked = (await http().get('/v1/programs/live-program').set(as('student')).expect(200)).body as ProgramDetail;
    expect(unlocked.canAccessContent).toBe(true);
    expect(unlocked.tracks[0].modules[0].nodes[0].video?.playbackUrl).toBe('https://video.example/1');
    expect(unlocked.tracks[0].modules[0].nodes[1].assignment?.instructions).toBe('ابنِ صفحة');
    const assignments = await http().get('/v1/assignments').set(as('student')).expect(200);
    expect(assignments.body.items.map((i: { id: string }) => i.id)).toContain(ids.assignment);

    const back = await setStatus(ids.studentEnrollment, 'PENDING');
    expect(back.status).toBe(409);
    expect(back.body.code).toBe('INVALID_STATUS_TRANSITION');

    // Reject the other one, with a note the student sees; they can apply again.
    const other = list.items.find((i) => i.id !== ids.studentEnrollment)!;
    const rejected = await setStatus(other.id, 'REJECTED', 'الإيصال غير واضح');
    expect(rejected.body).toMatchObject({ status: 'REJECTED', reviewNote: 'الإيصال غير واضح' });
    const seen = (await http().get('/v1/programs/live-program').set(as('other')).expect(200)).body as ProgramDetail;
    expect(seen.myEnrollment).toMatchObject({ status: 'REJECTED', reviewNote: 'الإيصال غير واضح' });

    // The rejected seat is free again: a third student takes it.
    await apply('third', ids.live).expect(201);
    const full = await setStatus(other.id, 'ACTIVE');
    expect(full.status).toBe(409);
    expect(full.body.code).toBe('PROGRAM_FULL');

    await http().patch(`${ADMIN}/${ids.live}`).set(as('admin')).send({ maxSeats: 3 }).expect(200);
    const reapply = await apply('other', ids.live, { buffer: JPG, name: 'new.jpg' }).expect(201);
    expect(reapply.body).toMatchObject({ id: other.id, status: 'PENDING', reviewNote: null });
  });

  /* -------------------------------- Deletes ------------------------------- */

  it('protects student work and enrollments from cascading deletes', async () => {
    await prisma.submission.create({
      data: { assignmentId: ids.assignment, studentId: ids.student, payload: {}, status: SubmissionStatus.SUBMITTED },
    });

    for (const path of [`nodes/${ids.assignmentNode}`, `modules/${ids.module}`, `tracks/${ids.track}`]) {
      const res = await http().delete(`${ADMIN}/${path}`).set(as('admin')).expect(409);
      expect(res.body.code).toBe('CONTENT_HAS_SUBMISSIONS');
    }
    const program = await http().delete(`${ADMIN}/${ids.live}`).set(as('admin')).expect(409);
    expect(program.body.code).toBe('PROGRAM_HAS_ENROLLMENTS');

    await http().delete(`${ADMIN}/nodes/${ids.videoNode}`).set(as('instructor')).expect(403);
    await http().delete(`${ADMIN}/nodes/${ids.videoNode}`).set(as('manager')).expect(204);
    await http().delete(`${ADMIN}/${ids.draft}`).set(as('admin')).expect(204);
    await http().get(`${ADMIN}/${ids.draft}`).set(as('admin')).expect(404);
  });
});
