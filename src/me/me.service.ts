import { Inject, Injectable, Logger } from '@nestjs/common';
import { EnrollmentStatus, GlobalRole, Prisma, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { randomBytes, randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuthService } from '../auth/auth.service.js';
import { ProgressService, EMPTY_PROGRESS } from '../progress/progress.service.js';
import { ActivityService } from '../activity/activity.service.js';
import { CertificatesService, REVOKED_ACCOUNT_DELETED } from '../certificates/certificates.module.js';
import { STORAGE_SERVICE, type StorageService } from '../storage/storage.service.js';
import { apiError } from '../common/api-errors.js';
import { inspectUpload } from '../common/uploads.js';
import {
  ACHIEVEMENTS,
  AVATAR_LIMITS,
  type AchievementStats,
  type ChangePasswordResult,
  type LogoutAllResult,
  type MyAchievements,
  type MyCertificates,
  type MyProfile,
} from '../types/profile.contract.js';
import { avatarUrlFor, isExternalUrl } from './avatar-url.js';
import { activityDays } from './streaks.js';
import { ChangePasswordDto, DeleteAccountDto, UpdateMyProfileDto } from './me.dto.js';

const BCRYPT_ROUNDS = 10;
/** Achievements look this far back for active days and streaks. */
const ACTIVITY_LOOKBACK_DAYS = 400;
/** Only these roles may delete their own account; staff accounts are removed by the administration. */
const SELF_DELETABLE_ROLES: GlobalRole[] = [GlobalRole.STUDENT, GlobalRole.GUEST];
/** Enrollments a deleted account gives up (frees the seat). COMPLETED stays as history. */
const OPEN_ENROLLMENT_STATUSES: EnrollmentStatus[] = [
  EnrollmentStatus.PENDING,
  EnrollmentStatus.ACTIVE,
  EnrollmentStatus.SUSPENDED,
];

const PROFILE_SELECT = {
  id: true,
  email: true,
  globalRole: true,
  createdAt: true,
  profile: {
    select: {
      firstName: true,
      lastName: true,
      avatarUrl: true,
      bio: true,
      fullNameAr: true,
      fullNameEn: true,
      age: true,
      phoneWhatsApp: true,
      governorate: true,
      nationalId: true,
    },
  },
} satisfies Prisma.UserSelect;

type ProfileRow = Prisma.UserGetPayload<{ select: typeof PROFILE_SELECT }>;

/** Legacy receipts were never in StorageService (see enrollments.service.ts). */
const isLegacyFile = (key: string) => key.startsWith('/uploads/');

/** The signed-in user's own account: /v1/me (types/profile.contract.ts). */
@Injectable()
export class MeService {
  private readonly logger = new Logger('Me');

  constructor(
    private readonly prisma: PrismaService,
    @Inject(STORAGE_SERVICE) private readonly storage: StorageService,
    private readonly auth: AuthService,
    private readonly progress: ProgressService,
    private readonly activity: ActivityService,
    private readonly certificates: CertificatesService,
  ) {}

  /* --------------------------------- Profile ------------------------------ */

  async profile(userId: string): Promise<MyProfile> {
    const row = await this.prisma.user.findUnique({ where: { id: userId }, select: PROFILE_SELECT });
    if (!row) throw apiError('NOT_FOUND', 'User not found.');
    return this.toProfile(row);
  }

  async updateProfile(userId: string, dto: UpdateMyProfileDto): Promise<MyProfile> {
    // Only the fields that were sent; undefined means "leave as is".
    const data = Object.fromEntries(
      Object.entries(dto).filter(([, value]) => value !== undefined),
    ) as Prisma.UserProfileUpdateInput;

    if (Object.keys(data).length > 0) {
      const exists = await this.prisma.userProfile.findUnique({ where: { userId }, select: { id: true } });
      if (exists) {
        await this.prisma.userProfile.update({ where: { userId }, data });
      } else {
        // Accounts made without a profile: the names are needed to create one.
        if (!dto.firstName || !dto.lastName) {
          throw apiError('VALIDATION_FAILED', 'First and last name are required.', {
            ...(dto.firstName ? {} : { firstName: 'الاسم الأول مطلوب' }),
            ...(dto.lastName ? {} : { lastName: 'اسم العائلة مطلوب' }),
          });
        }
        await this.prisma.userProfile.create({
          data: { ...(data as Prisma.UserProfileUncheckedCreateInput), userId, firstName: dto.firstName, lastName: dto.lastName },
        });
      }
      this.audit(userId, 'profile.update', { fields: Object.keys(data) });
    }
    return this.profile(userId);
  }

  async uploadAvatar(userId: string, file: Express.Multer.File | undefined): Promise<MyProfile> {
    if (!file) throw apiError('VALIDATION_FAILED', 'No picture was sent.', { avatar: 'اختر صورة' });
    const inspected = await inspectUpload(file, AVATAR_LIMITS.allowedTypes);

    const current = await this.prisma.userProfile.findUnique({ where: { userId }, select: { avatarUrl: true } });
    if (!current) {
      throw apiError('VALIDATION_FAILED', 'Complete your profile first.', { avatar: 'أكمل اسمك في الملف الشخصي أولاً' });
    }

    const key = `avatars/${userId}/${randomUUID()}${inspected.ext}`;
    await this.storage.put(key, file.buffer, { contentType: inspected.mimeType });
    try {
      await this.prisma.userProfile.update({ where: { userId }, data: { avatarUrl: key } });
    } catch (error) {
      await this.deleteFile(key);
      throw error;
    }
    if (current.avatarUrl) await this.deleteFile(current.avatarUrl);
    this.audit(userId, 'profile.avatar.update');
    return this.profile(userId);
  }

  async removeAvatar(userId: string): Promise<MyProfile> {
    const current = await this.prisma.userProfile.findUnique({ where: { userId }, select: { avatarUrl: true } });
    if (current?.avatarUrl) {
      await this.prisma.userProfile.update({ where: { userId }, data: { avatarUrl: null } });
      await this.deleteFile(current.avatarUrl);
      this.audit(userId, 'profile.avatar.remove');
    }
    return this.profile(userId);
  }

  /* -------------------------------- Security ------------------------------ */

  /** Ends every session (all devices) and returns a new one for this device. */
  async changePassword(userId: string, dto: ChangePasswordDto): Promise<ChangePasswordResult> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { id: true, email: true, globalRole: true, passwordHash: true },
    });
    if (!(await bcrypt.compare(dto.currentPassword, user.passwordHash))) {
      throw apiError('VALIDATION_FAILED', 'Current password is incorrect.', {
        currentPassword: 'كلمة المرور الحالية غير صحيحة',
      });
    }
    if (await bcrypt.compare(dto.newPassword, user.passwordHash)) {
      throw apiError('VALIDATION_FAILED', 'The new password is the current one.', {
        newPassword: 'اختر كلمة مرور مختلفة عن الحالية',
      });
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, BCRYPT_ROUNDS);
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: userId }, data: { passwordHash } }),
      this.prisma.userSession.deleteMany({ where: { userId } }),
    ]);
    this.audit(userId, 'password.change');
    return this.auth.issueTokens(user);
  }

  async logoutAll(userId: string): Promise<LogoutAllResult> {
    const { count } = await this.prisma.userSession.deleteMany({ where: { userId } });
    this.audit(userId, 'sessions.revoke_all', { count });
    return { sessionsEnded: count };
  }

  /**
   * Account deletion (store requirement). Closes the account and erases personal data; learning
   * records (submissions, grades, quiz results, progress) stay, attached to an anonymous profile.
   */
  async deleteAccount(userId: string, dto: DeleteAccountDto): Promise<void> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        globalRole: true,
        passwordHash: true,
        profile: { select: { avatarUrl: true } },
        enrollments: { select: { paymentReceipt: true } },
      },
    });
    if (!SELF_DELETABLE_ROLES.includes(user.globalRole)) {
      throw apiError('FORBIDDEN', 'Staff accounts are removed by the administration.');
    }
    if (!(await bcrypt.compare(dto.password, user.passwordHash))) {
      throw apiError('VALIDATION_FAILED', 'Password is incorrect.', { password: 'كلمة المرور غير صحيحة' });
    }

    const now = new Date();
    // Nobody knows this password, so the account can never be signed into again.
    const unusableHash = await bcrypt.hash(randomBytes(32).toString('hex'), BCRYPT_ROUNDS);
    await this.prisma.$transaction([
      this.prisma.enrollment.updateMany({
        where: { userId, status: { in: OPEN_ENROLLMENT_STATUSES } },
        data: { status: EnrollmentStatus.DROPPED, reviewNote: 'حذف الطالب حسابه', reviewedAt: now },
      }),
      this.prisma.enrollment.updateMany({ where: { userId }, data: { paymentReceipt: null } }),
      this.prisma.certificate.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: now } }),
      this.prisma.certificate.updateMany({
        where: { userId },
        data: { holderName: null, revokeReason: REVOKED_ACCOUNT_DELETED },
      }),
      this.prisma.userProfile.updateMany({
        where: { userId },
        data: {
          firstName: 'حساب',
          lastName: 'محذوف',
          phoneNumber: null,
          avatarUrl: null,
          bio: null,
          fullNameAr: null,
          fullNameEn: null,
          age: null,
          phoneWhatsApp: null,
          nationalId: null,
          governorate: null,
          metadata: Prisma.DbNull,
        },
      }),
      this.prisma.notification.deleteMany({ where: { userId } }),
      this.prisma.userSession.deleteMany({ where: { userId } }),
      // `.invalid` is reserved: never deliverable, and the real address can register again.
      this.prisma.user.update({
        where: { id: userId },
        data: { status: UserStatus.ARCHIVED, email: `deleted-${userId}@deleted.invalid`, passwordHash: unusableHash },
      }),
    ]);

    // Files after the commit; a failure only leaves an orphan file, logged.
    const files = [user.profile?.avatarUrl, ...user.enrollments.map((e) => e.paymentReceipt)];
    for (const key of files) if (key) await this.deleteFile(key);
    this.audit(userId, 'account.delete');
  }

  /* ------------------------ Achievements & certificates ------------------- */

  async achievements(userId: string, timeZone: string): Promise<MyAchievements> {
    const now = new Date();
    const since = new Date(now.getTime() - ACTIVITY_LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
    const enrollments = await this.prisma.enrollment.findMany({ where: { userId }, select: { id: true, status: true } });
    const withAccess = enrollments.filter(
      (e) => e.status === EnrollmentStatus.ACTIVE || e.status === EnrollmentStatus.COMPLETED,
    );

    const [progress, passedQuizzes, gradedAssignments, activity] = await Promise.all([
      this.progress.forEnrollments(withAccess.map((e) => e.id)),
      this.prisma.quizAttempt.groupBy({ by: ['quizId'], where: { studentId: userId, passed: true } }),
      this.prisma.submission.groupBy({ by: ['assignmentId'], where: { studentId: userId, status: 'GRADED' } }),
      this.activity.since(userId, since),
    ]);

    const days = activityDays(now, timeZone, activity);
    const stats: AchievementStats = {
      completedLessons: withAccess.reduce((sum, e) => sum + (progress.get(e.id) ?? EMPTY_PROGRESS).completedLessons, 0),
      passedQuizzes: passedQuizzes.length,
      gradedAssignments: gradedAssignments.length,
      completedPrograms: enrollments.filter((e) => e.status === EnrollmentStatus.COMPLETED).length,
      ...days,
    };
    const achievements = ACHIEVEMENTS.map(({ id, metric, target }) => ({
      id,
      metric,
      target,
      current: Math.min(stats[metric], target),
      earned: stats[metric] >= target,
    }));
    return { timeZone, stats, achievements, earnedCount: achievements.filter((a) => a.earned).length };
  }

  certificatesOf(userId: string): Promise<MyCertificates> {
    return this.certificates.mine(userId);
  }

  /* --------------------------------- Helpers ------------------------------ */

  private async toProfile(row: ProfileRow): Promise<MyProfile> {
    const p = row.profile;
    return {
      id: row.id,
      email: row.email,
      globalRole: row.globalRole,
      createdAt: row.createdAt.toISOString(),
      firstName: p?.firstName ?? null,
      lastName: p?.lastName ?? null,
      avatarUrl: await avatarUrlFor(this.storage, p?.avatarUrl),
      bio: p?.bio ?? null,
      fullNameAr: p?.fullNameAr ?? null,
      fullNameEn: p?.fullNameEn ?? null,
      age: p?.age ?? null,
      phoneWhatsApp: p?.phoneWhatsApp ?? null,
      governorate: p?.governorate ?? null,
      nationalId: p?.nationalId ?? null,
      canDeleteAccount: SELF_DELETABLE_ROLES.includes(row.globalRole),
    };
  }

  private async deleteFile(key: string) {
    if (isExternalUrl(key) || isLegacyFile(key)) return;
    try {
      await this.storage.delete(key);
    } catch (error) {
      this.logger.error(JSON.stringify({ event: 'storage.orphan', storageKey: key, error: String(error) }));
    }
  }

  private audit(userId: string, action: string, extra: Record<string, unknown> = {}) {
    this.logger.log(JSON.stringify({ userId, action, ...extra }));
  }
}
