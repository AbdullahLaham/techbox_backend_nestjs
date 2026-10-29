// src/types/api.contract.ts  (shared by the NestJS backend, the Next.js web app and the Expo app)
/**
 * TechBox API contract: programs, curriculum and enrollments
 * ---------------------------------------------------------
 * Copy this file as is into each client (web: `types/api.contract.ts`, mobile:
 * `src/types/api.contract.ts`). It has no runtime imports. Assignments have their own
 * contracts: `assignments.contract.ts` (student) and `assignments.admin.contract.ts`.
 *
 * Conventions
 *  - Dates are ISO 8601 UTC strings. Decimals are numbers.
 *  - Errors on these routes: `ApiErrorBody` ({ statusCode, code, message, details? }).
 *  - Lists that can grow are paginated: `Paginated<T>` (page starts at 1).
 *  - Paths are under `/v1`. The old `/programs` and `/enrollments` paths still answer
 *    with the same bodies, for app versions already installed.
 */

/* ================================ Enums ================================= */

export type GlobalRole = 'SUPER_ADMIN' | 'INCUBATOR_MANAGER' | 'INSTRUCTOR' | 'MENTOR' | 'STUDENT' | 'GUEST';
export type ProgramType = 'ACADEMIC_COURSE' | 'INCUBATOR_BATCH' | 'BOOTCAMP' | 'WORKSHOP_SERIES';
export type ProgramStatus = 'DRAFT' | 'PUBLISHED' | 'ONGOING' | 'COMPLETED' | 'ARCHIVED';
export type NodeType =
  | 'VIDEO_LECTURE'
  | 'LIVE_SESSION'
  | 'ASSIGNMENT'
  | 'READING_MATERIAL'
  | 'QUIZ'
  | 'MENTORSHIP_CHECKIN';
export type SubmissionType = 'FILE_UPLOAD' | 'URL_LINK' | 'TEXT_CONTENT' | 'MULTIMEDIA';
export type AssignmentStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
/**
 * PENDING: applied, waiting for review (holds a seat).
 * ACTIVE: accepted, can open the content.
 * COMPLETED: finished the program, keeps access.
 * SUSPENDED: temporarily blocked, keeps the seat.
 * DROPPED: left or removed after being accepted.
 * REJECTED: application refused; the student may apply again.
 */
export type EnrollmentStatus = 'PENDING' | 'ACTIVE' | 'COMPLETED' | 'SUSPENDED' | 'DROPPED' | 'REJECTED';

export const PROGRAM_TYPES: readonly ProgramType[] = ['ACADEMIC_COURSE', 'INCUBATOR_BATCH', 'BOOTCAMP', 'WORKSHOP_SERIES'];
export const PROGRAM_STATUSES: readonly ProgramStatus[] = ['DRAFT', 'PUBLISHED', 'ONGOING', 'COMPLETED', 'ARCHIVED'];
export const NODE_TYPES: readonly NodeType[] = [
  'VIDEO_LECTURE',
  'LIVE_SESSION',
  'ASSIGNMENT',
  'READING_MATERIAL',
  'QUIZ',
  'MENTORSHIP_CHECKIN',
];
export const ENROLLMENT_STATUSES: readonly EnrollmentStatus[] = [
  'PENDING',
  'ACTIVE',
  'COMPLETED',
  'SUSPENDED',
  'DROPPED',
  'REJECTED',
];

/* ================================ Roles ================================= */

/** Create and edit programs, tracks, modules and lessons. */
export const CONTENT_MANAGER_ROLES = ['SUPER_ADMIN', 'INCUBATOR_MANAGER', 'INSTRUCTOR'] as const;
/** Delete programs, tracks, modules and lessons; create or edit ASSIGNMENT lessons. */
export const CONTENT_OWNER_ROLES = ['SUPER_ADMIN', 'INCUBATOR_MANAGER'] as const;
/** Review enrollment applications and change enrollment status. */
export const ENROLLMENT_MANAGER_ROLES = ['SUPER_ADMIN', 'INCUBATOR_MANAGER'] as const;
/** Staff see every program's content (including drafts) without enrolling. */
export const STAFF_ROLES = ['SUPER_ADMIN', 'INCUBATOR_MANAGER', 'INSTRUCTOR', 'MENTOR'] as const;

