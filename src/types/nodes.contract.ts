// src/types/nodes.contract.ts  (shared by the NestJS backend, the Next.js dashboard and the Expo app)
/**
 * Lessons (nodes) and quizzes contract
 * ------------------------------------
 * Human-readable versions: api-contract-mobile.md and api-contract-admin.md (project root).
 * No runtime imports, copy as is. Errors use ApiErrorBody / ApiErrorCode from api.contract.ts.
 *
 * Managed lesson types: QUIZ, VIDEO_LECTURE, READING_MATERIAL. LIVE_SESSION is not supported
 * here; ASSIGNMENT lessons are managed by the assignments API.
 *
 * Security: quiz option correctness (`isCorrect`) is only in the admin types. Student types
 * never carry it; correct answers reach a student only in an attempt result, and only when
 * the quiz has `showCorrectAnswers`.
 */

/* ================================ Enums ================================= */

export type ManagedNodeType = 'QUIZ' | 'VIDEO_LECTURE' | 'READING_MATERIAL';
export const MANAGED_NODE_TYPES: readonly ManagedNodeType[] = ['QUIZ', 'VIDEO_LECTURE', 'READING_MATERIAL'];

export type NodeResourceKind = 'LINK' | 'FILE';

/* =============================== Endpoints ============================== */

export const NODES_ENDPOINTS = {
  // Student (Bearer)
  node: (nodeId: string) => `/v1/nodes/${encodeURIComponent(nodeId)}`,
  nodeProgress: (nodeId: string) => `/v1/nodes/${encodeURIComponent(nodeId)}/progress`,
  quiz: (quizId: string) => `/v1/quizzes/${encodeURIComponent(quizId)}`,
  quizAttempts: (quizId: string) => `/v1/quizzes/${encodeURIComponent(quizId)}/attempts`,
  quizAttempt: (attemptId: string) => `/v1/quizzes/attempts/${encodeURIComponent(attemptId)}`,
  // Admin (Bearer + role)
  adminNodes: '/v1/admin/nodes',
  adminNode: (nodeId: string) => `/v1/admin/nodes/${encodeURIComponent(nodeId)}`,
  adminNodeFile: (nodeId: string) => `/v1/admin/nodes/${encodeURIComponent(nodeId)}/file`,
  adminNodeResource: (nodeId: string) => `/v1/admin/nodes/${encodeURIComponent(nodeId)}/resource`,
  adminQuiz: (quizId: string) => `/v1/admin/quizzes/${encodeURIComponent(quizId)}`,
  adminQuizQuestions: (quizId: string) => `/v1/admin/quizzes/${encodeURIComponent(quizId)}/questions`,
  adminQuizQuestion: (questionId: string) => `/v1/admin/quizzes/questions/${encodeURIComponent(questionId)}`,
  adminQuizAttempts: (quizId: string) => `/v1/admin/quizzes/${encodeURIComponent(quizId)}/attempts`,
  adminQuizAttempt: (attemptId: string) => `/v1/admin/quizzes/attempts/${encodeURIComponent(attemptId)}`,
} as const;

/* ================================ Limits ================================ */

export const NODE_LIMITS = {
  titleMax: 200,
  descriptionMax: 2000,
  urlMax: 2000,
} as const;

/** Reading-material file (multipart field `file`). The server also checks the real file type. */
export const NODE_FILE_LIMITS = {
  maxBytes: 50 * 1024 * 1024,
  allowedTypes: {
    '.pdf': 'application/pdf',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.txt': 'text/plain',
    '.zip': 'application/zip',
  } as Readonly<Record<string, string>>,
} as const;

export const QUIZ_LIMITS = {
  titleMax: 200,
  descriptionMax: 2000,
  /** Every question has exactly this many options, exactly one of them correct. */
  optionsPerQuestion: 4,
  questionTextMax: 2000,
  optionTextMax: 500,
  explanationMax: 2000,
  /** Points per question: > 0, at most this, 2 decimals. */
  pointsMax: 1000,
  questionsMax: 200,
} as const;

/* ============================ Shared shapes ============================= */

export type IsoDate = string;

export type Paginated<T> = { items: T[]; page: number; pageSize: number; total: number };

/** One graded question of an attempt (frozen when the attempt was submitted). */
export type QuizResultQuestion = {
  questionId: string;
  text: string;
  points: number;
  pointsAwarded: number;
  /** null = not answered. */
  selectedOptionId: string | null;
  isCorrect: boolean;
  /** null for students when the quiz hides correct answers. */
  correctOptionId: string | null;
  /** null when none, or hidden together with the correct answer. */
  explanation: string | null;
  options: Array<{ id: string; text: string }>;
};

/* ================================ Student =============================== */

export type StudentNodeResource = {
  kind: NodeResourceKind;
  /** LINK: the external URL. FILE: a signed download URL (about 1 hour; never store it). */
  url: string;
  fileName: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
};

