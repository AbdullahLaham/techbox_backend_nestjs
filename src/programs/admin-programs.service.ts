import { Inject, Injectable, Logger } from '@nestjs/common';
import { NodeType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { STORAGE_SERVICE, type StorageService } from '../storage/storage.service.js';
import { apiError } from '../common/api-errors.js';
import { AdminAssignmentsService } from '../assignments/admin-assignments.service.js';
import { parseCreateBody, parseUpdateBody } from '../assignments/assignment-validation.js';
import {
  CONTENT_OWNER_ROLES,
  type AdminModule,
  type AdminNode,
  type AdminProgram,
  type AdminProgramDetail,
  type AdminTrack,
} from '../types/api.contract.js';
import { CreateProgramDto } from './dto/create-program.dto.js';
import { UpdateProgramDto } from './dto/update-program.dto.js';
import { CreateTrackDto } from './dto/create-track.dto.js';
import { UpdateTrackDto } from './dto/update-track.dto.js';
import { CreateModuleDto } from './dto/create-module.dto.js';
import { UpdateModuleDto } from './dto/update-module.dto.js';
import { CreateNodeDto } from './dto/create-node.dto.js';
import { UpdateNodeDto } from './dto/update-node.dto.js';
import { AdminProgramListQuery } from './dto/admin-program-list.query.js';
import {
  PROGRAM_SELECT,
  enrollmentCountsByProgram,
  toAdminProgram,
  type ProgramRow,
  type Viewer,
} from './program-mapping.js';

const byOrder = [{ orderIndex: 'asc' as const }, { createdAt: 'asc' as const }];

const ADMIN_NODE_SELECT = {
  id: true,
  moduleId: true,
  title: true,
  description: true,
  type: true,
  orderIndex: true,
  isMandatory: true,
  createdAt: true,
  updatedAt: true,
  video: {
    select: {
      id: true,
      externalId: true,
      provider: true,
      durationSec: true,
      playbackUrl: true,
      transcodeState: true,
    },
  },
  assignment: {
    select: {
      id: true,
      status: true,
      instructions: true,
      allowedType: true,
      maxScore: true,
      dueDate: true,
      publishedAt: true,
    },
  },
} satisfies Prisma.ActivityNodeSelect;

const ADMIN_MODULE_SELECT = {
  id: true,
  trackId: true,
  title: true,
  description: true,
  orderIndex: true,
  createdAt: true,
  updatedAt: true,
  nodes: { orderBy: byOrder, select: ADMIN_NODE_SELECT },
} satisfies Prisma.ModuleSelect;

const ADMIN_TRACK_SELECT = {
  id: true,
  programId: true,
  title: true,
  description: true,
  orderIndex: true,
  createdAt: true,
  updatedAt: true,
  modules: { orderBy: byOrder, select: ADMIN_MODULE_SELECT },
} satisfies Prisma.TrackSelect;

type NodeRow = Prisma.ActivityNodeGetPayload<{ select: typeof ADMIN_NODE_SELECT }>;
type ModuleRow = Prisma.ModuleGetPayload<{ select: typeof ADMIN_MODULE_SELECT }>;
type TrackRow = Prisma.TrackGetPayload<{ select: typeof ADMIN_TRACK_SELECT }>;

/** Where to look for submissions and attachment files under a piece of curriculum. */
type Scope = { programId: string } | { trackId: string } | { moduleId: string } | { nodeId: string };

/** Dashboard program and curriculum management (/v1/admin/programs/**). */
@Injectable()
export class AdminProgramsService {
  private readonly logger = new Logger('ProgramsAdmin');

  constructor(
    private readonly prisma: PrismaService,
    private readonly assignments: AdminAssignmentsService,
    @Inject(STORAGE_SERVICE) private readonly storage: StorageService,
  ) {}

  /* ------------------------------- Programs ------------------------------- */

  async list(query: AdminProgramListQuery): Promise<AdminProgram[]> {
    const rows = await this.prisma.program.findMany({
      where: {
        status: query.status,
        type: query.type,
        ...(query.q
          ? {
              OR: [
                { title: { contains: query.q, mode: 'insensitive' } },
                { slug: { contains: query.q, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      select: PROGRAM_SELECT,
      orderBy: { createdAt: 'desc' },
    });
    return this.withCounts(rows);
  }

  /** By id or slug, any status, with the whole curriculum. */
  async detail(idOrSlug: string): Promise<AdminProgramDetail> {
    const row = await this.prisma.program.findFirst({
      where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }] },
      select: { ...PROGRAM_SELECT, tracks: { orderBy: byOrder, select: ADMIN_TRACK_SELECT } },
    });
    if (!row) throw apiError('NOT_FOUND', 'Program not found.');
    const [program] = await this.withCounts([row]);
    return { ...program, tracks: row.tracks.map(toAdminTrack) };
  }

  async create(viewer: Viewer, dto: CreateProgramDto): Promise<AdminProgram> {
    checkDates(dto.startDate, dto.endDate);
    const row = await this.withSlugCheck(() =>
      this.prisma.program.create({ data: programData(dto), select: PROGRAM_SELECT }),
    );
    this.audit(viewer, 'program.create', { programId: row.id });
    const [program] = await this.withCounts([row]);
    return program;
  }

  async update(viewer: Viewer, id: string, dto: UpdateProgramDto): Promise<AdminProgram> {
    const current = await this.prisma.program.findUnique({
      where: { id },
      select: { startDate: true, endDate: true },
    });
    if (!current) throw apiError('NOT_FOUND', 'Program not found.');
    checkDates(
      dto.startDate === undefined ? current.startDate : dto.startDate,
      dto.endDate === undefined ? current.endDate : dto.endDate,
    );

    const row = await this.withSlugCheck(() =>
      this.prisma.program.update({ where: { id }, data: programData(dto), select: PROGRAM_SELECT }),
    );
    this.audit(viewer, 'program.update', { programId: id });
    const [program] = await this.withCounts([row]);
    return program;
  }

  /** Refused while the program has enrollments or submissions: archive it instead. */
  async remove(viewer: Viewer, id: string): Promise<void> {
    const program = await this.prisma.program.findUnique({
      where: { id },
      select: { _count: { select: { enrollments: true } } },
    });
    if (!program) throw apiError('NOT_FOUND', 'Program not found.');
    if (program._count.enrollments > 0) {
      throw apiError('PROGRAM_HAS_ENROLLMENTS', 'Program has enrollments; archive it instead.');
    }
    const keys = await this.guardSubmissionsAndCollectFiles({ programId: id });
    await this.prisma.program.delete({ where: { id } });
    this.audit(viewer, 'program.delete', { programId: id });
    await this.deleteFiles(keys);
  }

  /* -------------------------------- Tracks -------------------------------- */

  async createTrack(viewer: Viewer, programId: string, dto: CreateTrackDto): Promise<AdminTrack> {
    const program = await this.prisma.program.findUnique({ where: { id: programId }, select: { id: true } });
    if (!program) throw apiError('NOT_FOUND', 'Program not found.');

    const orderIndex =
      dto.orderIndex ?? nextIndex(await this.prisma.track.aggregate({ where: { programId }, _max: { orderIndex: true } }));
    const row = await this.prisma.track.create({
      data: { programId, title: dto.title, description: dto.description ?? null, orderIndex },
      select: ADMIN_TRACK_SELECT,
    });
    this.audit(viewer, 'track.create', { programId, trackId: row.id });
    return toAdminTrack(row);
  }

  async updateTrack(viewer: Viewer, trackId: string, dto: UpdateTrackDto): Promise<AdminTrack> {
    await this.mustExist('track', trackId);
    const row = await this.prisma.track.update({
      where: { id: trackId },
      data: { title: dto.title, description: dto.description, orderIndex: dto.orderIndex },
      select: ADMIN_TRACK_SELECT,
    });
    this.audit(viewer, 'track.update', { trackId });
    return toAdminTrack(row);
  }

  async removeTrack(viewer: Viewer, trackId: string): Promise<void> {
    await this.mustExist('track', trackId);
    const keys = await this.guardSubmissionsAndCollectFiles({ trackId });
    await this.prisma.track.delete({ where: { id: trackId } });
    this.audit(viewer, 'track.delete', { trackId });
    await this.deleteFiles(keys);
  }

  /* ------------------------------- Modules -------------------------------- */

  async createModule(viewer: Viewer, trackId: string, dto: CreateModuleDto): Promise<AdminModule> {
    await this.mustExist('track', trackId);
    const orderIndex =
      dto.orderIndex ?? nextIndex(await this.prisma.module.aggregate({ where: { trackId }, _max: { orderIndex: true } }));
    const row = await this.prisma.module.create({
      data: { trackId, title: dto.title, description: dto.description ?? null, orderIndex },
      select: ADMIN_MODULE_SELECT,
    });
    this.audit(viewer, 'module.create', { trackId, moduleId: row.id });
    return toAdminModule(row);
  }

  async updateModule(viewer: Viewer, moduleId: string, dto: UpdateModuleDto): Promise<AdminModule> {
    await this.mustExist('module', moduleId);
    const row = await this.prisma.module.update({
      where: { id: moduleId },
      data: { title: dto.title, description: dto.description, orderIndex: dto.orderIndex },
      select: ADMIN_MODULE_SELECT,
    });
    this.audit(viewer, 'module.update', { moduleId });
    return toAdminModule(row);
  }

  async removeModule(viewer: Viewer, moduleId: string): Promise<void> {
    await this.mustExist('module', moduleId);
    const keys = await this.guardSubmissionsAndCollectFiles({ moduleId });
    await this.prisma.module.delete({ where: { id: moduleId } });
    this.audit(viewer, 'module.delete', { moduleId });
    await this.deleteFiles(keys);
  }

  /* -------------------------------- Lessons ------------------------------- */

  async createNode(viewer: Viewer, moduleId: string, dto: CreateNodeDto): Promise<AdminNode> {
    await this.mustExist('module', moduleId);

    if (dto.type === NodeType.ASSIGNMENT) {
      this.requireContentOwner(viewer);
      if (!dto.assignmentData) {
        throw apiError('VALIDATION_FAILED', 'assignmentData is required for ASSIGNMENT lessons.', {
          assignmentData: 'بيانات الواجب مطلوبة لهذا النوع من الدروس',
        });
      }
      if (dto.videoData) throw onlyFor('videoData', NodeType.VIDEO_LECTURE);

      // Same rules and the same single write as POST /v1/admin/assignments.
      const input = parseCreateBody({
        moduleId,
        title: dto.title,
        instructions: dto.assignmentData.instructions,
        allowedType: dto.assignmentData.allowedType,
        maxScore: dto.assignmentData.maxScore,
        dueDate: dto.assignmentData.dueDate,
        isMandatory: dto.isMandatory,
        orderIndex: dto.orderIndex,
      });
      const created = await this.assignments.create(viewer.id, { ...input, description: dto.description ?? null });
      return this.nodeByAssignment(created.id);
    }

    if (dto.assignmentData) throw onlyFor('assignmentData', NodeType.ASSIGNMENT);
    if (dto.videoData && dto.type !== NodeType.VIDEO_LECTURE) throw onlyFor('videoData', NodeType.VIDEO_LECTURE);

    const orderIndex =
      dto.orderIndex ??
      nextIndex(await this.prisma.activityNode.aggregate({ where: { moduleId }, _max: { orderIndex: true } }));
    const row = await this.prisma.activityNode.create({
      data: {
        moduleId,
        title: dto.title,
        description: dto.description ?? null,
        type: dto.type,
        orderIndex,
        isMandatory: dto.isMandatory ?? true,
        ...(dto.videoData ? { video: { create: { ...dto.videoData, transcodeState: 'READY' } } } : {}),
        // Every QUIZ lesson has its (unpublished) quiz; questions are added via /v1/admin/quizzes.
        ...(dto.type === NodeType.QUIZ ? { quiz: { create: { title: dto.title } } } : {}),
      },
      select: ADMIN_NODE_SELECT,
    });
    this.audit(viewer, 'node.create', { moduleId, nodeId: row.id });
    return toAdminNode(row);
  }

  async updateNode(viewer: Viewer, nodeId: string, dto: UpdateNodeDto): Promise<AdminNode> {
    const node = await this.prisma.activityNode.findUnique({
      where: { id: nodeId },
      select: { type: true, moduleId: true, title: true, isMandatory: true, assignment: { select: { id: true } } },
    });
    if (!node) throw apiError('NOT_FOUND', 'Lesson not found.');
    if (dto.type !== undefined && dto.type !== node.type) {
      throw apiError('NODE_TYPE_LOCKED', 'A lesson type cannot change; delete it and create a new one.');
    }

    if (node.type === NodeType.ASSIGNMENT) {
      this.requireContentOwner(viewer);
      if (dto.videoData) throw onlyFor('videoData', NodeType.VIDEO_LECTURE);
      const a = dto.assignmentData ?? {};

      if (!node.assignment) {
        // Lesson created before assignments were validated: create its assignment now.
        if (!a.instructions) {
          throw apiError('VALIDATION_FAILED', 'assignmentData.instructions is required.', {
            'assignmentData.instructions': 'تعليمات الواجب مطلوبة',
          });
        }
        const input = parseCreateBody({
          moduleId: node.moduleId,
          title: dto.title ?? node.title,
          instructions: a.instructions,
          allowedType: a.allowedType,
          maxScore: a.maxScore,
          dueDate: a.dueDate,
          isMandatory: dto.isMandatory ?? node.isMandatory,
        });
        await this.prisma.assignment.create({
          data: {
            nodeId,
            instructions: input.instructions,
            allowedType: input.allowedType,
            maxScore: input.maxScore,
            dueDate: input.dueDate,
          },
        });
        await this.prisma.activityNode.update({
          where: { id: nodeId },
          data: { title: input.title, description: dto.description, isMandatory: input.isMandatory, orderIndex: dto.orderIndex },
        });
        this.audit(viewer, 'node.update', { nodeId });
        return this.nodeById(nodeId);
      }

      // Same rules as PATCH /v1/admin/assignments/:id (locked allowedType, score floor, ...).
      const input = parseUpdateBody(
        dropUndefined({
          title: dto.title,
          isMandatory: dto.isMandatory,
          orderIndex: dto.orderIndex,
          instructions: a.instructions,
          allowedType: a.allowedType,
          maxScore: a.maxScore,
          dueDate: a.dueDate,
        }),
      );
      await this.assignments.update(viewer.id, node.assignment.id, { ...input, description: dto.description });
      return this.nodeById(nodeId);
    }

    if (dto.assignmentData) throw onlyFor('assignmentData', NodeType.ASSIGNMENT);
    if (dto.videoData && node.type !== NodeType.VIDEO_LECTURE) throw onlyFor('videoData', NodeType.VIDEO_LECTURE);

    let video: Prisma.VideoAssetUpdateOneWithoutNodeNestedInput | undefined;
    if (dto.videoData) {
      const existing = await this.prisma.videoAsset.findUnique({ where: { nodeId }, select: { id: true } });
      const { externalId, durationSec, playbackUrl } = dto.videoData;
      if (existing) {
        video = { update: { externalId, durationSec, playbackUrl } };
      } else if (externalId !== undefined && durationSec !== undefined && playbackUrl !== undefined) {
        video = { create: { externalId, durationSec, playbackUrl, transcodeState: 'READY' } };
      } else {
        throw apiError('VALIDATION_FAILED', 'videoData needs externalId, durationSec and playbackUrl.', {
          videoData: 'بيانات الفيديو غير مكتملة',
        });
      }
    }

    const row = await this.prisma.activityNode.update({
      where: { id: nodeId },
      data: {
        title: dto.title,
        description: dto.description,
        orderIndex: dto.orderIndex,
        isMandatory: dto.isMandatory,
        video,
      },
      select: ADMIN_NODE_SELECT,
    });
    this.audit(viewer, 'node.update', { nodeId });
    return toAdminNode(row);
  }

  async removeNode(viewer: Viewer, nodeId: string): Promise<void> {
    const node = await this.prisma.activityNode.findUnique({ where: { id: nodeId }, select: { type: true } });
    if (!node) throw apiError('NOT_FOUND', 'Lesson not found.');
    if (node.type === NodeType.ASSIGNMENT) this.requireContentOwner(viewer);

    const keys = await this.guardSubmissionsAndCollectFiles({ nodeId });
    await this.prisma.activityNode.delete({ where: { id: nodeId } });
    this.audit(viewer, 'node.delete', { nodeId });
    await this.deleteFiles(keys);
  }

  /* ------------------------------- Helpers -------------------------------- */

  private async withCounts(rows: ProgramRow[]): Promise<AdminProgram[]> {
    const counts = await enrollmentCountsByProgram(this.prisma, rows.map((r) => r.id));
    return rows.map((row) => toAdminProgram(row, counts.get(row.id)));
  }

  private async withSlugCheck<T>(write: () => Promise<T>): Promise<T> {
    try {
      return await write();
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw apiError('SLUG_TAKEN', 'This slug is already used by another program.', {
          slug: 'هذا الرابط التعريفي مستخدم لبرنامج آخر',
        });
      }
      throw error;
    }
  }

  private async mustExist(kind: 'track' | 'module', id: string) {
    const found =
      kind === 'track'
        ? await this.prisma.track.findUnique({ where: { id }, select: { id: true } })
        : await this.prisma.module.findUnique({ where: { id }, select: { id: true } });
    if (!found) throw apiError('NOT_FOUND', `${kind === 'track' ? 'Track' : 'Module'} not found.`);
  }

  /** Assignment lessons follow the assignment permissions (ASSIGNMENT_MANAGER_ROLES). */
  private requireContentOwner(viewer: Viewer) {
    if (!(CONTENT_OWNER_ROLES as readonly string[]).includes(viewer.globalRole)) {
      throw apiError('FORBIDDEN', 'Only managers can create, edit or delete assignment lessons.');
    }
  }

  /**
   * Deleting curriculum cascades to assignments and their submissions, so it is refused
   * while students have submitted anything inside it. Returns the attachment files to
   * delete from storage once the rows are gone.
   */
  private async guardSubmissionsAndCollectFiles(scope: Scope): Promise<string[]> {
    const node: Prisma.ActivityNodeWhereInput =
      'nodeId' in scope
        ? { id: scope.nodeId }
        : 'moduleId' in scope
          ? { moduleId: scope.moduleId }
          : 'trackId' in scope
            ? { module: { trackId: scope.trackId } }
            : { module: { track: { programId: scope.programId } } };

    const submissions = await this.prisma.submission.count({ where: { assignment: { node } } });
    if (submissions > 0) {
      throw apiError('CONTENT_HAS_SUBMISSIONS', 'Students have submitted assignments inside this content.');
    }
    const attempts = await this.prisma.quizAttempt.count({ where: { quiz: { node } } });
    if (attempts > 0) {
      throw apiError('QUIZ_HAS_ATTEMPTS', 'Students have attempted a quiz inside this content.');
    }
    const [attachments, resources] = await Promise.all([
      this.prisma.assignmentAttachment.findMany({ where: { assignment: { node } }, select: { storageKey: true } }),
      this.prisma.nodeResource.findMany({ where: { node, storageKey: { not: null } }, select: { storageKey: true } }),
    ]);
    return [...attachments.map((f) => f.storageKey), ...resources.map((r) => r.storageKey!)];
  }

  /** Best effort, after the database commit: a failure leaves an orphan file, logged with its key. */
  private async deleteFiles(keys: string[]) {
    await Promise.all(
      keys.map((storageKey) =>
        this.storage.delete(storageKey).catch((error: unknown) =>
          this.logger.error(
            JSON.stringify({
              event: 'storage.orphan',
              storageKey,
              error: error instanceof Error ? error.message : String(error),
            }),
          ),
        ),
      ),
    );
  }

  private async nodeById(nodeId: string): Promise<AdminNode> {
    const row = await this.prisma.activityNode.findUniqueOrThrow({ where: { id: nodeId }, select: ADMIN_NODE_SELECT });
    return toAdminNode(row);
  }

  private async nodeByAssignment(assignmentId: string): Promise<AdminNode> {
    const row = await this.prisma.activityNode.findFirstOrThrow({
      where: { assignment: { id: assignmentId } },
      select: ADMIN_NODE_SELECT,
    });
    return toAdminNode(row);
  }

  private audit(viewer: Viewer, action: string, ids: Record<string, string>) {
    this.logger.log(JSON.stringify({ userId: viewer.id, action, ...ids }));
  }
}

/* --------------------------------- Mapping -------------------------------- */

function programData(dto: UpdateProgramDto): Prisma.ProgramUpdateInput & Prisma.ProgramCreateInput {
  return {
    title: dto.title!,
    slug: dto.slug!,
    description: dto.description,
    type: dto.type,
    status: dto.status,
    coverImage: dto.coverImage,
    maxSeats: dto.maxSeats,
    startDate: toDate(dto.startDate),
    endDate: toDate(dto.endDate),
    isEnrollmentOpen: dto.isEnrollmentOpen,
  };
}

const toDate = (value: string | null | undefined) => (value === undefined ? undefined : value === null ? null : new Date(value));

function checkDates(start: string | Date | null | undefined, end: string | Date | null | undefined) {
  if (start && end && new Date(end).getTime() < new Date(start).getTime()) {
    throw apiError('VALIDATION_FAILED', 'endDate must not be before startDate.', {
      endDate: 'تاريخ الانتهاء يجب أن يكون بعد تاريخ البدء',
    });
  }
}

const nextIndex = (agg: { _max: { orderIndex: number | null } }) =>
  agg._max.orderIndex === null ? 0 : agg._max.orderIndex + 1;

const onlyFor = (field: string, type: NodeType) =>
  apiError('VALIDATION_FAILED', `${field} is only allowed for ${type} lessons.`, {
    [field]: `هذا الحقل خاص بدروس ${type}`,
  });

function dropUndefined(obj: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined));
}

function toAdminNode(row: NodeRow): AdminNode {
  return {
    id: row.id,
    moduleId: row.moduleId,
    title: row.title,
    description: row.description,
    type: row.type,
    orderIndex: row.orderIndex,
    isMandatory: row.isMandatory,
    video: row.video,
    assignment: row.assignment
      ? {
          id: row.assignment.id,
          status: row.assignment.status,
          instructions: row.assignment.instructions,
          allowedType: row.assignment.allowedType,
          maxScore: row.assignment.maxScore.toNumber(),
          dueDate: row.assignment.dueDate?.toISOString() ?? null,
          publishedAt: row.assignment.publishedAt?.toISOString() ?? null,
        }
      : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toAdminModule(row: ModuleRow): AdminModule {
  return {
    id: row.id,
    trackId: row.trackId,
    title: row.title,
    description: row.description,
    orderIndex: row.orderIndex,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    nodes: row.nodes.map(toAdminNode),
  };
}

function toAdminTrack(row: TrackRow): AdminTrack {
  return {
    id: row.id,
    programId: row.programId,
    title: row.title,
    description: row.description,
    orderIndex: row.orderIndex,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    modules: row.modules.map(toAdminModule),
  };
}
