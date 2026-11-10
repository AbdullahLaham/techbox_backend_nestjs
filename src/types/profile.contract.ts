// src/types/profile.contract.ts  (shared by the Expo app and the NestJS backend)
/**
 * Profile tab contract: the signed-in user's own profile, account security,
 * achievements and certificates.
 *
 * Self-contained on purpose (no imports): copy this file as is into the app's src/types/.
 *
 * Every /v1/me route needs a Bearer token and works on the caller only.
 * Errors use the v1 shape { statusCode, code, message, details? }.
 */

export const PROFILE_ENDPOINTS = {
  profile: '/v1/me/profile', // GET, PATCH
  avatar: '/v1/me/avatar', // POST (multipart field `avatar`), DELETE
  password: '/v1/me/password', // POST
  logoutAll: '/v1/me/logout-all', // POST
  account: '/v1/me', // DELETE
  achievements: '/v1/me/achievements', // GET ?tz=
  certificates: '/v1/me/certificates', // GET
  /** Public, no token. */
  verifyCertificate: (code: string) => `/v1/certificates/verify/${encodeURIComponent(code)}`,
} as const;

/* --------------------------------- Shared -------------------------------- */

/** ISO 8601 date-time (UTC). */
export type IsoDate = string;
export type GlobalRole = 'SUPER_ADMIN' | 'INCUBATOR_MANAGER' | 'INSTRUCTOR' | 'MENTOR' | 'STUDENT' | 'GUEST';

export const PROFILE_LIMITS = {
  nameMax: 50,
  fullNameMax: 150,
  bioMax: 500,
  phoneMax: 30,
  governorateMax: 100,
  ageMin: 10,
  ageMax: 100,
  passwordMin: 8,
  /** bcrypt ignores bytes after 72. */
  passwordMax: 72,
} as const;

/** Profile picture (multipart field `avatar`). The server also checks the file's real type. */
export const AVATAR_LIMITS = {
  maxBytes: 2 * 1024 * 1024,
  allowedTypes: {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp',
  } as Readonly<Record<string, string>>,
} as const;

/* --------------------------------- Profile ------------------------------- */

/** GET /v1/me/profile, and the response of PATCH /v1/me/profile and the avatar routes. */
export type MyProfile = {
  id: string;
  email: string;
  globalRole: GlobalRole;
  createdAt: IsoDate;
  firstName: string | null;
  lastName: string | null;
  /** Signed link that expires after about an hour: fetch the profile again for a fresh one. null = no picture. */
  avatarUrl: string | null;
  bio: string | null;
  fullNameAr: string | null;
  fullNameEn: string | null;
  age: number | null;
  phoneWhatsApp: string | null;
  governorate: string | null;
  /** Read-only here: official data used in applications. Changed by the administration only. */
  nationalId: string | null;
  /** Students and guests can delete their account in the app; staff accounts are removed by the administration. */
  canDeleteAccount: boolean;
};

/**
 * PATCH /v1/me/profile. Send only the fields to change.
 * firstName / lastName cannot be emptied; for the other fields "" or null clears them.
 * Invalid values: 400 VALIDATION_FAILED with `details` per field.
 */
export type UpdateMyProfileBody = {
  firstName?: string;
  lastName?: string;
  bio?: string | null;
  fullNameAr?: string | null;
  fullNameEn?: string | null;
  age?: number | null;
  phoneWhatsApp?: string | null;
  governorate?: string | null;
};

/* --------------------------------- Security ------------------------------ */

/**
 * POST /v1/me/password. A wrong current password gives 400 VALIDATION_FAILED with
 * details.currentPassword. On success every session ends (all devices) and this device gets
 * a new pair of tokens: store them, as after a login.
 */
export type ChangePasswordBody = { currentPassword: string; newPassword: string };
export type ChangePasswordResult = { accessToken: string; refreshToken: string };

/** POST /v1/me/logout-all: ends every session, this device included. Sign out locally afterwards. */
export type LogoutAllResult = { sessionsEnded: number };

/**
 * DELETE /v1/me with { password } -> 204. Students and guests only (403 FORBIDDEN for staff).
 * Wrong password: 400 VALIDATION_FAILED with details.password. Effects, final:
 *  - the account is closed (ARCHIVED) and every session ends; the email can be used to register again;
 *  - personal data is erased: name, picture, bio, phone numbers, national ID, governorate, age, payment receipts, notifications;
 *  - open applications and enrollments are withdrawn (DROPPED), which frees their seats;
 *  - certificates are revoked; submissions, grades and quiz results stay, without the name.
 */
export type DeleteAccountBody = { password: string };

/* ------------------------------- Achievements ---------------------------- */

