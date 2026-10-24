import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  AssignmentStatus,
  NodeType,
  Prisma,
  ProgramStatus,
  SubmissionStatus,
} from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service.js';
import { STORAGE_SERVICE, type StorageService } from '../storage/storage.service.js';
import { AssignmentException, validationFailed } from './assignment-errors.js';
import {
  checkDueDateChange,
  type AdminListInput,
  type CreateAssignmentInput,
  type UpdateAssignmentInput,
} from './assignment-validation.js';
import { inspectUpload } from './attachment-file.js';
import {
  ASSIGNMENT_STATUS_TRANSITIONS,
  ATTACHMENT_LIMITS,
  type AdminAssignmentDetail,
  type AdminAssignmentListItem,
  type AdminAttachment,
  type AssignmentTargetsResponse,
  type Paginated,
} from '../types/assignments.admin.contract.js';

export const DOWNLOAD_URL_TTL_SEC = 3600;

const PENDING_REVIEW: SubmissionStatus[] = [SubmissionStatus.SUBMITTED, SubmissionStatus.UNDER_REVIEW];

const ADMIN_LIST_SELECT = {
  id: true,
  status: true,
  allowedType: true,
  maxScore: true,
  dueDate: true,
  publishedAt: true,
  createdAt: true,
  updatedAt: true,
  node: {
    select: {
      title: true,
      isMandatory: true,
      orderIndex: true,
      module: {
        select: {
          id: true,
          title: true,
          track: { select: { id: true, title: true, program: { select: { id: true, title: true } } } },
        },
      },
    },
  },
  _count: { select: { attachments: true } },
} satisfies Prisma.AssignmentSelect;

const ATTACHMENT_SELECT = {
  id: true,
  storageKey: true,
  fileName: true,
  mimeType: true,
  sizeBytes: true,
  createdAt: true,
} satisfies Prisma.AssignmentAttachmentSelect;

const ADMIN_DETAIL_SELECT = {
  ...ADMIN_LIST_SELECT,
  instructions: true,
  attachments: { orderBy: { createdAt: 'asc' }, select: ATTACHMENT_SELECT },
} satisfies Prisma.AssignmentSelect;

type ListRow = Prisma.AssignmentGetPayload<{ select: typeof ADMIN_LIST_SELECT }>;
type DetailRow = Prisma.AssignmentGetPayload<{ select: typeof ADMIN_DETAIL_SELECT }>;
type AttachmentRow = Prisma.AssignmentAttachmentGetPayload<{ select: typeof ATTACHMENT_SELECT }>;
type SubmissionCounts = { submissionsCount: number; pendingReviewCount: number };

@Injectable()
export class AdminAssignmentsService {
  private readonly logger = new Logger('AssignmentsAdmin');

  constructor(
    private readonly prisma: PrismaService,
    @Inject(STORAGE_SERVICE) private readonly storage: StorageService,
  ) {}

  /* --------------------------------- A1 ---------------------------------- */

  async create(userId: string, input: CreateAssignmentInput): Promise<AdminAssignmentDetail> {
    const module = await this.prisma.module.findUnique({
      where: { id: input.moduleId },
      select: { id: true, track: { select: { program: { select: { status: true } } } } },
    });
    if (!module) {
      throw new AssignmentException('NOT_FOUND', 'Module not found.');
    }
    if (module.track.program.status === ProgramStatus.ARCHIVED) {
      throw validationFailed({ moduleId: 'The module belongs to an archived program.' });
    }

    const orderIndex = input.orderIndex ?? (await this.nextOrderIndex(input.moduleId));

    // One nested write: the node and the assignment are created together or not at all.
    const created = await this.prisma.assignment.create({
      data: {
        instructions: input.instructions,
        allowedType: input.allowedType,
        maxScore: input.maxScore,
        dueDate: input.dueDate,
        node: {
          create: {
            moduleId: input.moduleId,
            title: input.title,
            type: NodeType.ASSIGNMENT,
            isMandatory: input.isMandatory,
            orderIndex,
          },
        },
      },
      select: ADMIN_DETAIL_SELECT,
    });

    this.audit(userId, 'assignment.create', created.id);
    return this.toDetail(created, { submissionsCount: 0, pendingReviewCount: 0 });
  }

  /* --------------------------------- A2 ---------------------------------- */

