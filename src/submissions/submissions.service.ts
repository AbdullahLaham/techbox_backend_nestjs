import { Inject, Injectable, Logger } from '@nestjs/common';
import { NotificationType, Prisma, SubmissionStatus, SubmissionType } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service.js';
import { STORAGE_SERVICE, type StorageService } from '../storage/storage.service.js';
import { apiError } from '../common/api-errors.js';
import { inspectUpload, type InspectedFile } from '../common/uploads.js';
import { visibleTo } from '../assignments/assignments.service.js';
import type { Viewer } from '../programs/program-mapping.js';
import {
  SUBMISSION_LIMITS,
  SUBMISSION_RULES,
  type AdminSubmission,
  type AdminSubmissionList,
  type MySubmissionResponse,
  type SubmissionStatus as ContractSubmissionStatus,
  type SubmissionView,
  type SubmitBlockReason,
} from '../types/submissions.contract.js';
import { AdminSubmissionListQueryDto, GradeSubmissionDto, SubmitAssignmentDto } from './dto/submission.dto.js';

const FILE_URL_TTL_SEC = 3600;

/** What is stored in Submission.payload (JSON). Never returned as is: storage keys stay private. */
type StoredFile = { id: string; storageKey: string; fileName: string; mimeType: string; sizeBytes: number };
type StoredPayload = {
  type: SubmissionType;
  text: string | null;
  links: string[];
  files: StoredFile[];
  attemptNumber: number;
  isLate: boolean;
};

const SUBMISSION_SELECT = {
  id: true,
  assignmentId: true,
  studentId: true,
  payload: true,
  status: true,
  score: true,
  feedback: true,
  createdAt: true,
  updatedAt: true,
  assignment: { select: { maxScore: true, dueDate: true, allowedType: true } },
} satisfies Prisma.SubmissionSelect;

const ADMIN_SUBMISSION_SELECT = {
  ...SUBMISSION_SELECT,
  assignment: { select: { id: true, maxScore: true, dueDate: true, allowedType: true, node: { select: { title: true } } } },
  student: { select: { id: true, email: true, profile: { select: { firstName: true, lastName: true, fullNameAr: true } } } },
  grader: { select: { id: true, profile: { select: { firstName: true, lastName: true, fullNameAr: true } } } },
} satisfies Prisma.SubmissionSelect;

type SubmissionRow = Prisma.SubmissionGetPayload<{ select: typeof SUBMISSION_SELECT }>;
type AdminSubmissionRow = Prisma.SubmissionGetPayload<{ select: typeof ADMIN_SUBMISSION_SELECT }>;

type ProfileName = { firstName: string; lastName: string; fullNameAr: string | null } | null;
const displayName = (p: ProfileName) => p?.fullNameAr || [p?.firstName, p?.lastName].filter(Boolean).join(' ') || null;

/** A student may hand in again only when there is nothing yet or a revision was requested. */
function blockReason(latest: SubmissionStatus | undefined): SubmitBlockReason | null {
  switch (latest) {
    case undefined:
    case SubmissionStatus.NEEDS_REVISION:
      return null;
    case SubmissionStatus.SUBMITTED:
    case SubmissionStatus.UNDER_REVIEW:
      return 'AWAITING_REVIEW';
    case SubmissionStatus.GRADED:
      return 'GRADED';
    case SubmissionStatus.REJECTED:
      return 'REJECTED';
  }
}

/** Reads a stored payload, tolerating rows written before this module (unknown shape). */
function readPayload(row: { payload: Prisma.JsonValue; createdAt: Date }, allowedType: SubmissionType, dueDate: Date | null): StoredPayload {
  const p = (row.payload && typeof row.payload === 'object' && !Array.isArray(row.payload) ? row.payload : {}) as Partial<StoredPayload>;
  return {
    type: p.type ?? allowedType,
    text: typeof p.text === 'string' ? p.text : null,
    links: Array.isArray(p.links) ? p.links.filter((l): l is string => typeof l === 'string') : [],
    files: Array.isArray(p.files) ? p.files : [],
    attemptNumber: typeof p.attemptNumber === 'number' ? p.attemptNumber : 1,
    isLate: typeof p.isLate === 'boolean' ? p.isLate : !!dueDate && row.createdAt.getTime() > dueDate.getTime(),
  };
}

/**
 * Assignment submissions: students hand in work (files, links, text), reviewers grade it.
 * api-contract-mobile.md / api-contract-admin.md, types in submissions.contract.ts.
 */
@Injectable()
export class SubmissionsService {
  private readonly logger = new Logger('Submissions');