/* =============================== Endpoints ============================== */

export const API_ENDPOINTS = {
  // Public (optional Bearer token personalises the detail)
  programs: '/v1/programs',
  program: (slug: string) => `/v1/programs/${encodeURIComponent(slug)}`,
  // Student (Bearer)
  enroll: (programId: string) => `/v1/enrollments/${encodeURIComponent(programId)}`,
  myEnrollments: '/v1/enrollments/my-enrollments',
  // Admin (Bearer + role)
  adminPrograms: '/v1/admin/programs',
  adminProgram: (idOrSlug: string) => `/v1/admin/programs/${encodeURIComponent(idOrSlug)}`,
  adminProgramTracks: (programId: string) => `/v1/admin/programs/${encodeURIComponent(programId)}/tracks`,
  adminTrack: (trackId: string) => `/v1/admin/programs/tracks/${encodeURIComponent(trackId)}`,
  adminTrackModules: (trackId: string) => `/v1/admin/programs/tracks/${encodeURIComponent(trackId)}/modules`,
  adminModule: (moduleId: string) => `/v1/admin/programs/modules/${encodeURIComponent(moduleId)}`,
  adminModuleNodes: (moduleId: string) => `/v1/admin/programs/modules/${encodeURIComponent(moduleId)}/nodes`,
  adminNode: (nodeId: string) => `/v1/admin/programs/nodes/${encodeURIComponent(nodeId)}`,
  adminEnrollments: '/v1/admin/enrollments',
  adminEnrollment: (id: string) => `/v1/admin/enrollments/${encodeURIComponent(id)}`,
  adminEnrollmentStatus: (id: string) => `/v1/admin/enrollments/${encodeURIComponent(id)}/status`,
  // Notifications (Bearer, the caller's own)
  notifications: '/v1/notifications',
  notificationsUnreadCount: '/v1/notifications/unread-count',
  notificationRead: (id: string) => `/v1/notifications/${encodeURIComponent(id)}/read`,
  notificationsReadAll: '/v1/notifications/read-all',
} as const;

/* ================================ Common ================================ */

/** ISO 8601 date-time string (UTC). */
export type IsoDate = string;

export type Paginated<T> = {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
};

export type ApiErrorCode =
  | 'VALIDATION_FAILED'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'SLUG_TAKEN'
  | 'PROGRAM_HAS_ENROLLMENTS'
  | 'CONTENT_HAS_SUBMISSIONS'
  | 'NODE_TYPE_LOCKED'
  | 'ENROLLMENT_CLOSED'
  | 'PROGRAM_FULL'
  | 'ALREADY_ENROLLED'
  | 'INVALID_STATUS_TRANSITION'
  | 'QUIZ_HAS_ATTEMPTS'
  | 'QUIZ_NOT_READY'
  | 'MAX_ATTEMPTS_REACHED'
  | 'SUBMISSION_LOCKED'
  | 'FILE_TOO_LARGE'
  | 'UNSUPPORTED_FILE_TYPE'
  | 'TOO_MANY_REQUESTS'
  | 'INTERNAL_ERROR';

export type ApiErrorBody = {
  statusCode: number;
  /** An ApiErrorCode, or an assignment error code on ASSIGNMENT lessons. */
  code: ApiErrorCode | (string & {});
  message: string;
  /** Field name -> message; only for VALIDATION_FAILED. Nested fields use dots ("videoData.playbackUrl"). */
  details?: Record<string, string>;
};

