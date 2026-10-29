import { AssignmentStatus, SubmissionType } from '@prisma/client';
import { validationFailed } from './assignment-errors.js';
import {
  ASSIGNMENT_FIELD_LIMITS,
  ASSIGNMENT_STATUSES,
  SUBMISSION_TYPES,
  type AdminAssignmentSortField,
} from '../types/assignments.admin.contract.js';

/**
 * Hand-written body and query parsing for the admin routes. The handlers take
 * `unknown`, so the global ValidationPipe skips them and every failure becomes
 * `400 VALIDATION_FAILED` with a field-by-field `details` map (spec 5.2).
 */

export type CreateAssignmentInput = {
  moduleId: string;
  title: string;
  instructions: string;
  allowedType: SubmissionType;
  maxScore: number;
  dueDate: Date | null;
  isMandatory: boolean;
  orderIndex?: number;
  /** Lesson description; not part of the assignments API, set by the curriculum editor. */
  description?: string | null;
};

export type UpdateAssignmentInput = {
  /** Lesson description; not part of the assignments API, set by the curriculum editor. */
  description?: string | null;
  title?: string;
  instructions?: string;
  allowedType?: SubmissionType;
  maxScore?: number;
  /** null clears the deadline. Checked against "now" by the service, only when it changes. */
  dueDate?: Date | null;
  isMandatory?: boolean;
  orderIndex?: number;
};

export type AdminListInput = {
  page: number;
  pageSize: number;
  q?: string;
  programId?: string;
  trackId?: string;
  moduleId?: string;
  status?: AssignmentStatus;
  sortField: AdminAssignmentSortField;
  sortDir: 'asc' | 'desc';
};

const CREATE_FIELDS = [
  'moduleId',
  'title',
  'instructions',
  'allowedType',
  'maxScore',
  'dueDate',
  'isMandatory',
  'orderIndex',
] as const;
const SORT_FIELDS: readonly AdminAssignmentSortField[] = ['createdAt', 'dueDate', 'title', 'publishedAt'];
const ISO_DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/;

type Details = Record<string, string>;

function asObject(body: unknown): Record<string, unknown> {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw validationFailed({ body: 'Body must be a JSON object.' });
  }
  return body as Record<string, unknown>;
}

function rejectUnknownFields(body: Record<string, unknown>, allowed: readonly string[], details: Details) {
  for (const key of Object.keys(body)) {
    if (!allowed.includes(key)) details[key] = 'Unknown field.';
  }
}

function parseTitle(value: unknown, details: Details): string | undefined {
  const { titleMin, titleMax } = ASSIGNMENT_FIELD_LIMITS;
  const title = typeof value === 'string' ? value.trim() : undefined;
  if (title === undefined || title.length < titleMin || title.length > titleMax) {
    details.title = `Title must be ${titleMin} to ${titleMax} characters.`;
    return undefined;
  }
  return title;
}

function parseInstructions(value: unknown, details: Details): string | undefined {
  const { instructionsMax } = ASSIGNMENT_FIELD_LIMITS;
  const instructions = typeof value === 'string' ? value.trim() : undefined;
  if (!instructions || instructions.length > instructionsMax) {
    details.instructions = `Instructions must be 1 to ${instructionsMax} characters.`;
    return undefined;
  }
  return instructions;
}

function parseAllowedType(value: unknown, details: Details): SubmissionType | undefined {
  if (typeof value !== 'string' || !SUBMISSION_TYPES.includes(value as SubmissionType)) {
    details.allowedType = `allowedType must be one of ${SUBMISSION_TYPES.join(', ')}.`;
    return undefined;
  }
  return value as SubmissionType;
}

function parseMaxScore(value: unknown, details: Details): number | undefined {
  const { maxScoreMax } = ASSIGNMENT_FIELD_LIMITS;
  const ok =
    typeof value === 'number' &&
    Number.isFinite(value) &&
    value > 0 &&
    value <= maxScoreMax &&
    // Tolerance so values such as 0.29 (0.29 * 100 = 28.999...) count as 2 decimals.
    Math.abs(Math.round(value * 100) - value * 100) < 1e-6;
  if (!ok) {
    details.maxScore = `maxScore must be greater than 0, at most ${maxScoreMax}, with at most 2 decimals.`;
    return undefined;
  }
  return value;
}

/** Shape only; whether the date is in the future is checked by the caller. */
function parseDueDate(value: unknown, details: Details): Date | null | undefined {
  if (value === null) return null;
  const date = typeof value === 'string' && ISO_DATE.test(value) ? new Date(value) : undefined;
  if (!date || Number.isNaN(date.getTime())) {
    details.dueDate = 'dueDate must be an ISO 8601 date-time or null.';
    return undefined;
  }
  return date;
}

function parseBoolean(field: string, value: unknown, details: Details): boolean | undefined {
  if (typeof value !== 'boolean') {
    details[field] = `${field} must be true or false.`;
    return undefined;
  }
  return value;
}

function parseOrderIndex(value: unknown, details: Details): number | undefined {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > 2_147_483_647) {
    details.orderIndex = 'orderIndex must be an integer, 0 or more.';
    return undefined;
  }
  return value;
}

function requireFuture(date: Date | null | undefined, details: Details, now: Date) {
  if (date && date.getTime() <= now.getTime()) {
    details.dueDate = 'dueDate must be in the future.';
  }
}

