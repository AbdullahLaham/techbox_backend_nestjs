// src/types/home.contract.ts  (shared by the Expo app and the NestJS backend)
/**
 * Home screen contract: GET /v1/home
 * ----------------------------------
 * One request feeds the whole Home tab: header badge, greeting, "continue learning" hero,
 * stats row, weekly activity, upcoming assignments, recommended programs and the incubator card.
 *
 * Self-contained on purpose (no imports): copy this file as is into the app's src/types/.
 *
 * Rules:
 *  - Bearer token required; everything is the caller's own data.
 *  - Read-only: the endpoint never changes anything.
 *  - The server decides facts (counts, progress, which lesson is next, which day was active).
 *    The client decides presentation (labels, colours, icons).
 *  - Same rules as the dedicated endpoints, so numbers match the other screens:
 *      progress     = GET /v1/enrollments/my-enrollments (mandatory, visible lessons)
 *      assignments  = GET /v1/assignments (TODO = not submitted or needs revision)
 *      notifications = GET /v1/notifications/unread-count
 *      seats / canEnroll = GET /v1/programs
 */

export const HOME_ENDPOINT = '/v1/home' as const;

/** Timezone used for "today" and the weekly activity when the app sends none. */
export const HOME_DEFAULT_TIME_ZONE = 'Asia/Gaza';
/** Max items in `recommendedPrograms`. */
export const HOME_RECOMMENDED_LIMIT = 6;
/** Max items in `assignments.upcoming`. */
export const HOME_UPCOMING_ASSIGNMENTS_LIMIT = 3;

/** GET /v1/home?tz= */
export type HomeQuery = {
  /**
   * IANA timezone of the device, e.g. "Asia/Gaza"
   * (`Intl.DateTimeFormat().resolvedOptions().timeZone`). Unknown names give 400 VALIDATION_FAILED.
   * Default HOME_DEFAULT_TIME_ZONE.
   */
  tz?: string;
};

/* ------------------------------ Schema enums ----------------------------- */

/** ISO 8601 date-time (UTC). */
export type IsoDate = string;
/** Calendar date in the request timezone, "YYYY-MM-DD". */
export type LocalDate = string;

export type ProgramType = 'ACADEMIC_COURSE' | 'INCUBATOR_BATCH' | 'BOOTCAMP' | 'WORKSHOP_SERIES';
export type EnrollmentStatus = 'PENDING' | 'ACTIVE' | 'COMPLETED' | 'SUSPENDED' | 'DROPPED' | 'REJECTED';
export type NodeType =
  | 'VIDEO_LECTURE'
  | 'LIVE_SESSION'
  | 'ASSIGNMENT'
  | 'READING_MATERIAL'
  | 'QUIZ'
  | 'MENTORSHIP_CHECKIN';
export type NotificationType = 'SYSTEM' | 'ASSIGNMENT_DUE' | 'GRADED' | 'ANNOUNCEMENT' | 'ENROLLMENT' | 'NEW_ASSIGNMENT';
/** Why a new application would be refused (same as ProgramSummary.enrollmentBlockReason). */
export type EnrollmentBlockReason = 'NOT_AVAILABLE' | 'CLOSED' | 'ENDED' | 'FULL';

/* --------------------------------- Header -------------------------------- */

export type HomeUser = {
  id: string;
  /** UserProfile fields; null when the user has no profile yet. */
  firstName: string | null;
  lastName: string | null;
  avatarUrl: string | null;
};

export type HomeNotificationPreview = {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  /** Same format as AppNotification.actionUrl: `/assignments/<id>`, `/programs/<slug>` or null. */
  actionUrl: string | null;
  createdAt: IsoDate;
};

export type HomeNotificationsSummary = {
  /** Every unread notification of the user: drives the bell badge ("You have 3 unread notifications"). */
  unreadCount: number;
  /** The newest unread notification, or null when everything is read. */
  latestUnread: HomeNotificationPreview | null;
};

/* ---------------------------- Continue learning -------------------------- */

export type HomeProgramRef = {
  id: string;
  title: string;
  slug: string;
  type: ProgramType;
  coverImage: string | null;
};

/**
 * The next lesson to open: the first lesson of the program, in curriculum order, that the
 * student has not completed and can act on. Skipped: unpublished assignments and quizzes, and
 * assignments already submitted (waiting for a grader) or closed (graded / rejected).
 */