export const API_ERROR_MESSAGES_AR: Record<ApiErrorCode, string> = {
  VALIDATION_FAILED: 'بعض الحقول غير صالحة، يرجى مراجعتها.',
  UNAUTHORIZED: 'انتهت الجلسة، يرجى تسجيل الدخول مرة أخرى.',
  FORBIDDEN: 'ليست لديك صلاحية للقيام بهذا الإجراء.',
  NOT_FOUND: 'العنصر غير موجود أو تم حذفه.',
  SLUG_TAKEN: 'هذا الرابط التعريفي (Slug) مستخدم لبرنامج آخر.',
  PROGRAM_HAS_ENROLLMENTS: 'لا يمكن حذف برنامج لديه طلاب مسجلون، يمكنك أرشفته بدلاً من ذلك.',
  CONTENT_HAS_SUBMISSIONS: 'لا يمكن الحذف لأن الطلاب سلّموا واجبات ضمن هذا المحتوى.',
  NODE_TYPE_LOCKED: 'لا يمكن تغيير نوع الدرس بعد إنشائه، احذفه وأنشئ درساً جديداً.',
  ENROLLMENT_CLOSED: 'التسجيل في هذا البرنامج مغلق حالياً.',
  PROGRAM_FULL: 'اكتمل العدد الأقصى للمقاعد في هذه الدفعة.',
  ALREADY_ENROLLED: 'لديك طلب تسجيل في هذا البرنامج بالفعل.',
  INVALID_STATUS_TRANSITION: 'لا يمكن تنفيذ هذا التغيير على الحالة الحالية.',
  QUIZ_HAS_ATTEMPTS: 'قدّم الطلاب محاولات على هذا الاختبار، لذا لا يمكن تغيير الأسئلة أو الإجابات الصحيحة أو الدرجات.',
  QUIZ_NOT_READY: 'لا يمكن نشر الاختبار قبل اكتمال أسئلته وإجاباته الصحيحة.',
  MAX_ATTEMPTS_REACHED: 'استنفدت عدد المحاولات المسموح بها لهذا الاختبار.',
  SUBMISSION_LOCKED: 'لا يمكنك التسليم الآن: تسليمك السابق قيد المراجعة أو تم تقييمه.',
  FILE_TOO_LARGE: 'حجم الملف أكبر من الحد المسموح.',
  UNSUPPORTED_FILE_TYPE: 'نوع الملف غير مدعوم.',
  TOO_MANY_REQUESTS: 'عدد كبير من الطلبات، يرجى المحاولة بعد قليل.',
  INTERNAL_ERROR: 'حدث خطأ غير متوقع، يرجى المحاولة لاحقاً.',
};

/* ================================ Limits ================================ */

export const PROGRAM_LIMITS = {
  titleMin: 3,
  titleMax: 200,
  slugMax: 120,
  descriptionMax: 5000,
  curriculumTitleMax: 200,
  curriculumDescriptionMax: 2000,
} as const;

/**
 * Lowercase letters (Arabic allowed), digits, single hyphens between words.
 * Use `slugify` to build one from a title.
 */
// Built with RegExp() so the file compiles for ES2017 targets (the web app) too.
export const SLUG_PATTERN = new RegExp('^[\\p{Ll}\\p{Lo}\\p{Nd}]+(?:-[\\p{Ll}\\p{Lo}\\p{Nd}]+)*$', 'u');

export function slugify(title: string): string {
  return title
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[ً-ٰٟ]/g, '') // Arabic diacritics
    .replace(new RegExp('[^\\p{Ll}\\p{Lo}\\p{Nd}]+', 'gu'), '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, PROGRAM_LIMITS.slugMax)
    .replace(/-+$/g, '');
}

/** Payment receipt attached to an application (multipart field `receipt`). */
export const ENROLLMENT_RECEIPT_LIMITS = {
  maxBytes: 10 * 1024 * 1024,
  /** Extension -> MIME type. The server also checks the file's real type. */
  allowedTypes: {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp',
    '.pdf': 'application/pdf',
  } as Readonly<Record<string, string>>,
} as const;

/* =========================== Programs (public) =========================== */

export type ProgramSeats = {
  /** null = unlimited */
  max: number | null;
  /** Applications holding a seat: PENDING, ACTIVE, COMPLETED, SUSPENDED. */
  taken: number;
  /** null = unlimited */
  remaining: number | null;
};

/** Why `canEnroll` is false. */
export type EnrollmentBlockReason = 'NOT_AVAILABLE' | 'CLOSED' | 'ENDED' | 'FULL';

