import { Inject, Injectable, Logger } from '@nestjs/common';
import { NodeResourceKind, NodeType, Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service.js';
import { STORAGE_SERVICE, type StorageService } from '../storage/storage.service.js';
import { apiError } from '../common/api-errors.js';
import { inspectUpload } from '../common/uploads.js';
import type { Viewer } from '../programs/program-mapping.js';
import { isStaff } from '../programs/program-mapping.js';
import { MANAGED_NODE_TYPES, NODE_FILE_LIMITS, type AdminNodeDetail, type NodeContent } from '../types/nodes.contract.js';
import { toAdminQuizSummary, toStudentSummary } from '../quizzes/quiz-logic.js';
import { NodeAccessService } from './node-access.service.js';
import { CreateNodeDto, UpdateNodeDto } from './dto/node.dto.js';

const FILE_URL_TTL_SEC = 3600;
const MANAGED = MANAGED_NODE_TYPES as NodeType[];

const RESOURCE_SELECT = {
  kind: true,
  url: true,
  storageKey: true,
  fileName: true,
  mimeType: true,
  sizeBytes: true,
} satisfies Prisma.NodeResourceSelect;

const ADMIN_NODE_SELECT = {
  id: true,
  moduleId: true,
  type: true,
  title: true,
  description: true,
  orderIndex: true,
  isMandatory: true,
  createdAt: true,
  updatedAt: true,
  video: { select: { externalId: true, playbackUrl: true, durationSec: true, provider: true } },
  resource: { select: RESOURCE_SELECT },
  quiz: {
    select: {
      id: true,
      title: true,
      isPublished: true,
      passingScore: true,
      questions: { select: { points: true } },
      _count: { select: { attempts: true } },
    },
  },
} satisfies Prisma.ActivityNodeSelect;

type AdminNodeRow = Prisma.ActivityNodeGetPayload<{ select: typeof ADMIN_NODE_SELECT }>;
type ResourceRow = Prisma.NodeResourceGetPayload<{ select: typeof RESOURCE_SELECT }>;

/** Bunny embed URLs end with the video id (…/embed/<library>/<video>). */
function externalIdFromUrl(url: string): string {
  try {
    return new URL(url).pathname.split('/').filter(Boolean).pop() || url;
  } catch {
    return url;
  }
}

const onlyFor = (field: string, type: string) =>
  apiError('VALIDATION_FAILED', `${field} is only allowed for ${type} lessons.`, { [field]: `هذا الحقل خاص بدروس ${type}` });

/**
 * Lessons of type QUIZ, VIDEO_LECTURE and READING_MATERIAL (nodes.contract.ts).
 * Other types (ASSIGNMENT, LIVE_SESSION, ...) are not managed here and answer 404.
 */
@Injectable()
export class NodesService {
  private readonly logger = new Logger('Nodes');

  constructor(
    private readonly prisma: PrismaService,
    private readonly access: NodeAccessService,
    @Inject(STORAGE_SERVICE) private readonly storage: StorageService,
  ) {}

  /* --------------------------------- Admin -------------------------------- */

  async list(moduleId: string): Promise<AdminNodeDetail[]> {
    const rows = await this.prisma.activityNode.findMany({
      where: { moduleId, type: { in: MANAGED } },
      select: ADMIN_NODE_SELECT,
      orderBy: [{ orderIndex: 'asc' }, { createdAt: 'asc' }],
    });
    return Promise.all(rows.map((r) => this.toAdmin(r)));
  }

  async detail(nodeId: string): Promise<AdminNodeDetail> {
    return this.toAdmin(await this.findManaged(nodeId));
  }

  async create(viewer: Viewer, dto: CreateNodeDto): Promise<AdminNodeDetail> {
    const module = await this.prisma.module.findUnique({ where: { id: dto.moduleId }, select: { id: true } });
    if (!module) throw apiError('NOT_FOUND', 'Module not found.');

    if (dto.type === NodeType.VIDEO_LECTURE && !dto.video) {
      throw apiError('VALIDATION_FAILED', 'video is required for VIDEO_LECTURE lessons.', { video: 'بيانات الفيديو مطلوبة' });
    }
    if (dto.video && dto.type !== NodeType.VIDEO_LECTURE) throw onlyFor('video', NodeType.VIDEO_LECTURE);
    if (dto.link && dto.type !== NodeType.READING_MATERIAL) throw onlyFor('link', NodeType.READING_MATERIAL);
    if (dto.quiz && dto.type !== NodeType.QUIZ) throw onlyFor('quiz', NodeType.QUIZ);

    const orderIndex =
      dto.orderIndex ??
      (await this.prisma.activityNode
        .aggregate({ where: { moduleId: dto.moduleId }, _max: { orderIndex: true } })
        .then((a) => (a._max.orderIndex === null ? 0 : a._max.orderIndex + 1)));

    // One nested write: the lesson and its video, link or (unpublished) quiz together.
    const row = await this.prisma.activityNode.create({
      data: {
        moduleId: dto.moduleId,
        type: dto.type,
        title: dto.title,
        description: dto.description ?? null,
        orderIndex,
        isMandatory: dto.isMandatory ?? true,
        ...(dto.video
          ? {
              video: {
                create: {
                  playbackUrl: dto.video.playbackUrl,
                  durationSec: dto.video.durationSec,
                  externalId: dto.video.externalId ?? externalIdFromUrl(dto.video.playbackUrl),
                  transcodeState: 'READY',
                },
              },
            }
          : {}),
        ...(dto.link ? { resource: { create: { kind: NodeResourceKind.LINK, url: dto.link } } } : {}),
        ...(dto.type === NodeType.QUIZ
          ? {
              quiz: {
                create: {
                  title: dto.quiz?.title ?? dto.title,
                  description: dto.quiz?.description ?? null,
                  passingScore: dto.quiz?.passingScore ?? 0,
                  maxAttempts: dto.quiz?.maxAttempts ?? null,
                  showCorrectAnswers: dto.quiz?.showCorrectAnswers ?? true,
                },
              },
            }
          : {}),
      },
      select: ADMIN_NODE_SELECT,
    });
    this.audit(viewer, 'node.create', row.id);
    return this.toAdmin(row);
  }

  async update(viewer: Viewer, nodeId: string, dto: UpdateNodeDto): Promise<AdminNodeDetail> {
    const node = await this.findManaged(nodeId);
    if (dto.video && node.type !== NodeType.VIDEO_LECTURE) throw onlyFor('video', NodeType.VIDEO_LECTURE);
    if (dto.link && node.type !== NodeType.READING_MATERIAL) throw onlyFor('link', NodeType.READING_MATERIAL);

    let video: Prisma.VideoAssetUpdateOneWithoutNodeNestedInput | undefined;
    if (dto.video) {
      const { playbackUrl, durationSec } = dto.video;
      const externalId = dto.video.externalId ?? (playbackUrl ? externalIdFromUrl(playbackUrl) : undefined);
      if (node.video) {
        video = { update: { playbackUrl, durationSec, externalId } };
      } else if (playbackUrl && durationSec !== undefined) {
        video = { create: { playbackUrl, durationSec, externalId: externalId!, transcodeState: 'READY' } };
      } else {
        throw apiError('VALIDATION_FAILED', 'video needs playbackUrl and durationSec.', { video: 'بيانات الفيديو غير مكتملة' });
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
        ...(dto.link
          ? {
              resource: {
                upsert: {
                  create: { kind: NodeResourceKind.LINK, url: dto.link },
                  update: { kind: NodeResourceKind.LINK, url: dto.link, storageKey: null, fileName: null, mimeType: null, sizeBytes: null },
                },
              },
            }
          : {}),
      },
      select: ADMIN_NODE_SELECT,
    });
    // A link replaces a stored file: delete it once the row no longer points at it.
    if (dto.link && node.resource?.storageKey) await this.deleteFile(node.resource.storageKey);
    this.audit(viewer, 'node.update', nodeId);
    return this.toAdmin(row);
  }

  /** READING_MATERIAL: store a file; replaces the current link or file. */
  async uploadFile(viewer: Viewer, nodeId: string, file: Express.Multer.File | undefined): Promise<AdminNodeDetail> {
    const node = await this.findManaged(nodeId);
    if (node.type !== NodeType.READING_MATERIAL) throw onlyFor('file', NodeType.READING_MATERIAL);
    if (!file) throw apiError('VALIDATION_FAILED', 'Send one file in the "file" field.', { file: 'الملف مطلوب' });

    const { ext, mimeType, fileName } = await inspectUpload(file, NODE_FILE_LIMITS.allowedTypes);
    const storageKey = `nodes/${nodeId}/${randomUUID()}${ext}`;
    // Storage first, then the row; if the row fails, remove the file.
    await this.storage.put(storageKey, file.buffer, { contentType: mimeType });
    const data = { kind: NodeResourceKind.FILE, url: null, storageKey, fileName, mimeType, sizeBytes: file.size };
    let row: AdminNodeRow;
    try {
      row = await this.prisma.activityNode.update({
        where: { id: nodeId },
        data: { resource: { upsert: { create: data, update: data } } },
        select: ADMIN_NODE_SELECT,
      });
    } catch (error) {
      await this.deleteFile(storageKey);
      throw error;
    }
    if (node.resource?.storageKey) await this.deleteFile(node.resource.storageKey);
    this.audit(viewer, 'node.file.upload', nodeId);
    return this.toAdmin(row);
  }

  async removeResource(viewer: Viewer, nodeId: string): Promise<AdminNodeDetail> {
    const node = await this.findManaged(nodeId);
    if (!node.resource) return this.toAdmin(node);
    await this.prisma.nodeResource.delete({ where: { nodeId } });
    if (node.resource.storageKey) await this.deleteFile(node.resource.storageKey);
    this.audit(viewer, 'node.resource.delete', nodeId);
    return this.detail(nodeId);
  }

  /** Refused once students attempted the lesson's quiz (their results would be lost). */
  async remove(viewer: Viewer, nodeId: string): Promise<void> {
    const node = await this.findManaged(nodeId);
    if (node.quiz && node.quiz._count.attempts > 0) {
      throw apiError('QUIZ_HAS_ATTEMPTS', 'Students have attempted this quiz; the lesson cannot be deleted.');
    }
    await this.prisma.activityNode.delete({ where: { id: nodeId } });
    if (node.resource?.storageKey) await this.deleteFile(node.resource.storageKey);
    this.audit(viewer, 'node.delete', nodeId);
  }

  /* -------------------------------- Learner ------------------------------- */

  /** GET /v1/nodes/:nodeId */
  async content(viewer: Viewer, nodeId: string): Promise<NodeContent> {
    const program = await this.access.assertLearnerAccess(nodeId, viewer);
    const node = await this.prisma.activityNode.findUnique({
      where: { id: nodeId },
      select: {
        id: true,
        moduleId: true,
        type: true,
        title: true,
        description: true,
        isMandatory: true,
        video: { select: { playbackUrl: true, durationSec: true } },
        resource: { select: RESOURCE_SELECT },
        quiz: {
          select: {
            id: true,
            title: true,
            description: true,
            passingScore: true,
            maxAttempts: true,
            isPublished: true,
            questions: { select: { points: true } },
            attempts: {
              where: { studentId: viewer.id },
              orderBy: { submittedAt: 'desc' },
              select: { id: true, score: true, passed: true },
            },
          },
        },
        progress: { where: { userId: viewer.id }, select: { isCompleted: true } },
      },
    });
    if (!node || !MANAGED.includes(node.type)) throw apiError('NOT_FOUND', 'Lesson not found.');

    return {
      id: node.id,
      moduleId: node.moduleId,
      program,
      type: node.type as NodeContent['type'],
      title: node.title,
      description: node.description,
      isMandatory: node.isMandatory,
      isCompleted: !isStaff(viewer) && (node.progress[0]?.isCompleted ?? false),
      video: node.video,
      resource: node.resource ? await this.toResource(node.resource) : null,
      quiz: node.quiz?.isPublished ? toStudentSummary(node.quiz, node.quiz.attempts) : null,
    };
  }

  /* ------------------------------- Helpers -------------------------------- */

  private async findManaged(nodeId: string): Promise<AdminNodeRow> {
    const row = await this.prisma.activityNode.findUnique({ where: { id: nodeId }, select: ADMIN_NODE_SELECT });
    if (!row || !MANAGED.includes(row.type)) throw apiError('NOT_FOUND', 'Lesson not found.');
    return row;
  }

  private async toAdmin(row: AdminNodeRow): Promise<AdminNodeDetail> {
    return {
      id: row.id,
      moduleId: row.moduleId,
      type: row.type as AdminNodeDetail['type'],
      title: row.title,
      description: row.description,
      orderIndex: row.orderIndex,
      isMandatory: row.isMandatory,
      video: row.video,
      resource: row.resource ? await this.toResource(row.resource) : null,
      quiz: row.quiz ? toAdminQuizSummary(row.quiz) : null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private async toResource(r: ResourceRow) {
    const url =
      r.kind === NodeResourceKind.FILE && r.storageKey
        ? await this.storage.getDownloadUrl(r.storageKey, {
            fileName: r.fileName ?? 'file',
            contentType: r.mimeType ?? 'application/octet-stream',
            expiresInSec: FILE_URL_TTL_SEC,
          })
        : (r.url ?? '');
    return { kind: r.kind, url, fileName: r.fileName, mimeType: r.mimeType, sizeBytes: r.sizeBytes };
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

  private audit(viewer: Viewer, action: string, nodeId: string) {
    this.logger.log(JSON.stringify({ userId: viewer.id, action, nodeId }));
  }
}
