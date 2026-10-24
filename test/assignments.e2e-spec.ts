/**
 * Acceptance tests of ASSIGNMENTS_SPEC.md section 13 (backend part).
 *
 * Runs against a real database that it WIPES, so it refuses to run unless the
 * database name ends with `_test`:
 *   DATABASE_URL=postgresql://.../incubator_lms_test npx prisma migrate deploy
 *   DATABASE_URL=postgresql://.../incubator_lms_test npm run test:e2e -- assignments
 */
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import {
  AssignmentStatus,
  EnrollmentStatus,
  GlobalRole,
  NodeType,
  ProgramStatus,
  SubmissionStatus,
  UserStatus,
} from '@prisma/client';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import type { AssignmentItem } from '../src/types/assignments.contract.js';

const dbName = new URL(process.env.DATABASE_URL ?? 'postgres://x/none').pathname.slice(1);
const storageDir = mkdtempSync(join(tmpdir(), 'assignments-e2e-'));
process.env.STORAGE_LOCAL_DIR = storageDir;
process.env.STORAGE_SIGNING_SECRET = 'e2e-secret';
process.env.PUBLIC_API_URL = 'http://localhost';

const ADMIN = '/v1/admin/assignments';
const DAY = 24 * 60 * 60 * 1000;
const future = (days = 7) => new Date(Date.now() + days * DAY).toISOString();
const past = (days = 1) => new Date(Date.now() - days * DAY).toISOString();

const PDF = Buffer.from('%PDF-1.4\n1 0 obj << /Type /Catalog >> endobj\ntrailer << /Root 1 0 R >>\n%%EOF\n');
const PNG = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c6360000002000100e221bc330000000049454e44ae426082', 'hex');
const EXE = Buffer.concat([Buffer.from('MZ'), Buffer.alloc(62), Buffer.from('PE\0\0'), Buffer.alloc(200)]);