/** GET /v1/programs (catalog: PUBLISHED and ONGOING programs, newest first). */
export type ProgramSummary = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  type: ProgramType;
  status: ProgramStatus;
  coverImage: string | null;
  startDate: IsoDate | null;
  endDate: IsoDate | null;
  isEnrollmentOpen: boolean;
  seats: ProgramSeats;
  /** isEnrollmentOpen, status PUBLISHED or ONGOING, endDate not passed and a seat left. */
  canEnroll: boolean;
  enrollmentBlockReason: EnrollmentBlockReason | null;
  createdAt: IsoDate;
  updatedAt: IsoDate;
  _count: {
    tracks: number;
    /** Accepted learners (ACTIVE + COMPLETED). */
    enrollments: number;
  };
};

/** The caller's own enrollment in a program. */
export type MyEnrollmentRef = {
  id: string;
  status: EnrollmentStatus;
  /** Admin note on acceptance or rejection, shown to the student. */
  reviewNote: string | null;
  reviewedAt: IsoDate | null;
  hasReceipt: boolean;
  /** completedLessons / totalLessons * 100, 1 decimal (see ProgramProgress). */
  progressPct: number;
  completedLessons: number;
  totalLessons: number;
  createdAt: IsoDate;
};

/**
 * Progress in a program. Counted lessons: mandatory lessons the student can see (QUIZ and
 * ASSIGNMENT lessons only once published). A lesson is done when the video was watched
 * (90%) or marked done, the reading was marked done, the quiz was passed, or the
 * assignment was graded.
 */
export type ProgramProgress = {
  completedLessons: number;
  totalLessons: number;
  /** 0 to 100, 1 decimal; 0 when the program has no counted lessons. */
  percent: number;
};

export type ProgramNodeVideo = {
  durationSec: number;
  /** null while the content is locked for the caller (see `ProgramDetail.canAccessContent`). */
  playbackUrl: string | null;
};

/** Only PUBLISHED assignments appear in the public curriculum. */
export type ProgramNodeAssignment = {
  /** Assignment.id: open it with GET /v1/assignments/:id */
  id: string;
  allowedType: SubmissionType;
  maxScore: number;
  dueDate: IsoDate | null;
  /** null while the content is locked for the caller. */
  instructions: string | null;
};

export type ProgramNode = {
  id: string;
  moduleId: string;
  title: string;
  description: string | null;
  type: NodeType;
  orderIndex: number;
  isMandatory: boolean;
  /** true when the caller cannot open this lesson yet. */
  isLocked: boolean;
  /** The signed-in learner completed this lesson (always false when anonymous or staff). */
  isCompleted: boolean;
  video: ProgramNodeVideo | null;
  assignment: ProgramNodeAssignment | null;
};

export type ProgramModule = {
  id: string;
  trackId: string;
  title: string;
  description: string | null;
  orderIndex: number;
  nodes: ProgramNode[];
};

export type ProgramTrack = {
  id: string;
  programId: string;
  title: string;
  description: string | null;
  orderIndex: number;
  modules: ProgramModule[];
};

/**
 * GET /v1/programs/:slug. Visible for PUBLISHED, ONGOING and COMPLETED programs (staff
 * also see DRAFT and ARCHIVED). Send the Bearer token when signed in to get
 * `myEnrollment` and unlocked content.
 */
export type ProgramDetail = ProgramSummary & {
  tracks: ProgramTrack[];
  /** null when anonymous or never applied. */
  myEnrollment: MyEnrollmentRef | null;
  /** @deprecated Use `myEnrollment`. Same value as a 0- or 1-item list, for older app versions. */
  enrollments: MyEnrollmentRef[];
  /** true for ACTIVE or COMPLETED enrollments, and for staff. */
  canAccessContent: boolean;
};

/* =========================== Programs (admin) =========================== */

/** GET /v1/admin/programs: every program, any status. */
export type AdminProgramListQuery = {
  status?: ProgramStatus;
  type?: ProgramType;
  /** Case-insensitive match on title or slug. */
  q?: string;
};

export type AdminProgram = ProgramSummary & {
  maxSeats: number | null;
  /** Enrollment counts by status, for the dashboard badges. */
  enrollmentCounts: Record<EnrollmentStatus, number>;
};

export type AdminNodeVideo = {
  id: string;
  externalId: string;
  provider: string;
  durationSec: number;
  playbackUrl: string;
  transcodeState: string;
};

export type AdminNodeAssignment = {
  id: string;
  status: AssignmentStatus;
  instructions: string;
  allowedType: SubmissionType;
  maxScore: number;
  dueDate: IsoDate | null;
  publishedAt: IsoDate | null;
};