export type StudentQuizSummary = {
  id: string;
  title: string;
  description: string | null;
  questionCount: number;
  totalScore: number;
  passingScore: number;
  /** null = unlimited */
  maxAttempts: number | null;
  attemptsUsed: number;
  /** null = unlimited */
  attemptsRemaining: number | null;
  /** Best score so far, null before the first attempt. */
  bestScore: number | null;
  /** true once any attempt passed. */
  passed: boolean;
  lastAttemptId: string | null;
};

/**
 * GET /v1/nodes/:nodeId. For students with an ACTIVE or COMPLETED enrollment in the
 * lesson's program, and for staff. Anyone else gets 404.
 */
export type NodeContent = {
  id: string;
  moduleId: string;
  program: { id: string; title: string; slug: string };
  type: ManagedNodeType;
  title: string;
  description: string | null;
  isMandatory: boolean;
  /** From the learner's progress (quiz passed, ...). Always false for staff. */
  isCompleted: boolean;
  video: { playbackUrl: string; durationSec: number } | null;
  resource: StudentNodeResource | null;
  /** null for QUIZ lessons whose quiz is not published yet. */
  quiz: StudentQuizSummary | null;
  /** The learner's progress on this lesson (resume position for videos). Zeros for staff. */
  progress: LessonProgress;
};

/* ============================ Lesson progress =========================== */

/** A video counts as completed once this share of it was watched. */
export const VIDEO_COMPLETION_THRESHOLD = 0.9;

export type LessonProgress = {
  isCompleted: boolean;
  /** 0 to 100 */
  completionPct: number;
  /** Where to resume a video. */
  lastPositionSec: number;
  /** Highest position reached (seconds). */
  watchedSeconds: number;
};

/**
 * POST /v1/nodes/:nodeId/progress. VIDEO_LECTURE and READING_MATERIAL only (QUIZ lessons
 * complete by passing, ASSIGNMENT lessons by being graded: 400 otherwise).
 *  - Video: send `positionSec` every ~15 s and on pause/exit; completed at
 *    VIDEO_COMPLETION_THRESHOLD of the duration, or with `completed: true`.
 *  - Reading: send `{ completed: true }` when the learner marks it done.
 * Completion is never undone.
 */
export type UpdateLessonProgressBody = {
  positionSec?: number;
  completed?: boolean;
};

/** Response of POST /v1/nodes/:nodeId/progress. */
export type LessonProgressResult = LessonProgress & {
  nodeId: string;
  /** false for staff previews: nothing is saved. */
  recorded: boolean;
  /** The learner's program progress after this update (null for staff). */
  programProgress: { completedLessons: number; totalLessons: number; percent: number } | null;
};

export type StudentQuizOption = { id: string; text: string };

export type StudentQuizQuestion = {
  id: string;
  text: string;
  points: number;
  orderIndex: number;
  /** Always 4. No correctness information. */
  options: StudentQuizOption[];
};

/** GET /v1/quizzes/:quizId. Published quizzes only (404 otherwise). */
export type StudentQuiz = StudentQuizSummary & { nodeId: string; questions: StudentQuizQuestion[] };

/** POST /v1/quizzes/:quizId/attempts. One entry per question; unanswered questions may be omitted or null. */
export type SubmitQuizBody = {
  answers: Array<{ questionId: string; optionId: string | null }>;
};

/** Response of the submit (201) and of GET /v1/quizzes/attempts/:attemptId. */
export type QuizAttemptResult = {
  /** null for a staff preview (graded, not saved). */
  id: string | null;
  quizId: string;
  nodeId: string;
  score: number;
  totalScore: number;
  passingScore: number;
  /** score / totalScore * 100, rounded to 1 decimal. */
  percentage: number;
  passed: boolean;
  correctCount: number;
  questionCount: number;
  /** 1 for the first attempt. */
  attemptNumber: number;
  /** null = unlimited */
  attemptsRemaining: number | null;
  /** false: correctOptionId and explanation are null in `questions`. */
  showCorrectAnswers: boolean;
  submittedAt: IsoDate;
  questions: QuizResultQuestion[];
};

/** GET /v1/quizzes/:quizId/attempts: the caller's own attempts, newest first. */
export type MyQuizAttempt = {
  id: string;
  attemptNumber: number;
  score: number;
  totalScore: number;
  passingScore: number;
  percentage: number;
  passed: boolean;
  submittedAt: IsoDate;
};

/* ================================= Admin ================================ */

export type AdminNodeResource = StudentNodeResource;

export type AdminQuizSummary = {
  id: string;
  title: string;
  isPublished: boolean;
  questionCount: number;
  totalScore: number;
  passingScore: number;
  attemptsCount: number;
};

