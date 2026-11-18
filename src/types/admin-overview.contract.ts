// src/types/admin-overview.contract.ts  (shared by the web dashboard and the NestJS backend)
//
// GET /v1/admin/overview: the staff home page of the dashboard, in one read-only request.
// Every number is counted from the database at request time. Self-contained: no imports,
// copy this file unchanged into the dashboard.

export const ADMIN_OVERVIEW_ENDPOINT = '/v1/admin/overview' as const;

/** Same as STAFF_ROLES in api.contract.ts. */
export const ADMIN_OVERVIEW_ROLES = ['SUPER_ADMIN', 'INCUBATOR_MANAGER', 'INSTRUCTOR', 'MENTOR'] as const;

/** Programs listed in `programs`, at most. */
export const ADMIN_OVERVIEW_PROGRAMS_LIMIT = 8;

/** "New learners" counts sign-ups in this many past days. */
export const ADMIN_OVERVIEW_NEW_LEARNER_DAYS = 30;

export type AdminOverviewProgramStatus = 'PUBLISHED' | 'ONGOING';

export type AdminOverviewProgram = {
  id: string;
  title: string;
  slug: string;
  status: AdminOverviewProgramStatus;
  startDate: string | null;
  /** null = unlimited seats. */
  maxSeats: number | null;
  /** Applications waiting for a decision. */
  pending: number;
  active: number;
  completed: number;
  /** 0–100, one decimal: mean progress of the ACTIVE enrollments (0 without any). */
  averageProgressPct: number;
};

export type AdminOverviewResponse = {
  generatedAt: string;
  learners: {
    /** Student accounts that are not deleted (status other than ARCHIVED). */
    total: number;
    /** Part of total created in the last ADMIN_OVERVIEW_NEW_LEARNER_DAYS days. */
    newRecently: number;
  };
  /** Enrollment applications (PENDING) waiting for the administration. */
  pendingApplications: number;
  /** Submissions handed in and not graded yet (SUBMITTED or UNDER_REVIEW). */
  submissionsAwaitingReview: number;
  enrollments: {
    active: number;
    completed: number;
    /** 0–100, one decimal: mean progress over every ACTIVE enrollment (0 without any). */
    averageProgressPct: number;
  };
  /**
   * Catalog programs (PUBLISHED or ONGOING), soonest start first, programs without a start
   * date last. At most ADMIN_OVERVIEW_PROGRAMS_LIMIT.
   */
  programs: AdminOverviewProgram[];
};