export type AdminNode = {
  id: string;
  moduleId: string;
  title: string;
  description: string | null;
  type: NodeType;
  orderIndex: number;
  isMandatory: boolean;
  video: AdminNodeVideo | null;
  assignment: AdminNodeAssignment | null;
  createdAt: IsoDate;
  updatedAt: IsoDate;
};

export type AdminModule = {
  id: string;
  trackId: string;
  title: string;
  description: string | null;
  orderIndex: number;
  createdAt: IsoDate;
  updatedAt: IsoDate;
  nodes: AdminNode[];
};

export type AdminTrack = {
  id: string;
  programId: string;
  title: string;
  description: string | null;
  orderIndex: number;
  createdAt: IsoDate;
  updatedAt: IsoDate;
  modules: AdminModule[];
};

/** GET /v1/admin/programs/:idOrSlug (id or slug). */
export type AdminProgramDetail = AdminProgram & { tracks: AdminTrack[] };

/** POST /v1/admin/programs. Returns AdminProgram (201). */
export type CreateProgramBody = {
  title: string;
  /** SLUG_PATTERN; unique (409 SLUG_TAKEN). */
  slug: string;
  description?: string | null;
  /** Default ACADEMIC_COURSE. */
  type?: ProgramType;
  /** Default DRAFT. */
  status?: ProgramStatus;
  /** http(s) URL, or null / "" for none. */
  coverImage?: string | null;
  /** Positive integer, or null for unlimited. Default 30. */
  maxSeats?: number | null;
  startDate?: IsoDate | null;
  /** Must not be before startDate. */
  endDate?: IsoDate | null;
  /** Default true. */
  isEnrollmentOpen?: boolean;
};

/** PATCH /v1/admin/programs/:id. Omitted = unchanged. Returns AdminProgram. */
export type UpdateProgramBody = Partial<CreateProgramBody>;

/**
 * DELETE /v1/admin/programs/:id -> 204. Refused with 409 PROGRAM_HAS_ENROLLMENTS when
 * the program has any enrollment: archive it instead (status ARCHIVED).
 */

/** POST /v1/admin/programs/:programId/tracks. Returns AdminTrack (201, modules []). */
export type CreateTrackBody = {
  title: string;
  description?: string | null;
  /** Default: last position. */
  orderIndex?: number;
};
export type UpdateTrackBody = Partial<CreateTrackBody>;

/** POST /v1/admin/programs/tracks/:trackId/modules. Returns AdminModule (201, nodes []). */
export type CreateModuleBody = CreateTrackBody;
export type UpdateModuleBody = Partial<CreateModuleBody>;

export type NodeVideoData = {
  /** Video id at the provider (Bunny Stream). */
  externalId: string;
  durationSec: number;
  /** http(s) URL */
  playbackUrl: string;
};

/**
 * Assignment fields for ASSIGNMENT lessons. Same rules as POST /v1/admin/assignments
 * (assignments.admin.contract.ts): the assignment starts as DRAFT, so publish it from
 * the assignments screen. Errors use the assignment error codes.
 */
export type NodeAssignmentData = {
  instructions: string;
  allowedType?: SubmissionType;
  maxScore?: number;
  /** ISO date-time in the future, or null. */
  dueDate?: IsoDate | null;
};

/**
 * POST /v1/admin/programs/modules/:moduleId/nodes. Returns AdminNode (201).
 * ASSIGNMENT lessons need `assignmentData` and a role in CONTENT_OWNER_ROLES.
 */
export type CreateNodeBody = {
  title: string;
  description?: string | null;
  type: NodeType;
  /** Default: last position. */
  orderIndex?: number;
  /** Default true. */
  isMandatory?: boolean;
  videoData?: NodeVideoData;
  assignmentData?: NodeAssignmentData;
};

/** PATCH /v1/admin/programs/nodes/:nodeId. `type` cannot change (409 NODE_TYPE_LOCKED). */
export type UpdateNodeBody = Partial<Omit<CreateNodeBody, 'videoData' | 'assignmentData'>> & {
  videoData?: Partial<NodeVideoData>;
  assignmentData?: Partial<NodeAssignmentData>;
};

