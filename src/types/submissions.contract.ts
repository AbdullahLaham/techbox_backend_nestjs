// src/types/submissions.contract.ts  (shared by the NestJS backend, the Next.js dashboard and the Expo app)
/**
 * Assignment submissions contract
 * -------------------------------
 * Human-readable versions: api-contract-mobile.md and api-contract-admin.md (project root).
 * No runtime imports, copy as is. Errors use ApiErrorBody / ApiErrorCode from api.contract.ts.
 *
 * Rules
 *  - Every attempt is a new Submission row; an earlier attempt is never overwritten.
 *  - A student may submit when they have no submission yet, or when their latest one is
 *    NEEDS_REVISION. Otherwise 409 SUBMISSION_LOCKED.
 *  - Submissions after the deadline are accepted and flagged `isLate`.
 *  - What a submission must contain depends on Assignment.allowedType (SUBMISSION_RULES).
 */

/* ================================ Enums ================================= */

export type SubmissionType = 'FILE_UPLOAD' | 'URL_LINK' | 'TEXT_CONTENT' | 'MULTIMEDIA';
export type SubmissionStatus = 'SUBMITTED' | 'UNDER_REVIEW' | 'GRADED' | 'REJECTED' | 'NEEDS_REVISION';

/** Statuses a grader can set (PATCH .../grade). */
export type GradeStatus = 'UNDER_REVIEW' | 'GRADED' | 'NEEDS_REVISION' | 'REJECTED';
export const GRADE_STATUSES: readonly GradeStatus[] = ['UNDER_REVIEW', 'GRADED', 'NEEDS_REVISION', 'REJECTED'];

/** Roles that review and grade submissions (no per-program scoping in v1). */
export const SUBMISSION_REVIEWER_ROLES = ['SUPER_ADMIN', 'INCUBATOR_MANAGER', 'INSTRUCTOR'] as const;

/* =============================== Endpoints ============================== */

export const SUBMISSIONS_ENDPOINTS = {
  // Student (Bearer). The same paths without `/v1` also answer, for older app versions.
  submit: (assignmentId: string) => `/v1/assignments/${encodeURIComponent(assignmentId)}/submit`,
  mySubmission: (assignmentId: string) => `/v1/assignments/${encodeURIComponent(assignmentId)}/my-submission`,
  // Reviewer (Bearer + SUBMISSION_REVIEWER_ROLES)
  adminAssignmentSubmissions: (assignmentId: string) =>
    `/v1/admin/assignments/${encodeURIComponent(assignmentId)}/submissions`,
  adminSubmission: (submissionId: string) => `/v1/admin/submissions/${encodeURIComponent(submissionId)}`,
  adminGrade: (submissionId: string) => `/v1/admin/submissions/${encodeURIComponent(submissionId)}/grade`,
} as const;

/* ================================ Limits ================================ */

export const SUBMISSION_LIMITS = {
  maxFiles: 5,
  maxFileBytes: 20 * 1024 * 1024,
  maxLinks: 5,
  urlMax: 2000,
  textMax: 20_000,
  feedbackMax: 5000,
  /** Extension -> MIME type. The server also checks the real file type. */
  allowedFileTypes: {
    '.pdf': 'application/pdf',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
  } as Readonly<Record<string, string>>,
} as const;

/**
 * What each assignment type accepts. `text` is the answer for TEXT_CONTENT and an
 * optional note for the other types.
 */
export const SUBMISSION_RULES: Record<
  SubmissionType,
  { files: [min: number, max: number]; links: [min: number, max: number]; textRequired: boolean }
> = {
  FILE_UPLOAD: { files: [1, 5], links: [0, 0], textRequired: false },
  URL_LINK: { files: [0, 0], links: [1, 1], textRequired: false },
  TEXT_CONTENT: { files: [0, 0], links: [0, 0], textRequired: true },
  /** At least one link or one file. */
  MULTIMEDIA: { files: [0, 5], links: [0, 5], textRequired: false },
};

/* ================================ Request =============================== */

/**
 * POST /v1/assignments/:assignmentId/submit
 *  - JSON (`Content-Type: application/json`) for URL_LINK and TEXT_CONTENT, or
 *  - multipart/form-data with the same text fields (`text`, `links` repeated) and the
 *    files in the field `files` (repeat the field for several files).
 */
export type SubmitAssignmentBody = {
  /** TEXT_CONTENT: the answer (required). Other types: optional note. Up to 20,000 characters. */
  text?: string;
  /** URL_LINK: exactly 1. MULTIMEDIA: 0 to 5. http(s) only. */
  links?: string[];
};

/* =============================== Responses ============================== */

export type SubmissionFile = {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  /** Signed download URL (about 1 hour). Never store it. */
  url: string;
};

/** What the student handed in. */
export type SubmissionContent = {
  type: SubmissionType;
  text: string | null;
  links: string[];
  files: SubmissionFile[];
};

export type SubmissionView = {
  id: string;
  assignmentId: string;
  /** 1 for the student's first attempt on this assignment. */
  attemptNumber: number;
  status: SubmissionStatus;
  submittedAt: string;
  /** Submitted after the assignment's dueDate. */
  isLate: boolean;
  /** null until graded (GRADED always has a score). */
  score: number | null;
  maxScore: number;
  feedback: string | null;
  /** When a reviewer last changed the status, score or feedback; null while SUBMITTED. */
  reviewedAt: string | null;
  content: SubmissionContent;
};

/** Why `canSubmit` is false. */
export type SubmitBlockReason = 'AWAITING_REVIEW' | 'GRADED' | 'REJECTED';

/** GET /v1/assignments/:assignmentId/my-submission */
export type MySubmissionResponse = {
  assignmentId: string;
  allowedType: SubmissionType;
  maxScore: number;
  dueDate: string | null;
  /** The latest attempt, or null when nothing was submitted yet. */
  latest: SubmissionView | null;
  /** Every attempt, newest first. */
  attempts: SubmissionView[];
  canSubmit: boolean;
  submitBlockReason: SubmitBlockReason | null;
};

/* ================================= Admin ================================ */

export type AdminSubmissionStudent = {
  id: string;
  email: string;
  name: string | null;
};

export type AdminSubmission = SubmissionView & {
  student: AdminSubmissionStudent;
  grader: { id: string; name: string | null } | null;
  assignment: { id: string; title: string; maxScore: number; dueDate: string | null };
};

/** GET /v1/admin/assignments/:assignmentId/submissions */
export type AdminSubmissionListQuery = {
  /** Default 1 */
  page?: number;
  /** Default 20, max 100 */
  pageSize?: number;
  status?: SubmissionStatus;
  /** Default true: only each student's latest attempt. false lists every attempt. */
  latestOnly?: boolean;
  /** Case-insensitive match on the student's email or name. */
  q?: string;
};

export type AdminSubmissionList = {
  items: AdminSubmission[];
  page: number;
  pageSize: number;
  total: number;
  /** Counts per status over the same rows, ignoring `status`. */
  statusCounts: Record<SubmissionStatus, number>;
};

/**
 * PATCH /v1/admin/submissions/:submissionId/grade -> AdminSubmission.
 *  - GRADED requires `score` (0 to maxScore, 2 decimals).
 *  - NEEDS_REVISION and REJECTED take an optional score; UNDER_REVIEW marks the work as being reviewed.
 *  - Omitted `feedback` keeps the current one; null clears it.
 */
export type GradeSubmissionBody = {
  status: GradeStatus;
  score?: number | null;
  feedback?: string | null;
};
