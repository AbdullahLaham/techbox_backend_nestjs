import { Inject, Injectable } from '@nestjs/common';
import { AssignmentStatus, EnrollmentStatus, Prisma, ProgramStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { STORAGE_SERVICE, type StorageService } from '../storage/storage.service.js';
import { AssignmentException } from './assignment-errors.js';
import { DOWNLOAD_URL_TTL_SEC } from './admin-assignments.service.js';
import {
  NEW_WINDOW_DAYS,
  getAssignmentState,
  type AssignmentItem,
  type AssignmentSubmission,
  type AssignmentsResponse,
} from '../types/assignments.contract.js';
import type { AssignmentDetail } from '../types/assignments.admin.contract.js';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Section 4.2: published assignment, visible program, ACTIVE or COMPLETED enrollment. */
function visibleTo(userId: string): Prisma.AssignmentWhereInput {
  return {
    status: AssignmentStatus.PUBLISHED,
    node: {
      module: {
        track: {
          program: {
            status: { in: [ProgramStatus.PUBLISHED, ProgramStatus.ONGOING, ProgramStatus.COMPLETED] },
            enrollments: {
              some: { userId, status: { in: [EnrollmentStatus.ACTIVE, EnrollmentStatus.COMPLETED] } },
            },
          },
        },
      },
    },
  };
}

function itemSelect(userId: string) {
  return {
    id: true,
    allowedType: true,
    maxScore: true,
    dueDate: true,
    createdAt: true,
    publishedAt: true,
    node: {
      select: {
        title: true,
        module: {
          select: {
            track: { select: { program: { select: { id: true, title: true, slug: true } } } },
          },
        },
      },
    },
    // All of this student's attempts, newest first. Never select `payload`.
    submissions: {
      where: { studentId: userId },
      orderBy: { createdAt: 'desc' },
      select: { id: true, status: true, score: true, feedback: true, createdAt: true },
    },
  } satisfies Prisma.AssignmentSelect;
}

function detailSelect(userId: string) {
  return {
    ...itemSelect(userId),
    instructions: true,
    attachments: {
      orderBy: { createdAt: 'asc' },
      select: { id: true, storageKey: true, fileName: true, mimeType: true, sizeBytes: true },
    },
  } satisfies Prisma.AssignmentSelect;
}

type ItemRow = Prisma.AssignmentGetPayload<{ select: ReturnType<typeof itemSelect> }>;

@Injectable()
export class AssignmentsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(STORAGE_SERVICE) private readonly storage: StorageService,
  ) {}

  /** S1: GET /v1/assignments */
  async getStudentAssignments(userId: string): Promise<AssignmentsResponse> {
    const rows = await this.prisma.assignment.findMany({
      where: visibleTo(userId),
      select: itemSelect(userId),
    });
    const now = new Date();
    return { items: rows.map((row) => toItem(row, now)) };
  }

  /** S2: GET /v1/assignments/:id. 404 (not 403) when not visible, so existence is not revealed. */
  async getStudentAssignment(userId: string, id: string): Promise<AssignmentDetail> {
    const row = await this.prisma.assignment.findFirst({
      where: { id, ...visibleTo(userId) },
      select: detailSelect(userId),
    });
    if (!row) throw new AssignmentException('NOT_FOUND');

    return {
      ...toItem(row, new Date()),
      instructions: row.instructions,
      attachments: await Promise.all(
        row.attachments.map(async (a) => ({
          id: a.id,
          fileName: a.fileName,
          mimeType: a.mimeType,
          sizeBytes: a.sizeBytes,
          url: await this.storage.getDownloadUrl(a.storageKey, {
            fileName: a.fileName,
            contentType: a.mimeType,
            expiresInSec: DOWNLOAD_URL_TTL_SEC,
          }),
        })),
      ),
    };
  }
}

/** Field mapping of section 8.1 and the flags of section 4.3. */
export function toItem(row: ItemRow, now: Date): AssignmentItem {
  const latest = row.submissions[0];
  const submission: AssignmentSubmission | null = latest
    ? {
        id: latest.id,
        status: latest.status,
        submittedAt: latest.createdAt.toISOString(),
        score: latest.score?.toNumber() ?? null,
        feedback: latest.feedback ?? null,
        attemptsCount: row.submissions.length,
      }
    : null;

  // Always set for PUBLISHED rows; createdAt only guards against a missing backfill.
  const publishedAt = row.publishedAt ?? row.createdAt;
  const state = getAssignmentState({ submission });
  const program = row.node.module.track.program;

  return {
    id: row.id,
    title: row.node.title,
    allowedType: row.allowedType,
    maxScore: row.maxScore.toNumber(),
    dueDate: row.dueDate?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    publishedAt: publishedAt.toISOString(),
    isNew: submission === null && publishedAt.getTime() >= now.getTime() - NEW_WINDOW_DAYS * DAY_MS,
    isOverdue:
      row.dueDate !== null &&
      row.dueDate.getTime() < now.getTime() &&
      (state === 'NOT_SUBMITTED' || state === 'NEEDS_REVISION'),
    program: { id: program.id, title: program.title, slug: program.slug },
    submission,
  };
}
