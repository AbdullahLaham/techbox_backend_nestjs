/**
 * Profile tab: /v1/me (profile, avatar, password, sessions, account deletion, achievements,
 * certificates) and public certificate verification (types/profile.contract.ts).
 * WIPES the database: runs only when its name ends with `_test` (see assignments.e2e-spec.ts).
 */
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { AssignmentStatus, EnrollmentStatus, GlobalRole, NodeType, ProgramStatus, SubmissionType } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { existsSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { STORAGE_SERVICE, type StorageService } from '../src/storage/storage.service.js';
import type { HomeResponse } from '../src/types/home.contract.js';
import type {
  CertificateVerification,
  ChangePasswordResult,
  MyAchievements,
  MyCertificates,
  MyProfile,
} from '../src/types/profile.contract.js';

const dbName = new URL(process.env.DATABASE_URL ?? 'postgres://x/none').pathname.slice(1);
const storageDir = mkdtempSync(join(tmpdir(), 'me-e2e-'));
process.env.STORAGE_LOCAL_DIR = storageDir;
process.env.STORAGE_SIGNING_SECRET = 'e2e-secret';
process.env.PUBLIC_API_URL = 'http://localhost';

const PASSWORD = 'correct-horse-1';
const DAY = 24 * 60 * 60 * 1000;
// 1x1 PNG
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
const EXE = Buffer.from('4d5a90000300000004000000ffff0000', 'hex');

describe.skipIf(!dbName.endsWith('_test'))('Profile tab (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const tokens: Record<string, string> = {};
  const ids: Record<string, string> = {};

  const http = () => request(app.getHttpServer());
  const as = (who: string) => ({ Authorization: `Bearer ${tokens[who]}` });
  const profile = async (who: string) => (await http().get('/v1/me/profile').set(as(who)).expect(200)).body as MyProfile;
  const login = (email: string, password: string) => http().post('/auth/login').send({ email, password });
  /** Path + query of a signed link, to fetch it through supertest. */
  const pathOf = (url: string) => {
    const u = new URL(url);
    return u.pathname + u.search;
  };
  const storedFiles = (prefix: string) => {
    const dir = join(storageDir, prefix);
    return existsSync(dir) ? readdirSync(dir, { recursive: true }).length : 0;
  };

  async function user(key: string, role: GlobalRole, profileData: Record<string, unknown> = {}) {
    const u = await prisma.user.create({
      data: {
        email: `${key}@e2e.test`,
        passwordHash: await bcrypt.hash(PASSWORD, 4),
        globalRole: role,
        profile: { create: { firstName: key, lastName: 'Test', ...profileData } },
      },
    });
    ids[key] = u.id;
    tokens[key] = app.get(JwtService).sign({ sub: u.id, email: u.email, globalRole: role });
  }

  async function program(slug: string) {
    const p = await prisma.program.create({
      data: { title: `برنامج ${slug}`, slug, status: ProgramStatus.ONGOING, tracks: { create: { title: 'T', modules: { create: { title: 'M' } } } } },
      include: { tracks: { include: { modules: true } } },
    });
    ids[slug] = p.id;
    ids[`${slug}Module`] = p.tracks[0].modules[0].id;
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);

    await prisma.$executeRawUnsafe(
      'TRUNCATE "Certificate", "LearningActivity", "Submission", "AssignmentAttachment", "Assignment", "QuizAttempt", "QuizOption", "QuizQuestion", "Quiz", "NodeResource", "ProgressLog", "VideoAsset", "ActivityNode", "Module", "Track", "Enrollment", "Program", "UserSession", "UserProfile", "Notification", "User" CASCADE',
    );
    await user('admin', GlobalRole.SUPER_ADMIN);
    await user('sara', GlobalRole.STUDENT, { fullNameAr: 'سارة أحمد علي', nationalId: '400123456', governorate: 'غزة' });
    await user('pw', GlobalRole.STUDENT);
    await user('leaver', GlobalRole.STUDENT, { fullNameAr: 'خالد', nationalId: '999', phoneWhatsApp: '+970599000000', bio: 'x' });
    await user('mentor', GlobalRole.MENTOR);
  });

  afterAll(async () => {
    await app?.close();
    rmSync(storageDir, { recursive: true, force: true });
  });

  describe('profile', () => {
    it('returns the own profile; national ID is shown but cannot be changed here', async () => {
      const me = await profile('sara');
      expect(me).toMatchObject({
        id: ids.sara,
        email: 'sara@e2e.test',
        firstName: 'sara',
        nationalId: '400123456',
        governorate: 'غزة',
        avatarUrl: null,
        canDeleteAccount: true,
      });
      expect((await profile('mentor')).canDeleteAccount).toBe(false);

      const res = await http().patch('/v1/me/profile').set(as('sara')).send({ nationalId: '1' }).expect(400);
      expect(res.body.code).toBe('VALIDATION_FAILED');
      expect((await profile('sara')).nationalId).toBe('400123456');
      await http().get('/v1/me/profile').expect(401);
    });

    it('updates only the fields sent, clears optional ones with "", validates per field', async () => {
      const updated = (
        await http()
          .patch('/v1/me/profile')
          .set(as('sara'))
          .send({ firstName: '  سارة ', bio: 'مطوّرة', age: 22, phoneWhatsApp: '+970599111222' })
          .expect(200)
      ).body as MyProfile;
      expect(updated).toMatchObject({ firstName: 'سارة', lastName: 'Test', bio: 'مطوّرة', age: 22, governorate: 'غزة' });

      expect((await http().patch('/v1/me/profile').set(as('sara')).send({ bio: '' }).expect(200)).body.bio).toBeNull();

      const bad = await http().patch('/v1/me/profile').set(as('sara')).send({ firstName: ' ', age: 5 }).expect(400);
      expect(Object.keys(bad.body.details).sort()).toEqual(['age', 'firstName']);
      await http().patch('/v1/me/profile').set(as('sara')).send({ lastName: null }).expect(400);

      // The session payload follows the new name.
      expect((await http().get('/auth/me').set(as('sara')).expect(200)).body.firstName).toBe('سارة');
    });
  });

  describe('avatar', () => {
    it('uploads, serves through a signed link, replaces and removes the picture', async () => {
      const first = (await http().post('/v1/me/avatar').set(as('sara')).attach('avatar', PNG, 'me.png').expect(200)).body as MyProfile;
      expect(first.avatarUrl).toMatch(/\/v1\/files\/download\?/);
      const file = await http().get(pathOf(first.avatarUrl!)).expect(200);
      expect(file.headers['content-type']).toBe('image/png');
      expect(storedFiles(`avatars/${ids.sara}`)).toBe(1);

      // The same signed link everywhere the picture is shown.
      const home = (await http().get('/v1/home').set(as('sara')).expect(200)).body as HomeResponse;
      expect(home.user.avatarUrl).toMatch(/\/v1\/files\/download\?/);
      const users = await http().get('/v1/admin/users').query({ q: 'sara' }).set(as('admin')).expect(200);
      expect(users.body.items[0].avatarUrl).toMatch(/\/v1\/files\/download\?/);

      // Replacing deletes the old file.
      await http().post('/v1/me/avatar').set(as('sara')).attach('avatar', PNG, 'new.png').expect(200);
      expect(storedFiles(`avatars/${ids.sara}`)).toBe(1);

      const removed = (await http().delete('/v1/me/avatar').set(as('sara')).expect(200)).body as MyProfile;
      expect(removed.avatarUrl).toBeNull();
      expect(storedFiles(`avatars/${ids.sara}`)).toBe(0);
    });

    it('refuses files that are not pictures, and a missing file', async () => {
      const exe = await http().post('/v1/me/avatar').set(as('sara')).attach('avatar', EXE, 'me.png').expect(415);
      expect(exe.body.code).toBe('UNSUPPORTED_FILE_TYPE');
      const none = await http().post('/v1/me/avatar').set(as('sara')).expect(400);
      expect(none.body.details.avatar).toBeDefined();
    });
  });

  describe('achievements', () => {
    beforeAll(async () => {
      await program('learn');
      const reading = await prisma.activityNode.create({ data: { moduleId: ids.learnModule, title: 'r', type: NodeType.READING_MATERIAL, orderIndex: 0 } });
      ids.reading = reading.id;
      const quizNode = await prisma.activityNode.create({
        data: {
          moduleId: ids.learnModule,
          title: 'q',
          type: NodeType.QUIZ,
          orderIndex: 1,
          quiz: {
            create: {
              title: 'Q',
              passingScore: 1,
              isPublished: true,
              questions: { create: { text: 'q', points: 1, options: { create: [0, 1, 2, 3].map((i) => ({ text: `o${i}`, isCorrect: i === 0, orderIndex: i })) } } },
            },
          },
        },
        include: { quiz: { include: { questions: { include: { options: true } } } } },
      });
      const question = quizNode.quiz!.questions[0];
      ids.quiz = quizNode.quiz!.id;
      ids.question = question.id;
      ids.correctOption = question.options.find((o) => o.isCorrect)!.id;
      const assignmentNode = await prisma.activityNode.create({
        data: {
          moduleId: ids.learnModule,
          title: 'a',
          type: NodeType.ASSIGNMENT,
          orderIndex: 2,
          assignment: { create: { instructions: 'x', allowedType: SubmissionType.TEXT_CONTENT, status: AssignmentStatus.PUBLISHED, publishedAt: new Date() } },
        },
        include: { assignment: true },
      });
      await prisma.enrollment.create({ data: { userId: ids.sara, programId: ids.learn, status: EnrollmentStatus.ACTIVE } });
      await prisma.submission.create({
        data: { assignmentId: assignmentNode.assignment!.id, studentId: ids.sara, payload: {}, status: 'GRADED', score: 90 },
      });

      await program('done');
      ids.doneEnrollment = (
        await prisma.enrollment.create({
          data: { userId: ids.sara, programId: ids.done, status: EnrollmentStatus.COMPLETED, reviewedAt: new Date('2026-10-01T10:00:00Z') },
        })
      ).id;
    });

    it('counts lessons, quizzes, graded work, programs and streaks', async () => {
      await http().post(`/v1/nodes/${ids.reading}/progress`).set(as('sara')).send({ completed: true }).expect(200);
      await http()
        .post(`/v1/quizzes/${ids.quiz}/attempts`)
        .set(as('sara'))
        .send({ answers: [{ questionId: ids.question, optionId: ids.correctOption }] })
        .expect(201);
      // Six earlier days in a row (UTC noon), plus today from the actions above.
      await prisma.learningActivity.createMany({
        data: [1, 2, 3, 4, 5, 6].map((d) => {
          const day = new Date(Date.now() - d * DAY);
          day.setUTCHours(12, 0, 0, 0);
          return { userId: ids.sara, bucketStart: day };
        }),
        skipDuplicates: true,
      });

      const res = (await http().get('/v1/me/achievements').query({ tz: 'UTC' }).set(as('sara')).expect(200)).body as MyAchievements;
      expect(res.stats).toEqual({
        completedLessons: 2,
        passedQuizzes: 1,
        gradedAssignments: 1,
        completedPrograms: 1,
        activeDays: 7,
        currentStreakDays: 7,
        longestStreakDays: 7,
      });
      const earned = res.achievements.filter((a) => a.earned).map((a) => a.id);
      expect(earned).toEqual(['FIRST_LESSON', 'FIRST_QUIZ_PASSED', 'FIRST_ASSIGNMENT_GRADED', 'FIRST_PROGRAM_COMPLETED', 'STREAK_7']);
      expect(res.earnedCount).toBe(5);
      expect(res.achievements.find((a) => a.id === 'LESSONS_10')).toMatchObject({ current: 2, target: 10, earned: false });

      await http().get('/v1/me/achievements').query({ tz: 'Mars/Olympus' }).set(as('sara')).expect(400);
    });
  });

  describe('certificates', () => {
    it('issues one per COMPLETED enrollment, once, with the Arabic full name', async () => {
      const first = (await http().get('/v1/me/certificates').set(as('sara')).expect(200)).body as MyCertificates;
      expect(first.items).toHaveLength(1);
      expect(first.items[0]).toMatchObject({
        programId: ids.done,
        programTitle: 'برنامج done',
        holderName: 'سارة أحمد علي',
        issuedAt: '2026-10-01T10:00:00.000Z',
        status: 'VALID',
      });
      expect(first.items[0].code).toMatch(/^TB-[0-9A-Z]{4}-[0-9A-Z]{4}$/);
      ids.code = first.items[0].code;

      const again = (await http().get('/v1/me/certificates').set(as('sara')).expect(200)).body as MyCertificates;
      expect(again.items.map((c) => c.code)).toEqual([ids.code]);
      expect((await http().get('/v1/me/certificates').set(as('pw')).expect(200)).body.items).toEqual([]);
    });

    it('verifies publicly; follows the enrollment when it is reopened and completed again', async () => {
      const typed = ids.code.toLowerCase().replace(/-/g, ' ');
      const ok = (await http().get(`/v1/certificates/verify/${encodeURIComponent(typed)}`).expect(200)).body as CertificateVerification;
      expect(ok).toMatchObject({ code: ids.code, status: 'VALID', holderName: 'سارة أحمد علي', revokedAt: null });

      await http().patch(`/v1/admin/enrollments/${ids.doneEnrollment}/status`).set(as('admin')).send({ status: 'ACTIVE' }).expect(200);
      expect((await http().get(`/v1/certificates/verify/${ids.code}`).expect(200)).body.status).toBe('REVOKED');

      await http().patch(`/v1/admin/enrollments/${ids.doneEnrollment}/status`).set(as('admin')).send({ status: 'COMPLETED' }).expect(200);
      expect((await http().get(`/v1/certificates/verify/${ids.code}`).expect(200)).body).toMatchObject({ status: 'VALID', revokedAt: null });

      expect((await http().get('/v1/certificates/verify/TB-2222-2222').expect(404)).body.code).toBe('NOT_FOUND');
      await http().get('/v1/certificates/verify/not-a-code').expect(404);
    });
  });

  describe('password and sessions', () => {
    it('checks the current password, ends every session and returns a new one', async () => {
      const a = (await login('pw@e2e.test', PASSWORD).expect(201)).body;
      const b = (await login('pw@e2e.test', PASSWORD).expect(201)).body;
      const auth = { Authorization: `Bearer ${a.accessToken}` };

      const wrong = await http().post('/v1/me/password').set(auth).send({ currentPassword: 'nope-nope', newPassword: 'new-password-1' }).expect(400);
      expect(wrong.body.details.currentPassword).toBeDefined();
      const same = await http().post('/v1/me/password').set(auth).send({ currentPassword: PASSWORD, newPassword: PASSWORD }).expect(400);
      expect(same.body.details.newPassword).toBeDefined();
      await http().post('/v1/me/password').set(auth).send({ currentPassword: PASSWORD, newPassword: 'short' }).expect(400);

      const changed = (await http().post('/v1/me/password').set(auth).send({ currentPassword: PASSWORD, newPassword: 'new-password-1' }).expect(200))
        .body as ChangePasswordResult;
      expect(changed.accessToken).toBeTruthy();
      // Both earlier sessions are gone; the new one works.
      await http().post('/auth/refresh').send({ refreshToken: a.refreshToken }).expect(401);
      await http().post('/auth/refresh').send({ refreshToken: b.refreshToken }).expect(401);
      await http().post('/auth/refresh').send({ refreshToken: changed.refreshToken }).expect(200);

      await login('pw@e2e.test', PASSWORD).expect(401);
      await login('pw@e2e.test', 'new-password-1').expect(201);
    });

    it('logout-all ends every session of the caller only', async () => {
      const mine = (await login('pw@e2e.test', 'new-password-1').expect(201)).body;
      const other = (await login('sara@e2e.test', PASSWORD).expect(201)).body;
      const res = await http().post('/v1/me/logout-all').set({ Authorization: `Bearer ${mine.accessToken}` }).expect(200);
      expect(res.body.sessionsEnded).toBeGreaterThanOrEqual(2);
      await http().post('/auth/refresh').send({ refreshToken: mine.refreshToken }).expect(401);
      await http().post('/auth/refresh').send({ refreshToken: other.refreshToken }).expect(200);
    });
  });

  describe('account deletion', () => {
    beforeAll(async () => {
      await program('open');
      await program('finished');
      const storage = app.get<StorageService>(STORAGE_SERVICE);
      await storage.put(`enrollments/leaver/receipt.png`, PNG, { contentType: 'image/png' });
      ids.leaverActive = (
        await prisma.enrollment.create({
          data: { userId: ids.leaver, programId: ids.open, status: EnrollmentStatus.ACTIVE, paymentReceipt: 'enrollments/leaver/receipt.png' },
        })
      ).id;
      ids.leaverDone = (
        await prisma.enrollment.create({ data: { userId: ids.leaver, programId: ids.finished, status: EnrollmentStatus.COMPLETED, reviewedAt: new Date() } })
      ).id;
      await http().post('/v1/me/avatar').set(as('leaver')).attach('avatar', PNG, 'me.png').expect(200);
      ids.leaverCode = ((await http().get('/v1/me/certificates').set(as('leaver')).expect(200)).body as MyCertificates).items[0].code;
      await prisma.notification.create({ data: { userId: ids.leaver, title: 't', message: 'm' } });
    });

    it('is refused for staff and with a wrong password', async () => {
      expect((await http().delete('/v1/me').set(as('mentor')).send({ password: PASSWORD }).expect(403)).body.code).toBe('FORBIDDEN');
      const wrong = await http().delete('/v1/me').set(as('leaver')).send({ password: 'wrong-password' }).expect(400);
      expect(wrong.body.details.password).toBeDefined();
      await http().delete('/v1/me').set(as('leaver')).send({}).expect(400);
    });

    it('closes the account, erases personal data, frees seats and keeps anonymous records', async () => {
      await http().delete('/v1/me').set(as('leaver')).send({ password: PASSWORD }).expect(204);

      await http().get('/v1/me/profile').set(as('leaver')).expect(401);
      await login('leaver@e2e.test', PASSWORD).expect(401);

      const row = await prisma.user.findUniqueOrThrow({ where: { id: ids.leaver }, include: { profile: true } });
      expect(row).toMatchObject({ status: 'ARCHIVED', email: `deleted-${ids.leaver}@deleted.invalid` });
      expect(row.profile).toMatchObject({
        firstName: 'حساب',
        lastName: 'محذوف',
        fullNameAr: null,
        nationalId: null,
        phoneWhatsApp: null,
        bio: null,
        avatarUrl: null,
      });
      expect(await prisma.notification.count({ where: { userId: ids.leaver } })).toBe(0);
      expect(await prisma.userSession.count({ where: { userId: ids.leaver } })).toBe(0);

      const enrollments = await prisma.enrollment.findMany({ where: { userId: ids.leaver }, orderBy: { createdAt: 'asc' } });
      expect(enrollments.map((e) => [e.id, e.status, e.paymentReceipt])).toEqual([
        [ids.leaverActive, 'DROPPED', null],
        [ids.leaverDone, 'COMPLETED', null],
      ]);
      expect(storedFiles(`avatars/${ids.leaver}`)).toBe(0);
      expect(existsSync(join(storageDir, 'enrollments/leaver/receipt.png'))).toBe(false);

      // The certificate stays verifiable as revoked, without the name.
      const cert = (await http().get(`/v1/certificates/verify/${ids.leaverCode}`).expect(200)).body as CertificateVerification;
      expect(cert).toMatchObject({ status: 'REVOKED', holderName: null });

      // The address can register again.
      await http()
        .post('/auth/register')
        .send({ email: 'leaver@e2e.test', password: 'brand-new-pass', firstName: 'خالد', lastName: 'جديد' })
        .expect(201);
    });
  });
});