export type HomeNextLesson = {
  /** ActivityNode.id -> /lesson/[nodeId] */
  id: string;
  title: string;
  type: NodeType;
  isMandatory: boolean;
  moduleTitle: string;
  trackTitle: string;
  /** Set for ASSIGNMENT lessons -> /assignment/[assignmentId]; null otherwise. */
  assignmentId: string | null;
};

export type HomeContinueLearning = {
  enrollmentId: string;
  program: HomeProgramRef;
  /** 0–100, one decimal: completed / total mandatory visible lessons. */
  progressPct: number;
  completedLessons: number;
  totalLessons: number;
  /** null when nothing is left to do (all done, or the program has no lessons yet). */
  nextLesson: HomeNextLesson | null;
  /** Last lesson activity of the student in this program; null when never started. */
  lastActivityAt: IsoDate | null;
};

/* ---------------------------------- Stats -------------------------------- */

export type HomeStats = {
  /** Enrollments with status ACTIVE ("برامج حالية"). */
  activePrograms: number;
  /** Enrollments with status COMPLETED ("برامج مكتملة"). */
  completedPrograms: number;
  /** Applications waiting for the administration (PENDING). */
  pendingApplications: number;
  /** Completed mandatory lessons over ACTIVE + COMPLETED enrollments ("دروس منجزة"). */
  completedLessons: number;
  /** Mandatory visible lessons over ACTIVE + COMPLETED enrollments. */
  totalLessons: number;
};

/* ----------------------------- Weekly activity --------------------------- */

export type Weekday = 'SAT' | 'SUN' | 'MON' | 'TUE' | 'WED' | 'THU' | 'FRI';

export type HomeActivityDay = {
  date: LocalDate;
  weekday: Weekday;
  /** The student watched/read a lesson, submitted an assignment or took a quiz that day. */
  isActive: boolean;
  isToday: boolean;
  /** Later than today (always isActive: false). */
  isFuture: boolean;
};

/**
 * The current week, Saturday to Friday, in the request timezone.
 * Activity sources: lesson progress (video / reading), assignment submissions, quiz attempts.
 * Grading by staff is not the student's activity and does not count.
 */
export type HomeWeeklyActivity = {
  /** The timezone actually used (the `tz` query, or the default). */
  timeZone: string;
  weekStart: LocalDate;
  weekEnd: LocalDate;
  /** Always 7 items, Saturday first. */
  days: HomeActivityDay[];
  activeDaysCount: number;
};

/* ------------------------------- Assignments ----------------------------- */

/** Same states as AssignmentState of the assignments contract, limited to the TODO bucket. */
export type HomeAssignmentTodoState = 'NOT_SUBMITTED' | 'NEEDS_REVISION';

export type HomeUpcomingAssignment = {
  /** Assignment.id -> /assignment/[assignmentId] */
  id: string;
  title: string;
  dueDate: IsoDate | null;
  /** dueDate has passed and the student still has to submit. */
  isOverdue: boolean;
  state: HomeAssignmentTodoState;
  program: { id: string; title: string; slug: string };
};

export type HomeAssignmentsSummary = {
  /** Published assignments the student must act on (not submitted, or asked to revise). */
  todoCount: number;
  /** Part of todoCount whose deadline has passed. */
  overdueCount: number;
  /** Submitted, waiting for a grader. */
  awaitingReviewCount: number;
  /**
   * TODO assignments, nearest deadline first (overdue first, no deadline last),
   * at most HOME_UPCOMING_ASSIGNMENTS_LIMIT.
   */
  upcoming: HomeUpcomingAssignment[];
};

/* --------------------------- Recommended programs ------------------------ */

/**
 * Catalog programs (PUBLISHED / ONGOING) the student has not joined or applied to
 * (REJECTED and DROPPED may apply again, so those programs are recommended too).
 * Open programs first, then newest. At most HOME_RECOMMENDED_LIMIT.
 */
export type HomeRecommendedProgram = HomeProgramRef & {
  startDate: IsoDate | null;
  /** Visible lessons (mandatory and optional), as listed in the curriculum. */
  lessonsCount: number;
  /** Sum of the video lengths in seconds (0 without videos). Hours = Math.round(sec / 3600). */
  videoDurationSec: number;
  /** null = unlimited seats. */
  seatsRemaining: number | null;
  canEnroll: boolean;
  enrollmentBlockReason: EnrollmentBlockReason | null;
};

/* -------------------------------- Incubator ------------------------------ */

/** The current INCUBATOR_BATCH program of the catalog (open one first, then newest). */
export type HomeIncubator = {
  program: HomeProgramRef;
  canEnroll: boolean;
  enrollmentBlockReason: EnrollmentBlockReason | null;
  /** The caller's enrollment in this batch, or null when they never applied. */
  myEnrollmentStatus: EnrollmentStatus | null;
};

