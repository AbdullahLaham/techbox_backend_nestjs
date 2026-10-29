import { Injectable } from '@nestjs/common';
import { AssignmentStatus, NodeType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { ProgressService } from '../progress/progress.service.js';
import { apiError } from '../common/api-errors.js';
import {
  canAccessContent,
  type ProgramDetail,
  type ProgramNode,
  type ProgramSummary,
} from '../types/api.contract.js';
import {
  CATALOG_STATUSES,
  MY_ENROLLMENT_SELECT,
  PROGRAM_SELECT,
  PUBLIC_DETAIL_STATUSES,
  enrollmentCountsByProgram,
  isStaff,
  toMyEnrollmentRef,
  toProgramSummary,
  type Viewer,
} from './program-mapping.js';

const byOrder = [{ orderIndex: 'asc' as const }, { createdAt: 'asc' as const }];

const PUBLIC_CURRICULUM_SELECT = {
  tracks: {
    orderBy: byOrder,
    select: {
      id: true,
      programId: true,
      title: true,
      description: true,
      orderIndex: true,
      modules: {
        orderBy: byOrder,
        select: {
          id: true,
          trackId: true,
          title: true,
          description: true,
          orderIndex: true,
          nodes: {
            orderBy: byOrder,
            select: {
              id: true,
              moduleId: true,
              title: true,
              description: true,
              type: true,
              orderIndex: true,
              isMandatory: true,
              video: { select: { durationSec: true, playbackUrl: true } },
              quiz: { select: { isPublished: true } },
              assignment: {
                select: {
                  id: true,
                  status: true,
                  allowedType: true,
                  maxScore: true,
                  dueDate: true,
                  instructions: true,
                },
              },
            },
          },
        },
      },
    },
  },
} satisfies Prisma.ProgramSelect;

type NodeRow = Prisma.ActivityNodeGetPayload<{
  select: (typeof PUBLIC_CURRICULUM_SELECT)['tracks']['select']['modules']['select']['nodes']['select'];
}>;

/** Public catalog and program detail (GET /v1/programs, GET /v1/programs/:slug). */
@Injectable()
export class ProgramsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly progress: ProgressService,
  ) {}

  async catalog(): Promise<ProgramSummary[]> {
    const rows = await this.prisma.program.findMany({
      where: { status: { in: CATALOG_STATUSES } },
      select: PROGRAM_SELECT,
      orderBy: { createdAt: 'desc' },
    });
    const counts = await enrollmentCountsByProgram(this.prisma, rows.map((r) => r.id));
    return rows.map((row) => toProgramSummary(row, counts.get(row.id)));
  }

  async detail(slug: string, viewer?: Viewer): Promise<ProgramDetail> {
    const row = await this.prisma.program.findUnique({
      where: { slug },
      select: { ...PROGRAM_SELECT, ...PUBLIC_CURRICULUM_SELECT },
    });
    // Drafts and archived programs do not exist for the public (404, not 403).
    if (!row || (!PUBLIC_DETAIL_STATUSES.includes(row.status) && !isStaff(viewer))) {
      throw apiError('NOT_FOUND', 'Program not found.');
    }

    const [counts, enrollment] = await Promise.all([
      enrollmentCountsByProgram(this.prisma, [row.id]),
      viewer
        ? this.prisma.enrollment.findUnique({
            where: { userId_programId: { userId: viewer.id, programId: row.id } },
            select: MY_ENROLLMENT_SELECT,
          })
        : null,
    ]);

    // Live progress and the lessons this learner completed (ticks in the curriculum).
    const [progress, completed] = enrollment
      ? await Promise.all([
          this.progress.forEnrollments([enrollment.id], { persist: true }),
          this.prisma.progressLog.findMany({
            where: { userId: viewer!.id, isCompleted: true, node: { module: { track: { programId: row.id } } } },
            select: { nodeId: true },
          }),
        ])
      : [undefined, []];
    const completedIds = new Set(completed.map((c) => c.nodeId));

    const myEnrollment = enrollment ? toMyEnrollmentRef(enrollment, progress?.get(enrollment.id)) : null;
    const unlocked = isStaff(viewer) || canAccessContent(myEnrollment?.status);

    return {
      ...toProgramSummary(row, counts.get(row.id)),
      tracks: row.tracks.map((track) => ({
        id: track.id,
        programId: track.programId,
        title: track.title,
        description: track.description,
        orderIndex: track.orderIndex,
        modules: track.modules.map((module) => ({
          id: module.id,
          trackId: module.trackId,
          title: module.title,
          description: module.description,
          orderIndex: module.orderIndex,
          nodes: module.nodes.flatMap((node) => toPublicNode(node, unlocked, completedIds.has(node.id)) ?? []),
        })),
      })),
      myEnrollment,
      enrollments: myEnrollment ? [myEnrollment] : [],
      canAccessContent: unlocked,
    };
  }
}

/**
 * Locked lessons keep their outline (title, type, duration) but not the content.
 * Assignment lessons appear only once their assignment is PUBLISHED, like the
 * assignments API; an ASSIGNMENT lesson without an assignment row is skipped.
 */
function toPublicNode(node: NodeRow, unlocked: boolean, isCompleted: boolean): ProgramNode | null {
  if (node.type === NodeType.ASSIGNMENT && node.assignment?.status !== AssignmentStatus.PUBLISHED) {
    return null;
  }
  // Same for quizzes: a QUIZ lesson appears once its quiz is published (GET /v1/nodes/:id then has it).
  if (node.type === NodeType.QUIZ && !node.quiz?.isPublished) {
    return null;
  }
  return {
    id: node.id,
    moduleId: node.moduleId,
    title: node.title,
    description: node.description,
    type: node.type,
    orderIndex: node.orderIndex,
    isMandatory: node.isMandatory,
    isLocked: !unlocked,
    isCompleted,
    video: node.video
      ? { durationSec: node.video.durationSec, playbackUrl: unlocked ? node.video.playbackUrl : null }
      : null,
    assignment: node.assignment
      ? {
          id: node.assignment.id,
          allowedType: node.assignment.allowedType,
          maxScore: node.assignment.maxScore.toNumber(),
          dueDate: node.assignment.dueDate?.toISOString() ?? null,
          instructions: unlocked ? node.assignment.instructions : null,
        }
      : null,
  };
}
