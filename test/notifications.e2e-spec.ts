/**
 * Notifications API and triggers (docs/updates/02-notifications.md).
 * WIPES the database: runs only when its name ends with `_test` (see assignments.e2e-spec.ts).
 */
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { EnrollmentStatus, GlobalRole, ProgramStatus } from '@prisma/client';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import type { NotificationList } from '../src/types/api.contract.js';

const dbName = new URL(process.env.DATABASE_URL ?? 'postgres://x/none').pathname.slice(1);
const DAY = 24 * 60 * 60 * 1000;

describe.skipIf(!dbName.endsWith('_test'))('Notifications (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const tokens: Record<string, string> = {};
  const ids: Record<string, string> = {};

  const http = () => request(app.getHttpServer());
  const as = (who: string) => ({ Authorization: `Bearer ${tokens[who]}` });
  const list = async (who: string, query: Record<string, string> = {}) =>
    (await http().get('/v1/notifications').query(query).set(as(who)).expect(200)).body as NotificationList;

  async function program(slug: string, status: ProgramStatus) {
    const p = await prisma.program.create({
      data: { title: `برنامج ${slug}`, slug, status, tracks: { create: { title: 'T', modules: { create: { title: 'M' } } } } },
      include: { tracks: { include: { modules: true } } },
    });
    return { id: p.id, moduleId: p.tracks[0].modules[0].id };
  }

  async function publishNewAssignment(moduleId: string, title: string) {
    const created = await http()
      .post('/v1/admin/assignments')
      .set(as('admin'))
      .send({ moduleId, title, instructions: 'x', dueDate: new Date(Date.now() + 7 * DAY).toISOString() })
      .expect(201);
    await http().patch(`/v1/admin/assignments/${created.body.id}/status`).set(as('admin')).send({ status: 'PUBLISHED' }).expect(200);
    return created.body.id as string;
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
    for (const [k, role] of [['admin', GlobalRole.SUPER_ADMIN], ['a', GlobalRole.STUDENT], ['b', GlobalRole.STUDENT], ['pending', GlobalRole.STUDENT]] as const) {
      const u = await prisma.user.create({ data: { email: `${k}@e2e.test`, passwordHash: 'x', globalRole: role } });
      ids[k] = u.id;
      tokens[k] = app.get(JwtService).sign({ sub: u.id, email: u.email, globalRole: role });
    }
    const live = await program('live', ProgramStatus.ONGOING);
    ids.liveProgram = live.id;
    ids.liveModule = live.moduleId;
    ids.draftModule = (await program('draft', ProgramStatus.DRAFT)).moduleId;
    for (const [k, status] of [['a', EnrollmentStatus.ACTIVE], ['b', EnrollmentStatus.ACTIVE], ['pending', EnrollmentStatus.PENDING]] as const) {
      const e = await prisma.enrollment.create({ data: { userId: ids[k], programId: live.id, status } });
      ids[`${k}Enrollment`] = e.id;
    }
  });

  afterAll(async () => {
    await app?.close();
  });

  it('publishing an assignment notifies the active learners of the program only', async () => {
    ids.assignment = await publishNewAssignment(ids.liveModule, 'واجب الأسبوع الأول');

    const a = await list('a');
    expect(a).toMatchObject({ total: 1, unreadCount: 1 });
    expect(a.items[0]).toMatchObject({
      type: 'NEW_ASSIGNMENT',
      title: 'واجب جديد',
      message: 'واجب الأسبوع الأول: برنامج live',
      isRead: false,
      actionUrl: `/assignments/${ids.assignment}`,
    });
    expect((await list('b')).total).toBe(1);
    expect((await list('pending')).total).toBe(0);

    // Archive + restore keeps publishedAt: no second notification.
    await http().patch(`/v1/admin/assignments/${ids.assignment}/status`).set(as('admin')).send({ status: 'ARCHIVED' }).expect(200);
    await http().patch(`/v1/admin/assignments/${ids.assignment}/status`).set(as('admin')).send({ status: 'PUBLISHED' }).expect(200);
    expect((await list('a')).total).toBe(1);

    // Hidden (draft) programs notify nobody.
    await publishNewAssignment(ids.draftModule, 'مخفي');
    expect((await list('a')).total).toBe(1);
  });

  it('enrollment decisions notify the student, with the admin note', async () => {
    await http()
      .patch(`/v1/admin/enrollments/${ids.pendingEnrollment}/status`)
      .set(as('admin'))
      .send({ status: 'ACTIVE', note: 'أهلاً بك في الدفعة' })
      .expect(200);
    const res = await list('pending');
    expect(res.items[0]).toMatchObject({
      type: 'ENROLLMENT',
      title: 'تم قبول طلب انضمامك',
      message: 'برنامج live: أهلاً بك في الدفعة',
      actionUrl: '/programs/live',
    });

    await http().patch(`/v1/admin/enrollments/${ids.bEnrollment}/status`).set(as('admin')).send({ status: 'SUSPENDED' }).expect(200);
    expect((await list('b')).items[0]).toMatchObject({ type: 'ENROLLMENT', title: 'تم إيقاف وصولك إلى البرنامج مؤقتاً', message: 'برنامج live' });
  });

  it('lists, counts and marks read; only the owner can touch a notification', async () => {
    await publishNewAssignment(ids.liveModule, 'واجب ثانٍ');
    await publishNewAssignment(ids.liveModule, 'واجب ثالث');

    const all = await list('a');
    expect(all).toMatchObject({ total: 3, unreadCount: 3 });
    expect(all.items.map((n) => n.message)).toEqual([
      'واجب ثالث: برنامج live',
      'واجب ثانٍ: برنامج live',
      'واجب الأسبوع الأول: برنامج live',
    ]);
    const page = await list('a', { pageSize: '2', page: '2' });
    expect(page.items).toHaveLength(1);

    const read = await http().patch(`/v1/notifications/${all.items[0].id}/read`).set(as('a')).expect(200);
    expect(read.body.isRead).toBe(true);
    await http().patch(`/v1/notifications/${all.items[1].id}/read`).set(as('b')).expect(404);

    expect((await http().get('/v1/notifications/unread-count').set(as('a')).expect(200)).body).toEqual({ unreadCount: 2 });
    expect((await list('a', { unreadOnly: 'true' })).total).toBe(2);

    const readAll = await http().post('/v1/notifications/read-all').set(as('a')).expect(200);
    expect(readAll.body).toEqual({ updated: 2, unreadCount: 0 });
    expect((await list('a')).unreadCount).toBe(0);
    // Other users untouched.
    expect((await list('b')).unreadCount).toBeGreaterThan(0);

    await http().get('/v1/notifications').expect(401);
    await http().get('/v1/notifications').query({ pageSize: '500' }).set(as('a')).expect(400);
  });
});