/**
 * DELETE on tracks, modules and lessons -> 204. Refused with 409 CONTENT_HAS_SUBMISSIONS
 * when students have submitted an assignment inside it.
 */

/* ========================= Enrollments (student) ======================== */

/**
 * POST /v1/enrollments/:programId as multipart/form-data with these text fields and an
 * optional file field `receipt` (ENROLLMENT_RECEIPT_LIMITS). Returns MyEnrollment (201).
 * A REJECTED or DROPPED student can apply again; the same row goes back to PENDING.
 * Errors: 404 NOT_FOUND, 409 ENROLLMENT_CLOSED | PROGRAM_FULL | ALREADY_ENROLLED,
 * 413 FILE_TOO_LARGE, 415 UNSUPPORTED_FILE_TYPE, 400 VALIDATION_FAILED.
 */
export type EnrollmentApplicationFields = {
  fullNameEn: string;
  fullNameAr: string;
  /** 10 to 100 */
  age: number;
  phoneWhatsApp: string;
  nationalId: string;
  governorate: string;
};

/** GET /v1/enrollments/my-enrollments -> MyEnrollment[] (newest first). */
export type MyEnrollment = MyEnrollmentRef & {
  program: {
    id: string;
    title: string;
    slug: string;
    type: ProgramType;
    status: ProgramStatus;
    coverImage: string | null;
    startDate: IsoDate | null;
    endDate: IsoDate | null;
  };
};

/* ========================== Enrollments (admin) ========================= */

export type AdminEnrollmentSort = 'createdAt' | '-createdAt' | 'updatedAt' | '-updatedAt';

/** GET /v1/admin/enrollments */
export type AdminEnrollmentListQuery = {
  /** Default 1 */
  page?: number;
  /** Default 20, max 100 */
  pageSize?: number;
  status?: EnrollmentStatus;
  programId?: string;
  /** Case-insensitive match on email, names, phone or national id. */
  q?: string;
  /** Default -createdAt */
  sort?: AdminEnrollmentSort;
};

export type AdminEnrollmentUser = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  fullNameAr: string | null;
  fullNameEn: string | null;
  phoneWhatsApp: string | null;
};

export type AdminEnrollmentListItem = {
  id: string;
  status: EnrollmentStatus;
  /** Current progress (ProgramProgress.percent). */
  progressPct: number;
  completedLessons: number;
  totalLessons: number;
  hasReceipt: boolean;
  reviewNote: string | null;
  reviewedAt: IsoDate | null;
  createdAt: IsoDate;
  updatedAt: IsoDate;
  user: AdminEnrollmentUser;
  program: { id: string; title: string; slug: string };
};

/** Paginated list plus counts per status for the same filters (ignoring `status`). */
export type AdminEnrollmentList = Paginated<AdminEnrollmentListItem> & {
  statusCounts: Record<EnrollmentStatus, number>;
};

/** GET /v1/admin/enrollments/:id */
export type AdminEnrollmentDetail = AdminEnrollmentListItem & {
  user: AdminEnrollmentUser & {
    age: number | null;
    nationalId: string | null;
    governorate: string | null;
    phoneNumber: string | null;
  };
  /** Short-lived signed link to the receipt (about 1 hour). Never store it. */
  receiptUrl: string | null;
  receiptMimeType: string | null;
  program: { id: string; title: string; slug: string; maxSeats: number | null };
};

/**
 * PATCH /v1/admin/enrollments/:id/status. Returns AdminEnrollmentDetail.
 * Allowed changes are in ENROLLMENT_STATUS_TRANSITIONS (409 INVALID_STATUS_TRANSITION
 * otherwise). Moving a REJECTED or DROPPED enrollment back to ACTIVE needs a free seat
 * (409 PROGRAM_FULL).
 */
export type UpdateEnrollmentStatusBody = {
  status: EnrollmentStatus;
  /** Shown to the student. Up to 1000 characters. Each status change replaces the previous note (omit for none). */
  note?: string | null;
};