export type AchievementId =
  | 'FIRST_LESSON'
  | 'LESSONS_10'
  | 'LESSONS_50'
  | 'FIRST_QUIZ_PASSED'
  | 'QUIZZES_5'
  | 'FIRST_ASSIGNMENT_GRADED'
  | 'FIRST_PROGRAM_COMPLETED'
  | 'STREAK_7'
  | 'ACTIVE_DAYS_30';

export type AchievementStats = {
  /** Completed mandatory lessons in ACTIVE and COMPLETED enrollments (same number as the Home stats). */
  completedLessons: number;
  /** Quizzes passed at least once. */
  passedQuizzes: number;
  /** Assignments with a GRADED hand-in. */
  gradedAssignments: number;
  /** Enrollments with status COMPLETED. */
  completedPrograms: number;
  /** Days with learning activity, in the request timezone (last 400 days). */
  activeDays: number;
  /** Consecutive active days up to today, or up to yesterday when today has no activity yet. */
  currentStreakDays: number;
  longestStreakDays: number;
};

export type AchievementMetric = Exclude<keyof AchievementStats, 'currentStreakDays'>;

/** Every achievement, the order the app shows them in, with its Arabic text. */
export const ACHIEVEMENTS: readonly {
  id: AchievementId;
  metric: AchievementMetric;
  target: number;
  title: string;
  description: string;
}[] = [
  { id: 'FIRST_LESSON', metric: 'completedLessons', target: 1, title: 'الخطوة الأولى', description: 'أنجز أول درس' },
  { id: 'LESSONS_10', metric: 'completedLessons', target: 10, title: 'متعلّم مثابر', description: 'أنجز 10 دروس' },
  { id: 'LESSONS_50', metric: 'completedLessons', target: 50, title: 'شغف لا يتوقف', description: 'أنجز 50 درساً' },
  { id: 'FIRST_QUIZ_PASSED', metric: 'passedQuizzes', target: 1, title: 'أول نجاح', description: 'اجتز أول اختبار' },
  { id: 'QUIZZES_5', metric: 'passedQuizzes', target: 5, title: 'خبير الاختبارات', description: 'اجتز 5 اختبارات' },
  { id: 'FIRST_ASSIGNMENT_GRADED', metric: 'gradedAssignments', target: 1, title: 'عمل مُقيَّم', description: 'احصل على تقييم أول واجب' },
  { id: 'FIRST_PROGRAM_COMPLETED', metric: 'completedPrograms', target: 1, title: 'خرّيج تك بوكس', description: 'أتمّ أول برنامج' },
  { id: 'STREAK_7', metric: 'longestStreakDays', target: 7, title: 'أسبوع متواصل', description: 'تعلّم 7 أيام متتالية' },
  { id: 'ACTIVE_DAYS_30', metric: 'activeDays', target: 30, title: 'عادة راسخة', description: 'تعلّم في 30 يوماً مختلفاً' },
];

export type MyAchievement = {
  id: AchievementId;
  metric: AchievementMetric;
  target: number;
  /** The metric's value, capped at `target`, for a progress bar. */
  current: number;
  earned: boolean;
};

/** GET /v1/me/achievements?tz=Asia/Gaza (tz as GET /v1/home; default Asia/Gaza). */
export type MyAchievements = {
  timeZone: string;
  stats: AchievementStats;
  /** Same order as ACHIEVEMENTS. */
  achievements: MyAchievement[];
  earnedCount: number;
};

/* ------------------------------- Certificates ---------------------------- */

/**
 * A certificate is issued automatically for every enrollment with status COMPLETED.
 * The name (Arabic full name, else English, else first + last name) and the program title
 * are fixed at issue time. Revoked when the enrollment is reopened (back when it is
 * completed again) or when the account is deleted.
 */
export type CertificateStatus = 'VALID' | 'REVOKED';

export type MyCertificate = {
  id: string;
  /** Verification code, e.g. "TB-7K3M-9QX2". */
  code: string;
  programId: string;
  programTitle: string;
  holderName: string | null;
  issuedAt: IsoDate;
  status: CertificateStatus;
};

/** GET /v1/me/certificates: newest first (revoked ones included, marked). */
export type MyCertificates = { items: MyCertificate[] };

/**
 * GET /v1/certificates/verify/:code (public, rate limited). Case and spaces are ignored.
 * Unknown code: 404 NOT_FOUND.
 */
export type CertificateVerification = {
  code: string;
  status: CertificateStatus;
  /** null once revoked because the account was deleted. */
  holderName: string | null;
  programTitle: string;
  issuedAt: IsoDate;
  revokedAt: IsoDate | null;
};