describe.skipIf(!dbName.endsWith('_test'))('Assignments (e2e, ASSIGNMENTS_SPEC.md 13)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwt: JwtService;
  const tokens: Record<string, string> = {};
  const ids: Record<string, string> = {};

  const http = () => request(app.getHttpServer());
  const as = (who: string) => ({ Authorization: `Bearer ${tokens[who]}` });

  async function createUser(key: string, role: GlobalRole, status: UserStatus = UserStatus.ACTIVE) {
    const user = await prisma.user.create({
      data: { email: `${key}@e2e.test`, passwordHash: 'x', globalRole: role, status },
    });
    ids[key] = user.id;
    tokens[key] = jwt.sign({ sub: user.id, email: user.email, globalRole: role });
  }

  async function createAssignment(overrides: Record<string, unknown> = {}) {
    const res = await http()
      .post(ADMIN)
      .set(as('admin'))
      .send({ moduleId: ids.module, title: 'واجب تجريبي', instructions: 'افعل كذا', ...overrides })
      .expect(201);
    return res.body;
  }

  async function publish(id: string) {
    return http().patch(`${ADMIN}/${id}/status`).set(as('admin')).send({ status: 'PUBLISHED' }).expect(200);
  }

  async function submit(assignmentId: string, studentKey: string, status: SubmissionStatus, extra = {}) {
    return prisma.submission.create({
      data: { assignmentId, studentId: ids[studentKey], payload: { secret: 'payload' }, status, ...extra },
    });
  }

  async function studentList(who = 'student'): Promise<AssignmentItem[]> {
    const res = await http().get('/v1/assignments').set(as(who)).expect(200);
    return res.body.items;
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
    prisma = app.get(PrismaService);
    jwt = app.get(JwtService);

    await prisma.$executeRawUnsafe(
      'TRUNCATE "Submission", "AssignmentAttachment", "Assignment", "ProgressLog", "VideoAsset", "ActivityNode", "Module", "Track", "Enrollment", "Program", "UserSession", "UserProfile", "Notification", "User" CASCADE',
    );

    await createUser('admin', GlobalRole.SUPER_ADMIN);
    await createUser('manager', GlobalRole.INCUBATOR_MANAGER);
    await createUser('instructor', GlobalRole.INSTRUCTOR);
    await createUser('student', GlobalRole.STUDENT);
    await createUser('other', GlobalRole.STUDENT);
    await createUser('pending', GlobalRole.STUDENT);
    await createUser('completed', GlobalRole.STUDENT);
    await createUser('suspended', GlobalRole.STUDENT, UserStatus.SUSPENDED);
    await createUser('archivedUser', GlobalRole.SUPER_ADMIN, UserStatus.ARCHIVED);

    const program = await prisma.program.create({
      data: {
        title: 'React Native',
        slug: 'react-native',
        status: ProgramStatus.ONGOING,
        tracks: { create: { title: 'المسار الأول', modules: { create: { title: 'الوحدة 1' } } } },
      },
      include: { tracks: { include: { modules: true } } },
    });
    ids.program = program.id;
    ids.track = program.tracks[0].id;
    ids.module = program.tracks[0].modules[0].id;

    const draftProgram = await prisma.program.create({
      data: {
        title: 'Draft program',
        slug: 'draft-program',
        status: ProgramStatus.DRAFT,
        tracks: { create: { title: 'T', modules: { create: { title: 'M' } } } },
      },
      include: { tracks: { include: { modules: true } } },
    });
    ids.draftProgram = draftProgram.id;
    ids.draftModule = draftProgram.tracks[0].modules[0].id;

    for (const [key, status] of [
      ['student', EnrollmentStatus.ACTIVE],
      ['other', EnrollmentStatus.ACTIVE],
      ['pending', EnrollmentStatus.PENDING],
      ['completed', EnrollmentStatus.COMPLETED],
    ] as const) {
      await prisma.enrollment.create({ data: { userId: ids[key], programId: ids.program, status } });
      await prisma.enrollment.create({ data: { userId: ids[key], programId: ids.draftProgram, status } });
    }
  });

  afterAll(async () => {
    await app?.close();
    rmSync(storageDir, { recursive: true, force: true });
  });

  /* ------------------------------ Migration ------------------------------ */

  it('D-1: the backfill publishes legacy assignments with publishedAt = createdAt', async () => {
    const node = await prisma.activityNode.create({
      data: { moduleId: ids.module, title: 'Legacy', type: NodeType.ASSIGNMENT },
    });
    const legacy = await prisma.assignment.create({
      data: { nodeId: node.id, instructions: 'old', createdAt: new Date(Date.now() - 30 * DAY) },
    });
    // Same statement as prisma/migrations/20261024100000_backfill_assignment_status.
    await prisma.$executeRawUnsafe(
      `UPDATE "Assignment" SET "status" = 'PUBLISHED', "publishedAt" = "createdAt" WHERE "status" = 'DRAFT' AND "publishedAt" IS NULL AND "id" = '${legacy.id}'`,
    );
    const row = await prisma.assignment.findUniqueOrThrow({ where: { id: legacy.id } });
    expect(row.status).toBe(AssignmentStatus.PUBLISHED);
    expect(row.publishedAt?.getTime()).toBe(row.createdAt.getTime());

    const item = (await studentList()).find((i) => i.id === legacy.id);
    expect(item).toMatchObject({ publishedAt: row.createdAt.toISOString(), isNew: false });
  });

  /* ------------------------- Admin: create, read ------------------------- */

  it('A-1, A-2: create returns a DRAFT with defaults and creates node + assignment', async () => {
    const before = await prisma.activityNode.aggregate({ where: { moduleId: ids.module }, _max: { orderIndex: true } });
    const body = await createAssignment();

    expect(body).toMatchObject({
      status: 'DRAFT',
      publishedAt: null,
      allowedType: 'URL_LINK',
      maxScore: 100,
      isMandatory: true,
      dueDate: null,
      attachments: [],
      submissionsCount: 0,
      program: { id: ids.program },
      module: { id: ids.module },
    });
    expect(body.orderIndex).toBe((before._max.orderIndex ?? -1) + 1);

    const row = await prisma.assignment.findUniqueOrThrow({ where: { id: body.id }, include: { node: true } });
    expect(row.node.type).toBe(NodeType.ASSIGNMENT);
  });

  it('A-3: validation and unknown module', async () => {
    const base = { moduleId: ids.module, title: 'عنوان صالح', instructions: 'x' };
    await http().post(ADMIN).set(as('admin')).send({ ...base, moduleId: 'nope' }).expect(404);

    const short = await http().post(ADMIN).set(as('admin')).send({ ...base, title: 'ab' }).expect(400);
    expect(short.body).toMatchObject({ statusCode: 400, code: 'VALIDATION_FAILED' });
    expect(short.body.details.title).toBeDefined();

    for (const maxScore of [0, 1000, 10.123]) {
      const res = await http().post(ADMIN).set(as('admin')).send({ ...base, maxScore }).expect(400);
      expect(res.body.details.maxScore).toBeDefined();
    }
    const pastDue = await http().post(ADMIN).set(as('admin')).send({ ...base, dueDate: past() }).expect(400);
    expect(pastDue.body.details.dueDate).toBeDefined();
  });

  it('A-4, A-5: list filters, pagination, sorting and counts', async () => {
    const a = await createAssignment({ title: 'Filter Alpha', dueDate: future(2) });
    const b = await createAssignment({ title: 'Filter Beta', dueDate: future(5) });
    const c = await createAssignment({ title: 'Filter Gamma' }); // no deadline
    await publish(b.id);
    await submit(b.id, 'student', SubmissionStatus.SUBMITTED);
    await submit(b.id, 'student', SubmissionStatus.GRADED, { score: 50 });
    await submit(b.id, 'other', SubmissionStatus.UNDER_REVIEW);
    await http()
      .post(`${ADMIN}/${b.id}/attachments`)
      .set(as('admin'))
      .attach('file', PDF, 'brief.pdf')
      .expect(201);

    const byQ = await http().get(ADMIN).query({ q: 'filter', sort: '-dueDate' }).set(as('admin')).expect(200);
    expect(byQ.body.total).toBe(3);
    expect(byQ.body.items.map((i: any) => i.id)).toEqual([b.id, a.id, c.id]); // null deadline last

    const asc = await http().get(ADMIN).query({ q: 'FILTER', sort: 'dueDate' }).set(as('admin')).expect(200);
    expect(asc.body.items.map((i: any) => i.id)).toEqual([a.id, b.id, c.id]);

    const page = await http().get(ADMIN).query({ q: 'filter', pageSize: 2, page: 2 }).set(as('admin')).expect(200);
    expect(page.body).toMatchObject({ page: 2, pageSize: 2, total: 3 });
    expect(page.body.items).toHaveLength(1);

    const published = await http().get(ADMIN).query({ q: 'filter', status: 'PUBLISHED' }).set(as('admin')).expect(200);
    expect(published.body.items.map((i: any) => i.id)).toEqual([b.id]);
    expect(published.body.items[0]).toMatchObject({
      submissionsCount: 3,
      pendingReviewCount: 2,
      attachmentsCount: 1,
    });

    for (const filter of [{ programId: ids.program }, { trackId: ids.track }, { moduleId: ids.module }]) {
      const res = await http().get(ADMIN).query({ q: 'filter', ...filter }).set(as('admin')).expect(200);
      expect(res.body.total).toBe(3);
    }
    const other = await http().get(ADMIN).query({ programId: ids.draftProgram }).set(as('admin')).expect(200);
    expect(other.body.total).toBe(0);

    await http().get(ADMIN).query({ sort: 'nope' }).set(as('admin')).expect(400);
  });

  it('A-9 targets route is not parsed as an id', async () => {
    const res = await http().get(`${ADMIN}/targets`).set(as('admin')).expect(200);
    const program = res.body.programs.find((p: any) => p.id === ids.program);
    expect(program.tracks[0].modules[0].id).toBe(ids.module);
  });

  /* ------------------------------ Admin: update ----------------------------- */

  it('A-6, A-7: PATCH changes only sent fields, updates the node, null clears dueDate', async () => {
    const created = await createAssignment({ dueDate: future(), maxScore: 50 });
    const res = await http()
      .patch(`${ADMIN}/${created.id}`)
      .set(as('admin'))
      .send({ title: 'عنوان جديد', dueDate: null })
      .expect(200);
    expect(res.body).toMatchObject({ title: 'عنوان جديد', dueDate: null, maxScore: 50, instructions: 'افعل كذا' });
    const row = await prisma.assignment.findUniqueOrThrow({ where: { id: created.id }, include: { node: true } });
    expect(row.node.title).toBe('عنوان جديد');
  });

  it('A-8: past deadline only fails when the value changes', async () => {
    const created = await createAssignment();
    const oldDue = new Date(Date.now() - DAY);
    await prisma.assignment.update({ where: { id: created.id }, data: { dueDate: oldDue } });

    await http()
      .patch(`${ADMIN}/${created.id}`)
      .set(as('admin'))
      .send({ title: 'Edited after deadline', dueDate: oldDue.toISOString() })
      .expect(200);
    const res = await http().patch(`${ADMIN}/${created.id}`).set(as('admin')).send({ dueDate: past(2) }).expect(400);
    expect(res.body.details.dueDate).toBeDefined();
  });

  it('A-9: allowedType locked and maxScore floor once submissions exist', async () => {
    const created = await createAssignment({ maxScore: 100 });
    await submit(created.id, 'student', SubmissionStatus.GRADED, { score: 80 });

    const locked = await http()
      .patch(`${ADMIN}/${created.id}`)
      .set(as('admin'))
      .send({ allowedType: 'FILE_UPLOAD' })
      .expect(409);
    expect(locked.body.code).toBe('ALLOWED_TYPE_LOCKED');

    const floor = await http().patch(`${ADMIN}/${created.id}`).set(as('admin')).send({ maxScore: 70 }).expect(409);
    expect(floor.body.code).toBe('MAX_SCORE_BELOW_EXISTING_SCORES');

    await http()
      .patch(`${ADMIN}/${created.id}`)
      .set(as('admin'))
      .send({ maxScore: 80, allowedType: 'URL_LINK' })
      .expect(200);
  });

  it('A-10, A-11: moduleId in PATCH is rejected; ARCHIVED cannot be edited', async () => {
    const created = await createAssignment();
    const moved = await http()
      .patch(`${ADMIN}/${created.id}`)
      .set(as('admin'))
      .send({ moduleId: ids.draftModule })
      .expect(400);
    expect(moved.body.details.moduleId).toBeDefined();

    await publish(created.id);
    await http().patch(`${ADMIN}/${created.id}/status`).set(as('admin')).send({ status: 'ARCHIVED' }).expect(200);
    const res = await http().patch(`${ADMIN}/${created.id}`).set(as('admin')).send({ title: 'Nope nope' }).expect(409);
    expect(res.body.code).toBe('INVALID_STATUS_TRANSITION');
  });

  /* --------------------------- Admin: status, delete ------------------------ */

  it('S-1 to S-5: status lifecycle', async () => {
    const created = await createAssignment();
    const published = await publish(created.id);
    expect(published.body.publishedAt).not.toBeNull(); // S-1

    const draft = await http().patch(`${ADMIN}/${created.id}/status`).set(as('admin')).send({ status: 'DRAFT' }).expect(200);
    expect(draft.body).toMatchObject({ status: 'DRAFT', publishedAt: null }); // S-2

    const invalid = await http()
      .patch(`${ADMIN}/${created.id}/status`)
      .set(as('admin'))
      .send({ status: 'ARCHIVED' })
      .expect(409);
    expect(invalid.body.code).toBe('INVALID_STATUS_TRANSITION'); // S-4

    const again = await publish(created.id);
    await submit(created.id, 'student', SubmissionStatus.SUBMITTED);
    const blocked = await http()
      .patch(`${ADMIN}/${created.id}/status`)
      .set(as('admin'))
      .send({ status: 'DRAFT' })
      .expect(409);
    expect(blocked.body.code).toBe('ASSIGNMENT_HAS_SUBMISSIONS'); // S-3

    await http().patch(`${ADMIN}/${created.id}/status`).set(as('admin')).send({ status: 'ARCHIVED' }).expect(200);
    const restored = await publish(created.id);
    expect(restored.body.publishedAt).toBe(again.body.publishedAt); // S-5
  });

  it('X-1: delete removes node, assignment, attachment rows and files', async () => {
    const created = await createAssignment();
    const upload = await http()
      .post(`${ADMIN}/${created.id}/attachments`)
      .set(as('admin'))
      .attach('file', PDF, 'brief.pdf')
      .expect(201);
    const att = await prisma.assignmentAttachment.findUniqueOrThrow({ where: { id: upload.body.id } });
    const filePath = join(storageDir, att.storageKey);
    expect(existsSync(filePath)).toBe(true);
    const row = await prisma.assignment.findUniqueOrThrow({ where: { id: created.id } });

    await http().delete(`${ADMIN}/${created.id}`).set(as('admin')).expect(204);
    expect(await prisma.activityNode.count({ where: { id: row.nodeId } })).toBe(0);
    expect(await prisma.assignment.count({ where: { id: created.id } })).toBe(0);
    expect(await prisma.assignmentAttachment.count({ where: { assignmentId: created.id } })).toBe(0);
    expect(existsSync(filePath)).toBe(false);
  });

  it('X-2: delete with a submission is refused and nothing is removed', async () => {
    const created = await createAssignment();
    await submit(created.id, 'student', SubmissionStatus.SUBMITTED);
    const res = await http().delete(`${ADMIN}/${created.id}`).set(as('admin')).expect(409);
    expect(res.body).toEqual({
      statusCode: 409,
      code: 'ASSIGNMENT_HAS_SUBMISSIONS',
      message: 'Assignment has submissions; archive it instead.',
    });
    expect(await prisma.assignment.count({ where: { id: created.id } })).toBe(1);
  });

  /* ------------------------------- Attachments ------------------------------ */

  it('F-1, F-3: upload a PDF with an Arabic name and download it', async () => {
    const created = await createAssignment();
    const res = await http()
      .post(`${ADMIN}/${created.id}/attachments`)
      .set(as('admin'))
      .attach('file', PDF, { filename: 'المتطلبات.pdf', contentType: 'application/pdf' })
      .expect(201);
    expect(res.body).toMatchObject({ fileName: 'المتطلبات.pdf', mimeType: 'application/pdf', sizeBytes: PDF.length });

    const att = await prisma.assignmentAttachment.findUniqueOrThrow({ where: { id: res.body.id } });
    expect(att.storageKey).toBe(`assignments/${created.id}/${att.id}.pdf`);
    expect(existsSync(join(storageDir, att.storageKey))).toBe(true);

    const url = new URL(res.body.url);
    const download = await http().get(url.pathname + url.search).buffer(true).expect(200);
    expect(download.headers['content-type']).toBe('application/pdf');
    expect(download.headers['content-disposition']).toContain(
      `filename*=UTF-8''${encodeURIComponent('المتطلبات.pdf')}`,
    );
    expect(Buffer.compare(download.body, PDF)).toBe(0);

    const tampered = new URLSearchParams(url.search);
    tampered.set('name', 'other.pdf');
    await http().get(`${url.pathname}?${tampered}`).expect(403);
  });

  it('F-2: size, magic bytes and count limits', async () => {
    const created = await createAssignment();
    const big = Buffer.concat([PDF, Buffer.alloc(20 * 1024 * 1024)]);
    const tooBig = await http()
      .post(`${ADMIN}/${created.id}/attachments`)
      .set(as('admin'))
      .attach('file', big, 'big.pdf')
      .expect(413);
    expect(tooBig.body.code).toBe('FILE_TOO_LARGE');

    const fake = await http()
      .post(`${ADMIN}/${created.id}/attachments`)
      .set(as('admin'))
      .attach('file', EXE, { filename: 'virus.pdf', contentType: 'application/pdf' })
      .expect(415);
    expect(fake.body.code).toBe('UNSUPPORTED_FILE_TYPE');
    await http()
      .post(`${ADMIN}/${created.id}/attachments`)
      .set(as('admin'))
      .attach('file', EXE, 'tool.exe')
      .expect(415);

    for (let i = 0; i < 4; i++) {
      await http().post(`${ADMIN}/${created.id}/attachments`).set(as('admin')).attach('file', PDF, `f${i}.pdf`).expect(201);
    }
    await http()
      .post(`${ADMIN}/${created.id}/attachments`)
      .set(as('admin'))
      .attach('file', PNG, { filename: 'image.png', contentType: 'image/png' })
      .expect(201);
    const sixth = await http()
      .post(`${ADMIN}/${created.id}/attachments`)
      .set(as('admin'))
      .attach('file', PDF, 'six.pdf')
      .expect(409);
    expect(sixth.body.code).toBe('ATTACHMENT_LIMIT_REACHED');
  });

  it('F-4: delete an attachment; another assignment id gives 404', async () => {
    const one = await createAssignment();
    const two = await createAssignment();
    const upload = await http()
      .post(`${ADMIN}/${one.id}/attachments`)
      .set(as('admin'))
      .attach('file', PDF, 'brief.pdf')
      .expect(201);
    const att = await prisma.assignmentAttachment.findUniqueOrThrow({ where: { id: upload.body.id } });

    await http().delete(`${ADMIN}/${two.id}/attachments/${att.id}`).set(as('admin')).expect(404);
    await http().delete(`${ADMIN}/${one.id}/attachments/${att.id}`).set(as('admin')).expect(204);
    expect(await prisma.assignmentAttachment.count({ where: { id: att.id } })).toBe(0);
    expect(existsSync(join(storageDir, att.storageKey))).toBe(false);
  });

  it('F-5: the stored file is removed when the database insert fails', async () => {
    const created = await createAssignment();
    const original = prisma.assignmentAttachment.create;
    (prisma.assignmentAttachment as any).create = () => Promise.reject(new Error('insert failed'));
    try {
      const res = await http()
        .post(`${ADMIN}/${created.id}/attachments`)
        .set(as('admin'))
        .attach('file', PDF, 'brief.pdf')
        .expect(500);
      expect(res.body).toEqual({ statusCode: 500, code: 'INTERNAL_ERROR', message: 'Internal server error.' });
    } finally {
      (prisma.assignmentAttachment as any).create = original;
    }
    const dir = join(storageDir, 'assignments', created.id);
    const { readdirSync } = await import('node:fs');
    expect(existsSync(dir) ? readdirSync(dir) : []).toEqual([]);
  });

  it('F-6: uploading to an ARCHIVED assignment gives 409', async () => {
    const created = await createAssignment();
    await publish(created.id);
    await http().patch(`${ADMIN}/${created.id}/status`).set(as('admin')).send({ status: 'ARCHIVED' }).expect(200);
    const res = await http()
      .post(`${ADMIN}/${created.id}/attachments`)
      .set(as('admin'))
      .attach('file', PDF, 'brief.pdf')
      .expect(409);
    expect(res.body.code).toBe('INVALID_STATUS_TRANSITION');
  });

  /* ------------------------------- Permissions ------------------------------ */

  it('P-1 to P-4: roles and account status', async () => {
    const student = await http().get(ADMIN).set(as('student')).expect(403);
    expect(student.body.code).toBe('FORBIDDEN');
    await http().get(ADMIN).set(as('instructor')).expect(403);

    const noToken = await http().get(ADMIN).expect(401);
    expect(noToken.body.code).toBe('UNAUTHORIZED');
    await http().get('/v1/assignments').expect(401);
    await http().get(ADMIN).set(as('archivedUser')).expect(401);
    await http().get('/v1/assignments').set(as('suspended')).expect(401);

    await http().get(ADMIN).set(as('admin')).expect(200);
    await http().get(ADMIN).set(as('manager')).expect(200);
  });

  /* ------------------------------ Student list ------------------------------ */

  it('M-1 to M-5: visibility by enrollment, program and assignment status', async () => {
    const visible = await createAssignment({ title: 'Visible one' });
    const draft = await createAssignment({ title: 'Still a draft' });
    const archived = await createAssignment({ title: 'Archived one' });
    await publish(visible.id);
    await publish(archived.id);
    await http().patch(`${ADMIN}/${archived.id}/status`).set(as('admin')).send({ status: 'ARCHIVED' }).expect(200);

    const inDraftProgram = await createAssignment({ title: 'Draft program one', moduleId: ids.draftModule });
    await publish(inDraftProgram.id);

    const items = await studentList();
    const seen = items.map((i) => i.id);
    expect(seen).toContain(visible.id);
    expect(seen).not.toContain(draft.id); // M-5
    expect(seen).not.toContain(archived.id); // M-5
    expect(seen).not.toContain(inDraftProgram.id); // M-4
    expect(items.find((i) => i.id === visible.id)?.isNew).toBe(true); // M-5

    expect(await studentList('pending')).toEqual([]); // M-1, M-2
    expect((await studentList('completed')).map((i) => i.id)).toContain(visible.id); // M-3

    const res = await http().get('/v1/assignments').set(as('admin')).expect(200); // not enrolled
    expect(res.body).toEqual({ items: [] });
    expect(res.headers['cache-control']).toBe('private, max-age=0');
  });

  it('M-6 to M-12: flags, latest submission and contract shape', async () => {
    const fresh = await createAssignment();
    const old = await createAssignment();
    const revised = await createAssignment();
    const graded = await createAssignment();
    const noDue = await createAssignment();
    for (const a of [fresh, old, revised, graded, noDue]) await publish(a.id);

    await prisma.assignment.update({ where: { id: fresh.id }, data: { publishedAt: new Date(Date.now() - DAY) } });
    await prisma.assignment.update({ where: { id: old.id }, data: { publishedAt: new Date(Date.now() - 10 * DAY) } });
    await prisma.assignment.updateMany({
      where: { id: { in: [revised.id, graded.id] } },
      data: { dueDate: new Date(Date.now() - DAY) },
    });

    await submit(old.id, 'student', SubmissionStatus.NEEDS_REVISION, { createdAt: new Date(Date.now() - 2 * DAY) });
    await submit(old.id, 'student', SubmissionStatus.SUBMITTED);
    await submit(old.id, 'other', SubmissionStatus.GRADED, { score: 99 });
    await submit(revised.id, 'student', SubmissionStatus.NEEDS_REVISION, { feedback: 'أعد المحاولة' });
    await submit(graded.id, 'student', SubmissionStatus.GRADED, { score: 88.5 });

    const items = await studentList();
    const byId = (id: string) => items.find((i) => i.id === id)!;

    expect(byId(fresh.id)).toMatchObject({ submission: null, isNew: true }); // M-6
    await prisma.submission.deleteMany({ where: { assignmentId: old.id, studentId: ids.student } });
    expect((await studentList()).find((i) => i.id === old.id)?.isNew).toBe(false); // M-6
    await submit(old.id, 'student', SubmissionStatus.NEEDS_REVISION, { createdAt: new Date(Date.now() - 2 * DAY) });
    await submit(old.id, 'student', SubmissionStatus.SUBMITTED);

    const oldItem = (await studentList()).find((i) => i.id === old.id)!;
    expect(oldItem.submission).toMatchObject({ status: 'SUBMITTED', attemptsCount: 2 }); // M-7, M-11
    expect(byId(revised.id)).toMatchObject({ isOverdue: true, submission: { feedback: 'أعد المحاولة' } }); // M-8
    expect(byId(graded.id)).toMatchObject({ isOverdue: false, submission: { score: 88.5 } }); // M-9
    expect(byId(noDue.id)).toMatchObject({ dueDate: null, isOverdue: false }); // M-10

    // M-12: exact contract keys, no payload.
    for (const item of items) {
      expect(Object.keys(item).sort()).toEqual(
        ['allowedType', 'createdAt', 'dueDate', 'id', 'isNew', 'isOverdue', 'maxScore', 'program', 'publishedAt', 'submission', 'title'],
      );
      expect(typeof item.publishedAt).toBe('string');
      if (item.submission) {
        expect(Object.keys(item.submission).sort()).toEqual(
          ['attemptsCount', 'feedback', 'id', 'score', 'status', 'submittedAt'],
        );
      }
    }
  });

  /* ----------------------------- Student detail ----------------------------- */

  it('M-13 to M-15: detail with attachments, 404 when not visible, no payload', async () => {
    const created = await createAssignment({ instructions: 'السطر الأول\nالسطر الثاني' });
    await http()
      .post(`${ADMIN}/${created.id}/attachments`)
      .set(as('admin'))
      .attach('file', PDF, 'المتطلبات.pdf')
      .expect(201);
    await http().get(`/v1/assignments/${created.id}`).set(as('student')).expect(404); // draft
    await publish(created.id);
    await submit(created.id, 'student', SubmissionStatus.SUBMITTED);

    const res = await http().get(`/v1/assignments/${created.id}`).set(as('student')).expect(200);
    expect(res.body).toMatchObject({
      id: created.id,
      instructions: 'السطر الأول\nالسطر الثاني',
      attachments: [{ fileName: 'المتطلبات.pdf', mimeType: 'application/pdf' }],
      submission: { status: 'SUBMITTED', attemptsCount: 1 },
    });
    expect(JSON.stringify(res.body)).not.toContain('payload');
    const url = new URL(res.body.attachments[0].url);
    await http().get(url.pathname + url.search).expect(200);

    const notFound = await http().get(`/v1/assignments/${created.id}`).set(as('pending')).expect(404);
    expect(notFound.body.code).toBe('NOT_FOUND');
    await http().get(`/v1/assignments/${created.id}`).set(as('admin')).expect(404);
    await http().get('/v1/assignments/does-not-exist').set(as('student')).expect(404);
  });
});