/* -------------------------------- Response ------------------------------- */

export type HomeResponse = {
  generatedAt: IsoDate;
  user: HomeUser;
  notifications: HomeNotificationsSummary;
  /** The ACTIVE program the student touched last (newest ACTIVE one if none touched); null without one. */
  continueLearning: HomeContinueLearning | null;
  stats: HomeStats;
  weeklyActivity: HomeWeeklyActivity;
  assignments: HomeAssignmentsSummary;
  recommendedPrograms: HomeRecommendedProgram[];
  /** null when the catalog has no incubator batch (hide the card or keep it static). */
  incubator: HomeIncubator | null;
};

/* ----------------------------- Example response -------------------------- */

export const HOME_RESPONSE_EXAMPLE: HomeResponse = {
  generatedAt: '2026-11-07T09:30:00.000Z',
  user: { id: 'u_1', firstName: 'أحمد', lastName: 'خالد', avatarUrl: null },
  notifications: {
    unreadCount: 3,
    latestUnread: {
      id: 'n_9',
      type: 'NEW_ASSIGNMENT',
      title: 'واجب جديد',
      message: 'بناء واجهة تسجيل الدخول: تطوير التطبيقات بـ React Native',
      actionUrl: '/assignments/a_1',
      createdAt: '2026-11-07T08:00:00.000Z',
    },
  },
  continueLearning: {
    enrollmentId: 'e_1',
    program: { id: 'p_rn', title: 'تطوير التطبيقات بـ React Native', slug: 'react-native', type: 'BOOTCAMP', coverImage: null },
    progressPct: 41.7,
    completedLessons: 5,
    totalLessons: 12,
    nextLesson: {
      id: 'n_6',
      title: 'التنقل بين الشاشات',
      type: 'VIDEO_LECTURE',
      isMandatory: true,
      moduleTitle: 'الأساسيات',
      trackTitle: 'المسار الأول',
      assignmentId: null,
    },
    lastActivityAt: '2026-11-06T18:20:00.000Z',
  },
  stats: { activePrograms: 1, completedPrograms: 1, pendingApplications: 0, completedLessons: 17, totalLessons: 24 },
  weeklyActivity: {
    timeZone: 'Asia/Gaza',
    weekStart: '2026-11-07',
    weekEnd: '2026-11-13',
    days: [
      { date: '2026-11-07', weekday: 'SAT', isActive: true, isToday: true, isFuture: false },
      { date: '2026-11-08', weekday: 'SUN', isActive: false, isToday: false, isFuture: true },
      { date: '2026-11-09', weekday: 'MON', isActive: false, isToday: false, isFuture: true },
      { date: '2026-11-10', weekday: 'TUE', isActive: false, isToday: false, isFuture: true },
      { date: '2026-11-11', weekday: 'WED', isActive: false, isToday: false, isFuture: true },
      { date: '2026-11-12', weekday: 'THU', isActive: false, isToday: false, isFuture: true },
      { date: '2026-11-13', weekday: 'FRI', isActive: false, isToday: false, isFuture: true },
    ],
    activeDaysCount: 1,
  },
  assignments: {
    todoCount: 2,
    overdueCount: 0,
    awaitingReviewCount: 1,
    upcoming: [
      {
        id: 'a_1',
        title: 'بناء واجهة تسجيل الدخول',
        dueDate: '2026-11-10T20:59:00.000Z',
        isOverdue: false,
        state: 'NOT_SUBMITTED',
        program: { id: 'p_rn', title: 'تطوير التطبيقات بـ React Native', slug: 'react-native' },
      },
    ],
  },
  recommendedPrograms: [
    {
      id: 'p_pg',
      title: 'قواعد البيانات مع PostgreSQL',
      slug: 'postgresql',
      type: 'ACADEMIC_COURSE',
      coverImage: null,
      startDate: '2026-12-01T00:00:00.000Z',
      lessonsCount: 15,
      videoDurationSec: 18000,
      seatsRemaining: 12,
      canEnroll: true,
      enrollmentBlockReason: null,
    },
  ],
  incubator: {
    program: { id: 'p_inc', title: 'حاضنة المشاريع - الدفعة الثالثة', slug: 'incubator-3', type: 'INCUBATOR_BATCH', coverImage: null },
    canEnroll: true,
    enrollmentBlockReason: null,
    myEnrollmentStatus: null,
  },
};
