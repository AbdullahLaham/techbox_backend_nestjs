/**
 * User management (docs/updates/06-user-management.md, api-contract-users.md).
 * WIPES the database: runs only when its name ends with `_test` (see assignments.e2e-spec.ts).
 */
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { GlobalRole, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import type { AdminUserDetail, AdminUserList } from '../src/types/api.contract.js';

const dbName = new URL(process.env.DATABASE_URL ?? 'postgres://x/none').pathname.slice(1);
const PASSWORD = 'initial-pass-123';

describe.skipIf(!dbName.endsWith('_test'))('User management (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const tokens: Record<string, string> = {};
  const refresh: Record<string, string> = {};
  const ids: Record<string, string> = {};

  const http = () => request(app.getHttpServer());
  const as = (who: string) => ({ Authorization: `Bearer ${tokens[who]}` });

  /** Real sign-in, so sessions exist and can be revoked. */
  async function signIn(key: string, email: string, password = PASSWORD) {
    const res = await http().post('/auth/login').send({ email, password }).expect(201);
    tokens[key] = res.body.accessToken;
    refresh[key] = res.body.refreshToken;
  }

  async function seedUser(key: string, role: GlobalRole, extra: { fullNameAr?: string } = {}) {
    const u = await prisma.user.create({
      data: {
        email: `${key}@e2e.test`,
        passwordHash: await bcrypt.hash(PASSWORD, 4),
        globalRole: role,
        profile: { create: { firstName: key, lastName: 'Test', ...extra } },
      },
    });
    ids[key] = u.id;
    await signIn(key, `${key}@e2e.test`);
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
    await seedUser('owner', GlobalRole.SUPER_ADMIN);
    await seedUser('manager', GlobalRole.INCUBATOR_MANAGER);
    await seedUser('instructor', GlobalRole.INSTRUCTOR);
    await seedUser('student', GlobalRole.STUDENT, { fullNameAr: 'سارة أحمد' });
  });

  afterAll(async () => {
    await app?.close();
  });

  it('only owners and managers can open user management', async () => {
    await http().get('/v1/admin/users').set(as('instructor')).expect(403);
    await http().get('/v1/admin/users').set(as('student')).expect(403);
    await http().get('/v1/admin/users').expect(401);
  });

  it('lists with search, filters, counts, last seen and canManage', async () => {
    const all = (await http().get('/v1/admin/users').set(as('manager')).expect(200)).body as AdminUserList;
    expect(all.total).toBe(4);
    expect(all.roleCounts).toMatchObject({ SUPER_ADMIN: 1, INCUBATOR_MANAGER: 1, INSTRUCTOR: 1, STUDENT: 1, MENTOR: 0 });
    expect(all.statusCounts).toMatchObject({ ACTIVE: 4, SUSPENDED: 0 });
    const byEmail = Object.fromEntries(all.items.map((u) => [u.email, u]));
    // A manager cannot manage owners or managers (or themselves).
    expect(byEmail['owner@e2e.test'].canManage).toBe(false);
    expect(byEmail['manager@e2e.test'].canManage).toBe(false);
    expect(byEmail['instructor@e2e.test'].canManage).toBe(true);
    expect(byEmail['student@e2e.test']).toMatchObject({ displayName: 'سارة أحمد', canManage: true });
    expect(byEmail['student@e2e.test'].lastSeenAt).not.toBeNull();

    const search = (await http().get('/v1/admin/users').query({ q: 'سارة' }).set(as('owner')).expect(200)).body as AdminUserList;
    expect(search.items.map((u) => u.email)).toEqual(['student@e2e.test']);
    const staff = (await http().get('/v1/admin/users').query({ role: 'INSTRUCTOR' }).set(as('owner')).expect(200)).body;
    expect(staff.total).toBe(1);
    const sorted = (await http().get('/v1/admin/users').query({ sort: 'email' }).set(as('owner')).expect(200)).body as AdminUserList;
    expect(sorted.items.map((u) => u.email)).toEqual([...sorted.items.map((u) => u.email)].sort());
  });

  it('creates staff within the caller\'s rights; the new account can sign in', async () => {
    const forbidden = await http()
      .post('/v1/admin/users')
      .set(as('manager'))
      .send({ email: 'boss@e2e.test', password: PASSWORD, firstName: 'B', lastName: 'B', role: 'INCUBATOR_MANAGER' })
      .expect(403);
    expect(forbidden.body.code).toBe('FORBIDDEN');

    const created = (await http()
      .post('/v1/admin/users')
      .set(as('manager'))
      .send({ email: '  Mentor@E2E.test ', password: PASSWORD, firstName: 'منى', lastName: 'خالد', role: 'MENTOR', phoneNumber: '+970599111111' })
      .expect(201)).body as AdminUserDetail;
    expect(created).toMatchObject({ email: 'mentor@e2e.test', globalRole: 'MENTOR', status: 'ACTIVE', phoneNumber: '+970599111111', canManage: true });
    expect(created.stats).toEqual({ enrollments: 0, activeEnrollments: 0, submissions: 0, quizAttempts: 0, gradedSubmissions: 0 });
    expect(JSON.stringify(created)).not.toContain('passwordHash');
    ids.mentor = created.id;
    await signIn('mentor', 'mentor@e2e.test');

    const dupEmail = await http()
      .post('/v1/admin/users')
      .set(as('owner'))
      .send({ email: 'mentor@e2e.test', password: PASSWORD, firstName: 'X', lastName: 'Y', role: 'STUDENT' })
      .expect(409);
    expect(dupEmail.body).toMatchObject({ code: 'EMAIL_TAKEN', details: { email: expect.any(String) } });
    const dupPhone = await http()
      .post('/v1/admin/users')
      .set(as('owner'))
      .send({ email: 'x@e2e.test', password: PASSWORD, firstName: 'X', lastName: 'Y', role: 'STUDENT', phoneNumber: '+970599111111' })
      .expect(409);
    expect(dupPhone.body.code).toBe('PHONE_TAKEN');

    const weak = await http()
      .post('/v1/admin/users')
      .set(as('owner'))
      .send({ email: 'y@e2e.test', password: 'short', firstName: 'X', lastName: 'Y', role: 'STUDENT' })
      .expect(400);
    expect(weak.body.details.password).toBeDefined();

    // Owners may create owners.
    await http()
      .post('/v1/admin/users')
      .set(as('owner'))
      .send({ email: 'owner2@e2e.test', password: PASSWORD, firstName: 'O', lastName: 'Two', role: 'SUPER_ADMIN' })
      .expect(201);
  });

  it('edits profiles; managers cannot edit owners', async () => {
    const edited = await http()
      .patch(`/v1/admin/users/${ids.instructor}`)
      .set(as('manager'))
      .send({ firstName: 'Ahmad', phoneNumber: '+970599222222' })
      .expect(200);
    expect(edited.body).toMatchObject({ firstName: 'Ahmad', lastName: 'Test', phoneNumber: '+970599222222' });
    const cleared = await http().patch(`/v1/admin/users/${ids.instructor}`).set(as('manager')).send({ phoneNumber: null }).expect(200);
    expect(cleared.body.phoneNumber).toBeNull();

    await http().patch(`/v1/admin/users/${ids.owner}`).set(as('manager')).send({ firstName: 'Nope' }).expect(403);
    // Own profile is always editable.
    await http().patch(`/v1/admin/users/${ids.manager}`).set(as('manager')).send({ lastName: 'Manager' }).expect(200);
  });

  it('changes roles within the rules; takes effect on the next request', async () => {
    const promote = await http().patch(`/v1/admin/users/${ids.student}/role`).set(as('manager')).send({ role: 'INCUBATOR_MANAGER' }).expect(403);
    expect(promote.body.code).toBe('FORBIDDEN');
    const self = await http().patch(`/v1/admin/users/${ids.manager}/role`).set(as('manager')).send({ role: 'STUDENT' }).expect(409);
    expect(self.body.code).toBe('CANNOT_MODIFY_SELF');

    // Instructor's token works on content routes, then loses access right after the change.
    await http().get('/v1/admin/programs').set(as('instructor')).expect(200);
    const res = await http().patch(`/v1/admin/users/${ids.instructor}/role`).set(as('manager')).send({ role: 'STUDENT' }).expect(200);
    expect(res.body.globalRole).toBe('STUDENT');
    await http().get('/v1/admin/programs').set(as('instructor')).expect(403);

    await http().patch(`/v1/admin/users/${ids.manager}/role`).set(as('owner')).send({ role: 'INSTRUCTOR' }).expect(200);
    await http().patch(`/v1/admin/users/${ids.manager}/role`).set(as('owner')).send({ role: 'INCUBATOR_MANAGER' }).expect(200);
  });

  it('suspends (signs out everywhere), reactivates and archives', async () => {
    const before = (await http().get(`/v1/admin/users/${ids.mentor}`).set(as('manager')).expect(200)).body as AdminUserDetail;
    expect(before.activeSessions).toBe(1);

    const suspended = await http().patch(`/v1/admin/users/${ids.mentor}/status`).set(as('manager')).send({ status: 'SUSPENDED' }).expect(200);
    expect(suspended.body).toMatchObject({ status: 'SUSPENDED', activeSessions: 0 });
    await http().get('/auth/me').set(as('mentor')).expect(401);
    await http().post('/auth/refresh').send({ refreshToken: refresh.mentor }).expect(401);
    await http().post('/auth/login').send({ email: 'mentor@e2e.test', password: PASSWORD }).expect(401);

    await http().patch(`/v1/admin/users/${ids.mentor}/status`).set(as('manager')).send({ status: 'ACTIVE' }).expect(200);
    await signIn('mentor', 'mentor@e2e.test');

    await http().patch(`/v1/admin/users/${ids.mentor}/status`).set(as('manager')).send({ status: 'PENDING' }).expect(400);
    await http().patch(`/v1/admin/users/${ids.owner}/status`).set(as('manager')).send({ status: 'SUSPENDED' }).expect(403);
    const self = await http().patch(`/v1/admin/users/${ids.manager}/status`).set(as('manager')).send({ status: 'ARCHIVED' }).expect(409);
    expect(self.body.code).toBe('CANNOT_MODIFY_SELF');

    const archived = await http().patch(`/v1/admin/users/${ids.mentor}/status`).set(as('manager')).send({ status: 'ARCHIVED' }).expect(200);
    expect(archived.body.status).toBe('ARCHIVED');
    expect((await prisma.user.count({ where: { id: ids.mentor } }))).toBe(1); // data kept
  });

  it('owners manage other owners; the last owner can never lose access', async () => {
    const owner2 = await prisma.user.findUniqueOrThrow({ where: { email: 'owner2@e2e.test' } });
    await signIn('owner2', 'owner2@e2e.test');

    // With two active owners, one may suspend or demote the other.
    await http().patch(`/v1/admin/users/${ids.owner}/status`).set(as('owner2')).send({ status: 'SUSPENDED' }).expect(200);
    await http().get('/v1/admin/users').set(as('owner')).expect(401);

    // owner2 is now the only active owner: nobody can remove it. Itself: CANNOT_MODIFY_SELF;
    // managers cannot touch owners (403); the suspended owner cannot sign in.
    const self = await http().patch(`/v1/admin/users/${owner2.id}/role`).set(as('owner2')).send({ role: 'STUDENT' }).expect(409);
    expect(self.body.code).toBe('CANNOT_MODIFY_SELF');
    await http().patch(`/v1/admin/users/${owner2.id}/status`).set(as('manager')).send({ status: 'SUSPENDED' }).expect(403);
    await http().post('/auth/login').send({ email: 'owner@e2e.test', password: PASSWORD }).expect(401);

    // Restore and demote owner2 back to a normal role for the next tests.
    await http().patch(`/v1/admin/users/${ids.owner}/status`).set(as('owner2')).send({ status: 'ACTIVE' }).expect(200);
    await signIn('owner', 'owner@e2e.test');
    await http().patch(`/v1/admin/users/${owner2.id}/role`).set(as('owner')).send({ role: 'STUDENT' }).expect(200);
    expect((await prisma.user.count({ where: { globalRole: GlobalRole.SUPER_ADMIN, status: UserStatus.ACTIVE } }))).toBe(1);
  });

  it('resets passwords and signs the user out', async () => {
    await http().post(`/v1/admin/users/${ids.student}/password`).set(as('manager')).send({ password: 'x' }).expect(400);
    await http().post(`/v1/admin/users/${ids.owner}/password`).set(as('manager')).send({ password: 'new-pass-123456' }).expect(403);

    await http().post(`/v1/admin/users/${ids.student}/password`).set(as('manager')).send({ password: 'new-pass-123456' }).expect(204);
    await http().post('/auth/refresh').send({ refreshToken: refresh.student }).expect(401);
    await http().post('/auth/login').send({ email: 'student@e2e.test', password: PASSWORD }).expect(401);
    await http().post('/auth/login').send({ email: 'student@e2e.test', password: 'new-pass-123456' }).expect(201);
    await http().get('/v1/admin/users/nope').set(as('owner')).expect(404);
  });
});