/** GET /v1/admin/nodes/:nodeId and every node write. */
export type AdminNodeDetail = {
  id: string;
  moduleId: string;
  type: ManagedNodeType;
  title: string;
  description: string | null;
  orderIndex: number;
  isMandatory: boolean;
  video: { externalId: string; playbackUrl: string; durationSec: number; provider: string } | null;
  resource: AdminNodeResource | null;
  quiz: AdminQuizSummary | null;
  createdAt: IsoDate;
  updatedAt: IsoDate;
};

export type NodeVideoBody = {
  /** http(s) URL (e.g. Bunny embed URL). */
  playbackUrl: string;
  durationSec: number;
  /** Default: the last segment of playbackUrl. */
  externalId?: string;
};

/** Quiz settings. passingScore must not exceed the quiz total once published. */
export type QuizSettingsBody = {
  /** Default: the lesson title. */
  title?: string;
  description?: string | null;
  passingScore?: number;
  /** null = unlimited (default). */
  maxAttempts?: number | null;
  /** Default true. */
  showCorrectAnswers?: boolean;
};

/**
 * POST /v1/admin/nodes -> AdminNodeDetail (201).
 *  - VIDEO_LECTURE: `video` required.
 *  - READING_MATERIAL: `link` here, or upload a file afterwards (POST .../file).
 *  - QUIZ: the (unpublished) quiz is created with the lesson; `quiz` sets its settings.
 */
export type CreateNodeBody = {
  moduleId: string;
  type: ManagedNodeType;
  title: string;
  description?: string | null;
  /** Default: last position in the module. */
  orderIndex?: number;
  /** Default true. */
  isMandatory?: boolean;
  video?: NodeVideoBody;
  link?: string;
  quiz?: QuizSettingsBody;
};

/** PATCH /v1/admin/nodes/:nodeId. `moduleId` and `type` cannot change. */
export type UpdateNodeBody = {
  title?: string;
  description?: string | null;
  orderIndex?: number;
  isMandatory?: boolean;
  video?: Partial<NodeVideoBody>;
  /** READING_MATERIAL: replaces the current link or file. */
  link?: string;
};

export type AdminQuizOption = { id: string; text: string; isCorrect: boolean; orderIndex: number };

export type AdminQuizQuestion = {
  id: string;
  text: string;
  explanation: string | null;
  points: number;
  orderIndex: number;
  options: AdminQuizOption[];
};

/** GET /v1/admin/quizzes/:quizId and every quiz write. */
export type AdminQuiz = {
  id: string;
  nodeId: string;
  title: string;
  description: string | null;
  passingScore: number;
  /** Sum of the question points. */
  totalScore: number;
  maxAttempts: number | null;
  showCorrectAnswers: boolean;
  isPublished: boolean;
  attemptsCount: number;
  /** true once a student attempted: questions, points, correct answers and passingScore are locked. */
  isLocked: boolean;
  questions: AdminQuizQuestion[];
  createdAt: IsoDate;
  updatedAt: IsoDate;
};

/** PATCH /v1/admin/quizzes/:quizId. Publishing checks the quiz is complete (409 QUIZ_NOT_READY). */
export type UpdateQuizBody = QuizSettingsBody & { isPublished?: boolean };

/** POST /v1/admin/quizzes/:quizId/questions -> AdminQuiz (201). */
export type CreateQuizQuestionBody = {
  text: string;
  explanation?: string | null;
  /** Default 1. */
  points?: number;
  /** Default: last position. */
  orderIndex?: number;
  /** Exactly 4, exactly one with isCorrect: true. Kept in this order. */
  options: Array<{ text: string; isCorrect: boolean }>;
};

/**
 * PATCH /v1/admin/quizzes/questions/:questionId -> AdminQuiz. `options` (all 4) updates
 * the options in place by position. After the first attempt only texts, explanation and
 * order may change (409 QUIZ_HAS_ATTEMPTS).
 */
export type UpdateQuizQuestionBody = Partial<CreateQuizQuestionBody>;

/** GET /v1/admin/quizzes/:quizId/attempts */
export type AdminQuizAttemptListQuery = {
  page?: number;
  /** Default 20, max 100 */
  pageSize?: number;
  passed?: boolean;
  studentId?: string;
};

export type AdminQuizAttemptListItem = {
  id: string;
  student: { id: string; email: string; name: string | null };
  attemptNumber: number;
  score: number;
  totalScore: number;
  passingScore: number;
  percentage: number;
  passed: boolean;
  submittedAt: IsoDate;
};

export type AdminQuizAttemptList = Paginated<AdminQuizAttemptListItem> & {
  stats: { attempts: number; students: number; passedStudents: number; averagePercentage: number | null };
};

/** GET /v1/admin/quizzes/attempts/:attemptId: always includes correct answers. */
export type AdminQuizAttemptDetail = AdminQuizAttemptListItem & {
  quizId: string;
  questions: QuizResultQuestion[];
};