  constructor(
    private readonly prisma: PrismaService,
    @Inject(STORAGE_SERVICE) private readonly storage: StorageService,
  ) {}

  /* -------------------------------- Student ------------------------------- */

  /** POST /v1/assignments/:assignmentId/submit */
  async submit(
    viewer: Viewer,
    assignmentId: string,
    dto: SubmitAssignmentDto,
    uploads: Express.Multer.File[] = [],
  ): Promise<SubmissionView> {
    const assignment = await this.visibleAssignment(viewer, assignmentId);
    const text = dto.text ?? null;
    const links = dto.links ?? [];
    checkShape(assignment.allowedType, text, links, uploads.length);

    // Fail fast before storing anything; re-checked under the lock below.
    const latest = await this.latestStatus(assignmentId, viewer.id);
    if (blockReason(latest)) throw locked(blockReason(latest)!);

    const inspected: InspectedFile[] = [];
    for (const file of uploads) inspected.push(await inspectUpload(file, SUBMISSION_LIMITS.allowedFileTypes));

    const submissionId = randomUUID();
    const files: StoredFile[] = inspected.map((f, i) => {
      const id = randomUUID();
      return {
        id,
        storageKey: `submissions/${assignmentId}/${submissionId}/${id}${f.ext}`,
        fileName: f.fileName,
        mimeType: f.mimeType,
        sizeBytes: uploads[i].size,
      };
    });

    // Storage first; the files are removed again if the database write fails.
    const stored: string[] = [];
    try {
      for (const [i, f] of files.entries()) {
        await this.storage.put(f.storageKey, uploads[i].buffer, { contentType: f.mimeType });
        stored.push(f.storageKey);
      }
      const row = await this.prisma.$transaction(async (tx) => {
        // One submit at a time per student and assignment.
        await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtextextended(${`submission:${assignmentId}:${viewer.id}`}, 0))`;
        const previous = await tx.submission.findMany({
          where: { assignmentId, studentId: viewer.id },
          orderBy: { createdAt: 'desc' },
          select: { status: true },
        });
        const reason = blockReason(previous[0]?.status);
        if (reason) throw locked(reason);

        const payload: StoredPayload = {
          type: assignment.allowedType,
          text,
          links,
          files,
          attemptNumber: previous.length + 1,
          isLate: !!assignment.dueDate && Date.now() > assignment.dueDate.getTime(),
        };
        // Every attempt is a new row (assignments spec A1); earlier attempts stay untouched.
        return tx.submission.create({
          data: { id: submissionId, assignmentId, studentId: viewer.id, payload: payload as unknown as Prisma.InputJsonValue },
          select: SUBMISSION_SELECT,
        });
      });
      this.logger.log(JSON.stringify({ userId: viewer.id, action: 'submission.create', assignmentId, submissionId }));
      return this.toView(row);
    } catch (error) {
      await Promise.all(stored.map((key) => this.deleteFile(key)));
      throw error;
    }
  }

  /** GET /v1/assignments/:assignmentId/my-submission */
  async mine(viewer: Viewer, assignmentId: string): Promise<MySubmissionResponse> {
    const assignment = await this.visibleAssignment(viewer, assignmentId);
    const rows = await this.prisma.submission.findMany({
      where: { assignmentId, studentId: viewer.id },
      orderBy: { createdAt: 'desc' },
      select: SUBMISSION_SELECT,
    });
    const attempts = await Promise.all(rows.map((r) => this.toView(r)));
    const reason = blockReason(rows[0]?.status);
    return {
      assignmentId,
      allowedType: assignment.allowedType,
      maxScore: assignment.maxScore.toNumber(),
      dueDate: assignment.dueDate?.toISOString() ?? null,
      latest: attempts[0] ?? null,
      attempts,
      canSubmit: reason === null,
      submitBlockReason: reason,
    };
  }

  /* ------------------------------- Reviewer ------------------------------- */

  /** GET /v1/admin/assignments/:assignmentId/submissions */
  async list(assignmentId: string, query: AdminSubmissionListQueryDto): Promise<AdminSubmissionList> {
    const assignment = await this.prisma.assignment.findUnique({ where: { id: assignmentId }, select: { id: true } });
    if (!assignment) throw apiError('NOT_FOUND', 'Assignment not found.');

    const base: Prisma.SubmissionWhereInput = { assignmentId };
    if (query.latestOnly) {
      // Each student's newest attempt.
      const latest = await this.prisma.$queryRaw<Array<{ id: string }>>`
        SELECT DISTINCT ON ("studentId") id FROM "Submission"
        WHERE "assignmentId" = ${assignmentId}
        ORDER BY "studentId", "createdAt" DESC`;
      base.id = { in: latest.map((r) => r.id) };
    }
    if (query.q) {
      const contains = { contains: query.q, mode: 'insensitive' as const };
      base.student = {
        OR: [
          { email: contains },
          { profile: { firstName: contains } },
          { profile: { lastName: contains } },
          { profile: { fullNameAr: contains } },
          { profile: { fullNameEn: contains } },
        ],
      };
    }
    const where: Prisma.SubmissionWhereInput = { ...base, ...(query.status ? { status: query.status } : {}) };

    const [rows, total, groups] = await this.prisma.$transaction([
      this.prisma.submission.findMany({
        where,
        select: ADMIN_SUBMISSION_SELECT,
        // Oldest first: the review queue works through submissions in arrival order.
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.submission.count({ where }),
      this.prisma.submission.groupBy({ by: ['status'], where: base, _count: { _all: true }, orderBy: { status: 'asc' } }),
    ]);

    const statusCounts = Object.fromEntries(
      Object.values(SubmissionStatus).map((s) => [s, 0]),
    ) as Record<ContractSubmissionStatus, number>;
    for (const g of groups) statusCounts[g.status] = (g._count as { _all: number })._all;

    return {
      items: await Promise.all(rows.map((r) => this.toAdmin(r))),
      page: query.page,
      pageSize: query.pageSize,
      total,
      statusCounts,
    };
  }

  /** GET /v1/admin/submissions/:submissionId */
  async detail(submissionId: string): Promise<AdminSubmission> {
    const row = await this.prisma.submission.findUnique({ where: { id: submissionId }, select: ADMIN_SUBMISSION_SELECT });
    if (!row) throw apiError('NOT_FOUND', 'Submission not found.');
    return this.toAdmin(row);
  }

  /** PATCH /v1/admin/submissions/:submissionId/grade */
  async grade(viewer: Viewer, submissionId: string, dto: GradeSubmissionDto): Promise<AdminSubmission> {
    const current = await this.prisma.submission.findUnique({
      where: { id: submissionId },
      select: {
        studentId: true,
        assignmentId: true,
        assignment: { select: { maxScore: true, nodeId: true, node: { select: { title: true } } } },
      },
    });
    if (!current) throw apiError('NOT_FOUND', 'Submission not found.');

    const { maxScore } = current.assignment;
    if (dto.status === SubmissionStatus.GRADED && (dto.score === undefined || dto.score === null)) {
      throw apiError('VALIDATION_FAILED', 'A graded submission needs a score.', { score: 'الدرجة مطلوبة عند التقييم' });
    }
    if (dto.score !== undefined && dto.score !== null && maxScore.lessThan(dto.score)) {
      throw apiError('VALIDATION_FAILED', `score must not exceed maxScore (${maxScore.toNumber()}).`, {
        score: `الدرجة يجب ألا تتجاوز ${maxScore.toNumber()}`,
      });
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.submission.update({
        where: { id: submissionId },
        data: {
          status: dto.status,
          // UNDER_REVIEW leaves the score alone; the other outcomes set it (null clears).
          ...(dto.status === SubmissionStatus.UNDER_REVIEW && dto.score === undefined ? {} : { score: dto.score ?? null }),
          feedback: dto.feedback,
          gradedBy: viewer.id,
        },
      });
      if (dto.status === SubmissionStatus.GRADED) {
        // Grading completes the assignment lesson in the student's progress (spec A3).
        await tx.progressLog.upsert({
          where: { userId_nodeId: { userId: current.studentId, nodeId: current.assignment.nodeId } },
          create: { userId: current.studentId, nodeId: current.assignment.nodeId, isCompleted: true, completionPct: 100 },
          update: { isCompleted: true, completionPct: 100 },
        });
      }
      if (dto.status !== SubmissionStatus.UNDER_REVIEW) {
        await tx.notification.create({
          data: {
            userId: current.studentId,
            type: NotificationType.GRADED,
            title: NOTIFICATION_TITLES[dto.status],
            message: current.assignment.node.title,
            actionUrl: `/assignments/${current.assignmentId}`,
          },
        });
      }
    });

    this.logger.log(
      JSON.stringify({ userId: viewer.id, action: `submission.${dto.status.toLowerCase()}`, submissionId, assignmentId: current.assignmentId }),
    );
    return this.detail(submissionId);
  }

  /* -------------------------------- Helpers ------------------------------- */

  /** Published, in a visible program, and the student is ACTIVE or COMPLETED there; else 404. */
  private async visibleAssignment(viewer: Viewer, assignmentId: string) {
    const assignment = await this.prisma.assignment.findFirst({
      where: { id: assignmentId, ...visibleTo(viewer.id) },
      select: { allowedType: true, maxScore: true, dueDate: true },
    });
    if (!assignment) throw apiError('NOT_FOUND', 'Assignment not found.');
    return assignment;
  }

  private async latestStatus(assignmentId: string, studentId: string) {
    const latest = await this.prisma.submission.findFirst({
      where: { assignmentId, studentId },
      orderBy: { createdAt: 'desc' },
      select: { status: true },
    });
    return latest?.status;
  }

  private async toView(row: SubmissionRow): Promise<SubmissionView> {
    const p = readPayload(row, row.assignment.allowedType, row.assignment.dueDate);
    return {
      id: row.id,
      assignmentId: row.assignmentId,
      attemptNumber: p.attemptNumber,
      status: row.status,
      submittedAt: row.createdAt.toISOString(),
      isLate: p.isLate,
      score: row.score?.toNumber() ?? null,
      maxScore: row.assignment.maxScore.toNumber(),
      feedback: row.feedback,
      reviewedAt: row.status === SubmissionStatus.SUBMITTED ? null : row.updatedAt.toISOString(),
      content: {
        type: p.type,
        text: p.text,
        links: p.links,
        files: await Promise.all(
          p.files.map(async (f) => ({
            id: f.id,
            fileName: f.fileName,
            mimeType: f.mimeType,
            sizeBytes: f.sizeBytes,
            url: await this.storage.getDownloadUrl(f.storageKey, {
              fileName: f.fileName,
              contentType: f.mimeType,
              expiresInSec: FILE_URL_TTL_SEC,
            }),
          })),
        ),
      },
    };
  }

  private async toAdmin(row: AdminSubmissionRow): Promise<AdminSubmission> {
    return {
      ...(await this.toView(row)),
      student: { id: row.student.id, email: row.student.email, name: displayName(row.student.profile) },
      grader: row.grader ? { id: row.grader.id, name: displayName(row.grader.profile) } : null,
      assignment: {
        id: row.assignment.id,
        title: row.assignment.node.title,
        maxScore: row.assignment.maxScore.toNumber(),
        dueDate: row.assignment.dueDate?.toISOString() ?? null,
      },
    };
  }

  private async deleteFile(storageKey: string) {
    try {
      await this.storage.delete(storageKey);
    } catch (error) {
      this.logger.error(
        JSON.stringify({ event: 'storage.orphan', storageKey, error: error instanceof Error ? error.message : String(error) }),
      );
    }
  }
}

const NOTIFICATION_TITLES: Record<'GRADED' | 'NEEDS_REVISION' | 'REJECTED', string> = {
  GRADED: 'تم تقييم واجبك',
  NEEDS_REVISION: 'واجبك يحتاج إلى تعديل',
  REJECTED: 'تم رفض تسليم واجبك',
};

const LOCKED_MESSAGES: Record<SubmitBlockReason, string> = {
  AWAITING_REVIEW: 'Your previous submission is still waiting for review.',
  GRADED: 'This assignment has already been graded.',
  REJECTED: 'This submission was rejected and cannot be resubmitted.',
};

/** The reason is also in GET .../my-submission (submitBlockReason). */
const locked = (reason: SubmitBlockReason) => apiError('SUBMISSION_LOCKED', LOCKED_MESSAGES[reason]);

/** The submission must match what the assignment's allowedType accepts (SUBMISSION_RULES). */
function checkShape(type: SubmissionType, text: string | null, links: string[], fileCount: number) {
  const rule = SUBMISSION_RULES[type];
  const details: Record<string, string> = {};
  if (rule.textRequired && !text) details.text = 'نص الإجابة مطلوب';
  if (fileCount < rule.files[0] || fileCount > rule.files[1]) {
    details.files =
      rule.files[1] === 0
        ? 'هذا الواجب لا يقبل رفع ملفات'
        : `يجب رفع من ${rule.files[0]} إلى ${rule.files[1]} ملفات`;
  }
  if (links.length < rule.links[0] || links.length > rule.links[1]) {
    details.links =
      rule.links[1] === 0 ? 'هذا الواجب لا يقبل روابط' : rule.links[0] === rule.links[1] ? `يجب إرسال رابط واحد` : `يجب إرسال من ${rule.links[0]} إلى ${rule.links[1]} روابط`;
  }
  if (type === SubmissionType.MULTIMEDIA && fileCount === 0 && links.length === 0) {
    details.links = 'أرسل رابطاً أو ملفاً واحداً على الأقل';
  }
  if (Object.keys(details).length) {
    throw apiError('VALIDATION_FAILED', `This submission does not match the assignment type ${type}.`, details);
  }
}