export const ENROLLMENT_STATUS_TRANSITIONS: Record<EnrollmentStatus, readonly EnrollmentStatus[]> = {
  PENDING: ['ACTIVE', 'REJECTED'],
  ACTIVE: ['COMPLETED', 'SUSPENDED', 'DROPPED'],
  SUSPENDED: ['ACTIVE', 'DROPPED'],
  COMPLETED: ['ACTIVE'],
  DROPPED: ['ACTIVE'],
  REJECTED: ['PENDING', 'ACTIVE'],
};

/** Statuses that occupy one of the program's seats. */
export const SEAT_HOLDING_STATUSES: readonly EnrollmentStatus[] = ['PENDING', 'ACTIVE', 'COMPLETED', 'SUSPENDED'];

/** Statuses that open the program content. */
export const CONTENT_ACCESS_STATUSES: readonly EnrollmentStatus[] = ['ACTIVE', 'COMPLETED'];

export function canAccessContent(status: EnrollmentStatus | null | undefined): boolean {
  return !!status && CONTENT_ACCESS_STATUSES.includes(status);
}

/** A student may submit a new application (none yet, or the last one was refused or ended). */
export function canApply(status: EnrollmentStatus | null | undefined): boolean {
  return !status || status === 'REJECTED' || status === 'DROPPED';
}

/* ============================= Notifications ============================ */

/**
 * GRADED: a reviewer graded, rejected or asked to revise a hand-in.
 * ENROLLMENT: an admin accepted, rejected, suspended, completed or removed an enrollment.
 * NEW_ASSIGNMENT: an assignment was published in one of the learner's programs.
 * SYSTEM, ANNOUNCEMENT, ASSIGNMENT_DUE: reserved (not sent yet).
 */
export type NotificationType = 'SYSTEM' | 'ASSIGNMENT_DUE' | 'GRADED' | 'ANNOUNCEMENT' | 'ENROLLMENT' | 'NEW_ASSIGNMENT';

export type AppNotification = {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  isRead: boolean;
  /**
   * Where the notification leads, as a resource path the app maps to its own screen:
   *  - `/assignments/<assignmentId>`
   *  - `/programs/<slug>`
   * null when there is nothing to open.
   */
  actionUrl: string | null;
  createdAt: IsoDate;
};

/** GET /v1/notifications?page=&pageSize=&unreadOnly= (newest first). */
export type NotificationListQuery = {
  /** Default 1 */
  page?: number;
  /** Default 20, max 50 */
  pageSize?: number;
  /** Default false */
  unreadOnly?: boolean;
};

export type NotificationList = Paginated<AppNotification> & {
  /** All unread notifications of the user (not only this page). */
  unreadCount: number;
};

/** GET /v1/notifications/unread-count (cheap, for the bell badge). */
export type UnreadCount = { unreadCount: number };

/** POST /v1/notifications/read-all */
export type ReadAllResult = { updated: number; unreadCount: 0 };

/* ================================ Labels ================================ */

export const ENROLLMENT_STATUS_LABELS_AR: Record<EnrollmentStatus, string> = {
  PENDING: 'قيد المراجعة',
  ACTIVE: 'مقبول',
  COMPLETED: 'مكتمل',
  SUSPENDED: 'موقوف',
  DROPPED: 'منسحب',
  REJECTED: 'مرفوض',
};

export const PROGRAM_STATUS_LABELS_AR: Record<ProgramStatus, string> = {
  DRAFT: 'مسودة',
  PUBLISHED: 'منشور',
  ONGOING: 'جارٍ',
  COMPLETED: 'منتهٍ',
  ARCHIVED: 'مؤرشف',
};

export const PROGRAM_TYPE_LABELS_AR: Record<ProgramType, string> = {
  ACADEMIC_COURSE: 'مساق أكاديمي',
  INCUBATOR_BATCH: 'دفعة حاضنة أعمال',
  BOOTCAMP: 'معسكر تدريبي',
  WORKSHOP_SERIES: 'سلسلة ورش عمل',
};

export const NODE_TYPE_LABELS_AR: Record<NodeType, string> = {
  VIDEO_LECTURE: 'محاضرة مرئية',
  LIVE_SESSION: 'جلسة مباشرة',
  ASSIGNMENT: 'واجب',
  READING_MATERIAL: 'مادة قرائية',
  QUIZ: 'اختبار قصير',
  MENTORSHIP_CHECKIN: 'جلسة إرشاد',
};
