import { Global, Injectable, Logger, Module } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';

/** Completed and total countable lessons of an enrollment, and the rounded percentage. */
export type ProgramProgress = { completedLessons: number; totalLessons: number; percent: number };

export const EMPTY_PROGRESS: ProgramProgress = { completedLessons: 0, totalLessons: 0, percent: 0 };

/**
 * Program progress of enrollments.
 *
 * Counted lessons: mandatory lessons a student can see, i.e. every mandatory lesson
 * except ASSIGNMENT lessons whose assignment is not PUBLISHED and QUIZ lessons whose quiz
 * is not published (same rule as the public curriculum). A lesson is done when its
 * ProgressLog row has isCompleted (video watched / reading marked done / quiz passed /
 * assignment graded).
 *
 * The percentage is computed from the data on every call, so it follows curriculum
 * changes; `persist` also writes it to Enrollment.progressPct (kept as a cache for
 * anything reading the column directly).
 */
@Injectable()
export class ProgressService {
  private readonly logger = new Logger('Progress');

  constructor(private readonly prisma: PrismaService) {}

  async forEnrollments(enrollmentIds: string[], opts: { persist?: boolean } = {}): Promise<Map<string, ProgramProgress>> {
    const result = new Map<string, ProgramProgress>();
    if (enrollmentIds.length === 0) return result;

    const rows = await this.prisma.$queryRaw<Array<{ id: string; total: number; done: number; stored: number }>>`
      SELECT e."id",
             e."progressPct" AS stored,
             count(n."id")::int AS total,
             count(n."id") FILTER (WHERE pl."isCompleted")::int AS done
      FROM "Enrollment" e
      LEFT JOIN "Track" t ON t."programId" = e."programId"
      LEFT JOIN "Module" m ON m."trackId" = t."id"
      LEFT JOIN "ActivityNode" n ON n."moduleId" = m."id"
        AND n."isMandatory"
        AND (n."type" <> 'ASSIGNMENT' OR EXISTS (
              SELECT 1 FROM "Assignment" a WHERE a."nodeId" = n."id" AND a."status" = 'PUBLISHED'))
        AND (n."type" <> 'QUIZ' OR EXISTS (
              SELECT 1 FROM "Quiz" q WHERE q."nodeId" = n."id" AND q."isPublished"))
      LEFT JOIN "ProgressLog" pl ON pl."nodeId" = n."id" AND pl."userId" = e."userId"
      WHERE e."id" IN (${Prisma.join(enrollmentIds)})
      GROUP BY e."id", e."progressPct"`;

    const stale: Array<{ id: string; percent: number }> = [];
    for (const r of rows) {
      const percent = r.total === 0 ? 0 : Math.round((r.done / r.total) * 1000) / 10;
      result.set(r.id, { completedLessons: r.done, totalLessons: r.total, percent });
      if (opts.persist && Math.abs(r.stored - percent) > 1e-9) stale.push({ id: r.id, percent });
    }
    if (stale.length) {
      await this.prisma.$transaction(
        stale.map((s) => this.prisma.enrollment.update({ where: { id: s.id }, data: { progressPct: s.percent } })),
      );
    }
    return result;
  }

  /** After a lesson was completed: refresh the progress of the learner's enrollment in its program. */
  async refreshForLesson(userId: string, nodeId: string): Promise<ProgramProgress | null> {
    const node = await this.prisma.activityNode.findUnique({
      where: { id: nodeId },
      select: { module: { select: { track: { select: { programId: true } } } } },
    });
    if (!node) return null;
    const enrollment = await this.prisma.enrollment.findUnique({
      where: { userId_programId: { userId, programId: node.module.track.programId } },
      select: { id: true },
    });
    if (!enrollment) return null;
    try {
      return (await this.forEnrollments([enrollment.id], { persist: true })).get(enrollment.id) ?? EMPTY_PROGRESS;
    } catch (error) {
      // Progress is derived data: never fail the learner's action because of it.
      this.logger.error(JSON.stringify({ event: 'progress.refresh_failed', userId, nodeId, error: String(error) }));
      return null;
    }
  }
}

/** Global so every feature module can refresh progress without importing it. */
@Global()
@Module({ providers: [ProgressService], exports: [ProgressService] })
export class ProgressModule {}
