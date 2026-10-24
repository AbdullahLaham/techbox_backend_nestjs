// src/types/assignments.contract.ts  (shared by the Expo app and the NestJS backend)
/**
 * Assignments page contract
 * -------------------------
 * Built from the Prisma schema:
 *   Assignment -> ActivityNode (type ASSIGNMENT) -> Module -> Track -> Program
 *   Submission (student's attempts; no unique constraint, so a student can have several)
 *
 * Rules:
 *  - ONE endpoint returns every published assignment of the current student's programs.
 *  - The server decides facts (isNew, isOverdue, latest submission). The client decides presentation.
 *  - "Not submitted" is not a database state: it means the student has no Submission row.
 */

export const ASSIGNMENTS_ENDPOINT = '/v1/assignments' as const;

/** An unsubmitted assignment published within this many days is "new". */
export const NEW_WINDOW_DAYS = 3;

/* ------------------------------ Schema enums ----------------------------- */

export type SubmissionStatus =
  | 'SUBMITTED'
  | 'UNDER_REVIEW'
  | 'GRADED'
  | 'REJECTED'
  | 'NEEDS_REVISION';

export type SubmissionType = 'FILE_UPLOAD' | 'URL_LINK' | 'TEXT_CONTENT' | 'MULTIMEDIA';

/* -------------------------------- Response ------------------------------- */

export type AssignmentProgramRef = {
  id: string;
  title: string;
  slug: string;
};

/** The student's LATEST submission for the assignment. */
export type AssignmentSubmission = {
  id: string;
  status: SubmissionStatus;
  /** Submission.createdAt of the latest attempt */
  submittedAt: string;
  /** Submission.score as a number; null until graded */
  score: number | null;
  feedback: string | null;
  /** How many times the student has submitted */
  attemptsCount: number;
};

export type AssignmentItem = {
  /** Assignment.id */
  id: string;
  /** ActivityNode.title */
  title: string;
  allowedType: SubmissionType;
  /** Assignment.maxScore as a number */
  maxScore: number;
  /** ISO date, or null when there is no deadline */
  dueDate: string | null;
  /** Assignment.createdAt (ISO) */
  createdAt: string;
  /** Assignment.publishedAt (ISO). Always set for PUBLISHED assignments. */
  publishedAt: string;
  /** No submission yet AND published within NEW_WINDOW_DAYS */
  isNew: boolean;
  /** dueDate has passed AND the student still has to submit (not submitted, or needs revision) */
  isOverdue: boolean;
  program: AssignmentProgramRef;
  /** null = the student has not submitted */
  submission: AssignmentSubmission | null;
};

export type AssignmentsResponse = {
  items: AssignmentItem[];
};

/* ---------------------- Shared derivation (client + server) --------------- */

/** What the card shows. Merges SUBMITTED + UNDER_REVIEW, adds NOT_SUBMITTED. */
export type AssignmentState =
  | 'NOT_SUBMITTED'
  | 'AWAITING_REVIEW'
  | 'NEEDS_REVISION'
  | 'GRADED'
  | 'REJECTED';

/** Which tab the assignment lives in. */
export type AssignmentBucket = 'TODO' | 'SUBMITTED' | 'DONE';

export function getAssignmentState(item: Pick<AssignmentItem, 'submission'>): AssignmentState {
  const status = item.submission?.status;
  switch (status) {
    case undefined:
      return 'NOT_SUBMITTED';
    case 'SUBMITTED':
    case 'UNDER_REVIEW':
      return 'AWAITING_REVIEW';
    case 'NEEDS_REVISION':
      return 'NEEDS_REVISION';
    case 'GRADED':
      return 'GRADED';
    case 'REJECTED':
      return 'REJECTED';
  }
}

/**
 * TODO       = the student must act (never submitted, or asked to revise)
 * SUBMITTED  = waiting for a grader
 * DONE       = closed (graded, or rejected)
 */
export function getAssignmentBucket(state: AssignmentState): AssignmentBucket {
  switch (state) {
    case 'NOT_SUBMITTED':
    case 'NEEDS_REVISION':
      return 'TODO';
    case 'AWAITING_REVIEW':
      return 'SUBMITTED';
    case 'GRADED':
    case 'REJECTED':
      return 'DONE';
  }
}

/* ----------------------------- Example response -------------------------- */

export const ASSIGNMENTS_RESPONSE_EXAMPLE: AssignmentsResponse = {
  items: [
    {
      id: 'a_1',
      title: 'بناء واجهة تسجيل الدخول',
      allowedType: 'URL_LINK',
      maxScore: 100,
      dueDate: '2026-11-05T20:59:00.000Z',
      createdAt: '2026-10-20T08:00:00.000Z',
      publishedAt: '2026-10-21T09:00:00.000Z',
      isNew: true,
      isOverdue: false,
      program: { id: 'p_rn', title: 'تطوير التطبيقات بـ React Native', slug: 'react-native' },
      submission: null,
    },
    {
      id: 'a_2',
      title: 'تصميم مخطط قاعدة البيانات',
      allowedType: 'FILE_UPLOAD',
      maxScore: 100,
      dueDate: '2026-10-18T20:59:00.000Z',
      createdAt: '2026-10-10T08:00:00.000Z',
      publishedAt: '2026-10-10T08:00:00.000Z',
      isNew: false,
      isOverdue: false,
      program: { id: 'p_rn', title: 'تطوير التطبيقات بـ React Native', slug: 'react-native' },
      submission: {
        id: 's_9',
        status: 'GRADED',
        submittedAt: '2026-10-17T12:30:00.000Z',
        score: 88.5,
        feedback: 'عمل ممتاز، انتبه لتسمية العلاقات.',
        attemptsCount: 1,
      },
    },
  ],
};