export function parseCreateBody(raw: unknown, now = new Date()): CreateAssignmentInput {
  const body = asObject(raw);
  const details: Details = {};
  rejectUnknownFields(body, CREATE_FIELDS, details);

  if (typeof body.moduleId !== 'string' || !body.moduleId.trim()) {
    details.moduleId = 'moduleId is required.';
  }
  const title = parseTitle(body.title, details);
  const instructions = parseInstructions(body.instructions, details);
  const allowedType =
    body.allowedType === undefined ? SubmissionType.URL_LINK : parseAllowedType(body.allowedType, details);
  const maxScore = body.maxScore === undefined ? 100 : parseMaxScore(body.maxScore, details);
  const dueDate = body.dueDate === undefined ? null : parseDueDate(body.dueDate, details);
  requireFuture(dueDate, details, now);
  const isMandatory =
    body.isMandatory === undefined ? true : parseBoolean('isMandatory', body.isMandatory, details);
  const orderIndex =
    body.orderIndex === undefined ? undefined : parseOrderIndex(body.orderIndex, details);

  if (Object.keys(details).length > 0) throw validationFailed(details);
  return {
    moduleId: (body.moduleId as string).trim(),
    title: title!,
    instructions: instructions!,
    allowedType: allowedType!,
    maxScore: maxScore!,
    dueDate: dueDate ?? null,
    isMandatory: isMandatory!,
    orderIndex,
  };
}

export function parseUpdateBody(raw: unknown): UpdateAssignmentInput {
  const body = asObject(raw);
  const details: Details = {};
  if ('moduleId' in body) {
    details.moduleId = 'An assignment cannot be moved to another module.';
  }
  rejectUnknownFields(
    body,
    CREATE_FIELDS.filter((f) => f !== 'moduleId'),
    details,
  );

  const input: UpdateAssignmentInput = {};
  if (body.title !== undefined) input.title = parseTitle(body.title, details);
  if (body.instructions !== undefined) input.instructions = parseInstructions(body.instructions, details);
  if (body.allowedType !== undefined) input.allowedType = parseAllowedType(body.allowedType, details);
  if (body.maxScore !== undefined) input.maxScore = parseMaxScore(body.maxScore, details);
  if (body.dueDate !== undefined) input.dueDate = parseDueDate(body.dueDate, details);
  if (body.isMandatory !== undefined) input.isMandatory = parseBoolean('isMandatory', body.isMandatory, details);
  if (body.orderIndex !== undefined) input.orderIndex = parseOrderIndex(body.orderIndex, details);

  if (Object.keys(details).length > 0) throw validationFailed(details);
  return input;
}

/** dueDate must be in the future only when it actually changes (spec 6.4, test A-8). */
export function checkDueDateChange(next: Date | null | undefined, current: Date | null, now = new Date()) {
  if (!next || next.getTime() === current?.getTime()) return;
  const details: Details = {};
  requireFuture(next, details, now);
  if (details.dueDate) throw validationFailed(details);
}

export function parseStatusBody(raw: unknown): AssignmentStatus {
  const body = asObject(raw);
  const details: Details = {};
  rejectUnknownFields(body, ['status'], details);
  if (typeof body.status !== 'string' || !ASSIGNMENT_STATUSES.includes(body.status as AssignmentStatus)) {
    details.status = `status must be one of ${ASSIGNMENT_STATUSES.join(', ')}.`;
  }
  if (Object.keys(details).length > 0) throw validationFailed(details);
  return body.status as AssignmentStatus;
}

function parsePositiveInt(field: string, value: unknown, fallback: number, max: number, details: Details) {
  if (value === undefined || value === '') return fallback;
  const n = typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : NaN;
  if (!Number.isSafeInteger(n) || n < 1 || n > max) {
    details[field] = `${field} must be an integer from 1 to ${max}.`;
    return fallback;
  }
  return n;
}

function optionalString(field: string, value: unknown, details: Details): string | undefined {
  if (value === undefined || value === '') return undefined;
  if (typeof value !== 'string') {
    details[field] = `${field} must be a single value.`;
    return undefined;
  }
  return value.trim() || undefined;
}

export function parseListQuery(query: Record<string, unknown>): AdminListInput {
  const details: Details = {};
  rejectUnknownFields(
    query,
    ['page', 'pageSize', 'q', 'programId', 'trackId', 'moduleId', 'status', 'sort'],
    details,
  );

  const page = parsePositiveInt('page', query.page, 1, Number.MAX_SAFE_INTEGER, details);
  const pageSize = parsePositiveInt('pageSize', query.pageSize, 20, ASSIGNMENT_FIELD_LIMITS.pageSizeMax, details);

  const status = optionalString('status', query.status, details);
  if (status !== undefined && !ASSIGNMENT_STATUSES.includes(status as AssignmentStatus)) {
    details.status = `status must be one of ${ASSIGNMENT_STATUSES.join(', ')}.`;
  }

  const sort = optionalString('sort', query.sort, details) ?? '-createdAt';
  const sortDir = sort.startsWith('-') ? 'desc' : 'asc';
  const sortField = sort.replace(/^-/, '') as AdminAssignmentSortField;
  if (!SORT_FIELDS.includes(sortField)) {
    details.sort = `sort must be one of ${SORT_FIELDS.join(', ')}, optionally prefixed with "-".`;
  }

  const input: AdminListInput = {
    page,
    pageSize,
    q: optionalString('q', query.q, details),
    programId: optionalString('programId', query.programId, details),
    trackId: optionalString('trackId', query.trackId, details),
    moduleId: optionalString('moduleId', query.moduleId, details),
    status: status as AssignmentStatus | undefined,
    sortField,
    sortDir,
  };
  if (Object.keys(details).length > 0) throw validationFailed(details);
  return input;
}