  async list(input: AdminListInput): Promise<Paginated<AdminAssignmentListItem>> {
    const where: Prisma.AssignmentWhereInput = {
      ...(input.status ? { status: input.status } : {}),
      node: {
        ...(input.q ? { title: { contains: input.q, mode: 'insensitive' } } : {}),
        ...(input.moduleId ? { moduleId: input.moduleId } : {}),
        module: {
          ...(input.trackId ? { trackId: input.trackId } : {}),
          ...(input.programId ? { track: { programId: input.programId } } : {}),
        },
      },
    };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.assignment.findMany({
        where,
        select: ADMIN_LIST_SELECT,
        orderBy: [this.orderBy(input), { id: 'asc' }],
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize,
      }),
      this.prisma.assignment.count({ where }),
    ]);

    const counts = await this.submissionCounts(rows.map((r) => r.id));
    return {
      items: rows.map((row) => this.toListItem(row, counts.get(row.id))),
      page: input.page,
      pageSize: input.pageSize,
      total,
    };
  }

  /* --------------------------------- A3 ---------------------------------- */

  async findOne(id: string): Promise<AdminAssignmentDetail> {
    const row = await this.prisma.assignment.findUnique({ where: { id }, select: ADMIN_DETAIL_SELECT });
    if (!row) throw new AssignmentException('NOT_FOUND');
    const counts = await this.submissionCounts([id]);
    return this.toDetail(row, counts.get(id));
  }

  /* --------------------------------- A4 ---------------------------------- */

  async update(userId: string, id: string, input: UpdateAssignmentInput): Promise<AdminAssignmentDetail> {
    const current = await this.prisma.assignment.findUnique({
      where: { id },
      select: {
        status: true,
        allowedType: true,
        dueDate: true,
        _count: { select: { submissions: true } },
      },
    });
    if (!current) throw new AssignmentException('NOT_FOUND');
    if (current.status === AssignmentStatus.ARCHIVED) {
      throw new AssignmentException('INVALID_STATUS_TRANSITION', 'Restore the assignment before editing it.');
    }

    checkDueDateChange(input.dueDate, current.dueDate);

    const hasSubmissions = current._count.submissions > 0;
    if (hasSubmissions && input.allowedType !== undefined && input.allowedType !== current.allowedType) {
      throw new AssignmentException('ALLOWED_TYPE_LOCKED');
    }
    if (hasSubmissions && input.maxScore !== undefined) {
      const { _max } = await this.prisma.submission.aggregate({
        where: { assignmentId: id },
        _max: { score: true },
      });
      if (_max.score && _max.score.greaterThan(input.maxScore)) {
        throw new AssignmentException('MAX_SCORE_BELOW_EXISTING_SCORES');
      }
    }

    const nodeData: Prisma.ActivityNodeUpdateWithoutAssignmentInput = {
      title: input.title,
      isMandatory: input.isMandatory,
      orderIndex: input.orderIndex,
    };
    const hasNodeChange = Object.values(nodeData).some((v) => v !== undefined);

    // One nested write; undefined fields are left unchanged.
    await this.prisma.assignment.update({
      where: { id },
      data: {
        instructions: input.instructions,
        allowedType: input.allowedType,
        maxScore: input.maxScore,
        dueDate: input.dueDate,
        ...(hasNodeChange ? { node: { update: nodeData } } : {}),
      },
    });

    this.audit(userId, 'assignment.update', id);
    return this.findOne(id);
  }

  /* --------------------------------- A5 ---------------------------------- */

  async changeStatus(userId: string, id: string, next: AssignmentStatus): Promise<AdminAssignmentDetail> {
    const current = await this.prisma.assignment.findUnique({
      where: { id },
      select: { status: true, publishedAt: true },
    });
    if (!current) throw new AssignmentException('NOT_FOUND');
    if (!ASSIGNMENT_STATUS_TRANSITIONS[current.status].includes(next)) {
      throw new AssignmentException(
        'INVALID_STATUS_TRANSITION',
        `Cannot change status from ${current.status} to ${next}.`,
      );
    }

    const unpublishing = current.status === AssignmentStatus.PUBLISHED && next === AssignmentStatus.DRAFT;
    const data: Prisma.AssignmentUpdateManyMutationInput = { status: next };
    if (next === AssignmentStatus.PUBLISHED && !current.publishedAt) {
      data.publishedAt = new Date(); // first publish; a restore from ARCHIVED keeps the old date
    }
    if (unpublishing) {
      data.publishedAt = null; // a later publish counts as new again
    }

    // Conditional write: fails if the status changed meanwhile, or (for unpublish)
    // if a submission exists, without a gap between the check and the write.
    const { count } = await this.prisma.assignment.updateMany({
      where: {
        id,
        status: current.status,
        ...(unpublishing ? { submissions: { none: {} } } : {}),
      },
      data,
    });
    if (count === 0) {
      if (unpublishing && (await this.prisma.submission.count({ where: { assignmentId: id } })) > 0) {
        throw new AssignmentException('ASSIGNMENT_HAS_SUBMISSIONS');
      }
      throw new AssignmentException('INVALID_STATUS_TRANSITION', 'The status changed meanwhile; reload and retry.');
    }

    this.audit(userId, `assignment.status.${next.toLowerCase()}`, id);
    return this.findOne(id);
  }

  /* --------------------------------- A6 ---------------------------------- */

  async remove(userId: string, id: string): Promise<void> {
    const assignment = await this.prisma.assignment.findUnique({
      where: { id },
      select: { nodeId: true, attachments: { select: { storageKey: true } } },
    });
    if (!assignment) throw new AssignmentException('NOT_FOUND');

    // Delete the node (cascades to Assignment, attachments and ProgressLog), but only
    // while there are no submissions, in a single statement.
    const { count } = await this.prisma.activityNode.deleteMany({
      where: { id: assignment.nodeId, assignment: { submissions: { none: {} } } },
    });
    if (count === 0) {
      const stillExists = await this.prisma.assignment.count({ where: { id } });
      throw stillExists
        ? new AssignmentException('ASSIGNMENT_HAS_SUBMISSIONS')
        : new AssignmentException('NOT_FOUND');
    }

    this.audit(userId, 'assignment.delete', id);
    await Promise.all(assignment.attachments.map((a) => this.deleteStoredFile(a.storageKey, id)));
  }

  /* --------------------------------- A7 ---------------------------------- */

  async addAttachment(userId: string, id: string, file: Express.Multer.File | undefined): Promise<AdminAttachment> {
    const assignment = await this.prisma.assignment.findUnique({
      where: { id },
      select: { status: true, _count: { select: { attachments: true } } },
    });
    if (!assignment) throw new AssignmentException('NOT_FOUND');
    if (assignment.status === AssignmentStatus.ARCHIVED) {
      throw new AssignmentException('INVALID_STATUS_TRANSITION', 'Restore the assignment before changing its files.');
    }
    if (assignment._count.attachments >= ATTACHMENT_LIMITS.maxCount) {
      throw new AssignmentException('ATTACHMENT_LIMIT_REACHED');
    }
    if (!file) {
      throw validationFailed({ file: 'Send one file in the "file" field.' });
    }

    const { ext, mimeType, fileName } = await inspectUpload(file);
    const attachmentId = randomUUID();
    const storageKey = `assignments/${id}/${attachmentId}${ext}`;

    // Storage first, then the row; if the row fails, remove the file (spec 7.3).
    await this.storage.put(storageKey, file.buffer, { contentType: mimeType });
    let row: AttachmentRow;
    try {
      row = await this.prisma.assignmentAttachment.create({
        data: { id: attachmentId, assignmentId: id, storageKey, fileName, mimeType, sizeBytes: file.size },
        select: ATTACHMENT_SELECT,
      });
    } catch (error) {
      await this.deleteStoredFile(storageKey, id);
      throw error;
    }

    this.audit(userId, 'assignment.attachment.add', id, { attachmentId });
    return this.toAttachment(row);
  }

  /* --------------------------------- A8 ---------------------------------- */

  async removeAttachment(userId: string, id: string, attachmentId: string): Promise<void> {
    const attachment = await this.prisma.assignmentAttachment.findFirst({
      where: { id: attachmentId, assignmentId: id },
      select: { storageKey: true, assignment: { select: { status: true } } },
    });
    if (!attachment) throw new AssignmentException('NOT_FOUND');
    if (attachment.assignment.status === AssignmentStatus.ARCHIVED) {
      throw new AssignmentException('INVALID_STATUS_TRANSITION', 'Restore the assignment before changing its files.');
    }

    // Row first, then the file (spec 7.3).
    await this.prisma.assignmentAttachment.delete({ where: { id: attachmentId } });
    this.audit(userId, 'assignment.attachment.delete', id, { attachmentId });
    await this.deleteStoredFile(attachment.storageKey, id);
  }

  /* --------------------------------- A9 ---------------------------------- */

  async targets(): Promise<AssignmentTargetsResponse> {
    const byOrder = [{ orderIndex: 'asc' as const }, { title: 'asc' as const }];
    const programs = await this.prisma.program.findMany({
      where: { status: { not: ProgramStatus.ARCHIVED } },
      orderBy: { title: 'asc' },
      select: {
        id: true,
        title: true,
        status: true,
        tracks: {
          orderBy: byOrder,
          select: {
            id: true,
            title: true,
            modules: { orderBy: byOrder, select: { id: true, title: true } },
          },
        },
      },
    });
    return { programs };
  }

  /* ------------------------------- Helpers -------------------------------- */

  private async nextOrderIndex(moduleId: string): Promise<number> {
    const { _max } = await this.prisma.activityNode.aggregate({
      where: { moduleId },
      _max: { orderIndex: true },
    });
    return _max.orderIndex === null ? 0 : _max.orderIndex + 1;
  }

  private orderBy(input: AdminListInput): Prisma.AssignmentOrderByWithRelationInput {
    switch (input.sortField) {
      case 'title':
        return { node: { title: input.sortDir } };
      case 'dueDate':
        return { dueDate: { sort: input.sortDir, nulls: 'last' } };
      case 'publishedAt':
        return { publishedAt: { sort: input.sortDir, nulls: 'last' } };
      case 'createdAt':
        return { createdAt: input.sortDir };
    }
  }

  /** Both counts for a page of assignments in one grouped query (no N+1). */
  private async submissionCounts(ids: string[]): Promise<Map<string, SubmissionCounts>> {
    const counts = new Map<string, SubmissionCounts>();
    if (ids.length === 0) return counts;

    const groups = await this.prisma.submission.groupBy({
      by: ['assignmentId', 'status'],
      where: { assignmentId: { in: ids } },
      _count: { _all: true },
    });
    for (const g of groups) {
      const c = counts.get(g.assignmentId) ?? { submissionsCount: 0, pendingReviewCount: 0 };
      c.submissionsCount += g._count._all;
      if (PENDING_REVIEW.includes(g.status)) c.pendingReviewCount += g._count._all;
      counts.set(g.assignmentId, c);
    }
    return counts;
  }

  private toListItem(row: ListRow, counts?: SubmissionCounts): AdminAssignmentListItem {
    const { module } = row.node;
    return {
      id: row.id,
      title: row.node.title,
      status: row.status,
      allowedType: row.allowedType,
      maxScore: row.maxScore.toNumber(),
      dueDate: row.dueDate?.toISOString() ?? null,
      publishedAt: row.publishedAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      program: { id: module.track.program.id, title: module.track.program.title },
      track: { id: module.track.id, title: module.track.title },
      module: { id: module.id, title: module.title },
      submissionsCount: counts?.submissionsCount ?? 0,
      pendingReviewCount: counts?.pendingReviewCount ?? 0,
      attachmentsCount: row._count.attachments,
    };
  }

  private async toDetail(row: DetailRow, counts?: SubmissionCounts): Promise<AdminAssignmentDetail> {
    return {
      ...this.toListItem(row, counts),
      instructions: row.instructions,
      isMandatory: row.node.isMandatory,
      orderIndex: row.node.orderIndex,
      attachments: await Promise.all(row.attachments.map((a) => this.toAttachment(a))),
    };
  }

  private async toAttachment(row: AttachmentRow): Promise<AdminAttachment> {
    return {
      id: row.id,
      fileName: row.fileName,
      mimeType: row.mimeType,
      sizeBytes: row.sizeBytes,
      createdAt: row.createdAt.toISOString(),
      url: await this.storage.getDownloadUrl(row.storageKey, {
        fileName: row.fileName,
        contentType: row.mimeType,
        expiresInSec: DOWNLOAD_URL_TTL_SEC,
      }),
    };
  }

  /** Best effort: a failure leaves an orphan file, which is logged with its key. */
  private async deleteStoredFile(storageKey: string, assignmentId: string) {
    try {
      await this.storage.delete(storageKey);
    } catch (error) {
      this.logger.error(
        JSON.stringify({
          event: 'assignment.attachment.orphan',
          assignmentId,
          storageKey,
          error: error instanceof Error ? error.message : String(error),
        }),
      );
    }
  }

  private audit(userId: string, action: string, assignmentId: string, extra: Record<string, string> = {}) {
    this.logger.log(JSON.stringify({ userId, action, assignmentId, ...extra }));
  }
}
