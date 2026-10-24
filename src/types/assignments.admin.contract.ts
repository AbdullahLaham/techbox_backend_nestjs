// src/types/assignments.admin.contract.ts  (shared by the Next.js dashboard and the NestJS backend)
/**
 * Assignments admin contract (ASSIGNMENTS_SPEC.md sections 4 to 7)
 * -------------------------------------------------------------
 * Types for /v1/admin/assignments/**, plus the student detail (GET /v1/assignments/:id).
 * No runtime dependency on Prisma, so the dashboard can import this file as is.
 */

import type { AssignmentItem, SubmissionType } from './assignments.contract.js';

export const ADMIN_ASSIGNMENTS_ENDPOINT = '/v1/admin/assignments' as const;

/* --------------------------------- Enums --------------------------------- */

export type AssignmentStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';

export const ASSIGNMENT_STATUSES: readonly AssignmentStatus[] = ['DRAFT', 'PUBLISHED', 'ARCHIVED'];

export const SUBMISSION_TYPES: readonly SubmissionType[] = [
  'FILE_UPLOAD',
  'URL_LINK',
  'TEXT_CONTENT',
  'MULTIMEDIA',
];

/** Roles allowed on /v1/admin/assignments/** (decision R1). */
export const ASSIGNMENT_MANAGER_ROLES = ['SUPER_ADMIN', 'INCUBATOR_MANAGER'] as const;

/** Allowed status changes (section 4.1). Anything else is INVALID_STATUS_TRANSITION. */
export const ASSIGNMENT_STATUS_TRANSITIONS: Record<AssignmentStatus, readonly AssignmentStatus[]> = {
  DRAFT: ['PUBLISHED'],
  PUBLISHED: ['DRAFT', 'ARCHIVED'],
  ARCHIVED: ['PUBLISHED'],
};

/* -------------------------------- Limits --------------------------------- */

export const ASSIGNMENT_FIELD_LIMITS = {
  titleMin: 3,
  titleMax: 200,
  instructionsMax: 10_000,
  maxScoreMax: 999.99,
  pageSizeMax: 100,
} as const;

/** Instruction files (section 7.1, decision F1). */
export const ATTACHMENT_LIMITS = {
  maxBytes: 20 * 1024 * 1024,
  maxCount: 5,
  /** Extension (lowercase, with dot) to the MIME type stored and served for it. */
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

/* ------------------------------ Shared shapes ----------------------------- */

export type Paginated<T> = {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
};

export type AdminAttachment = {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
  /** Short-lived download URL, built on every response. Never store it. */
  url: string;
};

export type AdminAssignmentListItem = {
  id: string;
  title: string;
  status: AssignmentStatus;
  allowedType: SubmissionType;
  maxScore: number;
  dueDate: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  program: { id: string; title: string };
  track: { id: string; title: string };
  module: { id: string; title: string };
  /** Every Submission row (each attempt counts). */
  submissionsCount: number;
  /** Rows with status SUBMITTED or UNDER_REVIEW. */
  pendingReviewCount: number;
  attachmentsCount: number;
};

export type AdminAssignmentDetail = AdminAssignmentListItem & {
  instructions: string;
  isMandatory: boolean;
  orderIndex: number;
  attachments: AdminAttachment[];
};

/* ------------------------------- Requests -------------------------------- */

export type CreateAssignmentBody = {
  moduleId: string;
  title: string;
  instructions: string;
  allowedType?: SubmissionType;
  maxScore?: number;
  /** ISO 8601 in the future, or null. */
  dueDate?: string | null;
  isMandatory?: boolean;
  orderIndex?: number;
};

/** Every field optional; omitted means unchanged. `moduleId` is not accepted in v1. */
export type UpdateAssignmentBody = Partial<Omit<CreateAssignmentBody, 'moduleId'>>;

export type UpdateAssignmentStatusBody = { status: AssignmentStatus };

export type AdminAssignmentSortField = 'createdAt' | 'dueDate' | 'title' | 'publishedAt';

export type AdminAssignmentListQuery = {
  page?: number;
  pageSize?: number;
  q?: string;
  programId?: string;
  trackId?: string;
  moduleId?: string;
  status?: AssignmentStatus;
  /** Field with an optional `-` prefix for descending. Default `-createdAt`. */
  sort?: AdminAssignmentSortField | `-${AdminAssignmentSortField}`;
};

/** GET /v1/admin/assignments/targets: non-archived programs > tracks > modules. */
export type AssignmentTargetsResponse = {
  programs: Array<{
    id: string;
    title: string;
    status: string;
    tracks: Array<{
      id: string;
      title: string;
      modules: Array<{ id: string; title: string }>;
    }>;
  }>;
};

/* ---------------------------- Student detail ----------------------------- */

export type AssignmentAttachmentDto = {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  /** Short-lived download URL, built on every response. */
  url: string;
};

/** GET /v1/assignments/:id */
export type AssignmentDetail = AssignmentItem & {
  instructions: string;
  attachments: AssignmentAttachmentDto[];
};

/* --------------------------------- Errors -------------------------------- */

export type AssignmentErrorCode =
  | 'VALIDATION_FAILED'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'ASSIGNMENT_HAS_SUBMISSIONS'
  | 'ALLOWED_TYPE_LOCKED'
  | 'MAX_SCORE_BELOW_EXISTING_SCORES'
  | 'INVALID_STATUS_TRANSITION'
  | 'ATTACHMENT_LIMIT_REACHED'
  | 'FILE_TOO_LARGE'
  | 'UNSUPPORTED_FILE_TYPE'
  /** Upload rate limit (spec 7.1); not in the spec's error table. */
  | 'TOO_MANY_REQUESTS'
  | 'INTERNAL_ERROR';

export type AssignmentErrorBody = {
  statusCode: number;
  code: AssignmentErrorCode;
  message: string;
  /** Field name to message; present only for VALIDATION_FAILED. */
  details?: Record<string, string>;
};

export const ASSIGNMENT_ERROR_MESSAGES_AR: Record<AssignmentErrorCode, string> = {
  VALIDATION_FAILED: 'بعض الحقول غير صالحة، يرجى مراجعتها.',
  UNAUTHORIZED: 'انتهت الجلسة، يرجى تسجيل الدخول مرة أخرى.',
  FORBIDDEN: 'ليست لديك صلاحية للقيام بهذا الإجراء.',
  NOT_FOUND: 'الواجب غير موجود.',
  ASSIGNMENT_HAS_SUBMISSIONS: 'يحتوي هذا الواجب على تسليمات من الطلاب، يمكنك أرشفته بدلاً من ذلك.',
  ALLOWED_TYPE_LOCKED: 'لا يمكن تغيير نوع التسليم بعد أن سلّم الطلاب.',
  MAX_SCORE_BELOW_EXISTING_SCORES: 'لا يمكن أن تكون الدرجة القصوى أقل من درجة ممنوحة مسبقاً.',
  INVALID_STATUS_TRANSITION: 'لا يمكن تنفيذ هذا الإجراء في حالة الواجب الحالية.',
  ATTACHMENT_LIMIT_REACHED: 'تم الوصول إلى الحد الأقصى لعدد الملفات.',
  FILE_TOO_LARGE: 'حجم الملف أكبر من الحد المسموح (20 ميجابايت).',
  UNSUPPORTED_FILE_TYPE: 'نوع الملف غير مدعوم.',
  TOO_MANY_REQUESTS: 'عدد كبير من الطلبات، يرجى المحاولة بعد دقيقة.',
  INTERNAL_ERROR: 'حدث خطأ غير متوقع، يرجى المحاولة لاحقاً.',
};
