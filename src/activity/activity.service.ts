import { Global, Injectable, Logger, Module } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

/** Activity is kept per 15-minute window: every UTC offset in use is a multiple of 15 minutes. */
export const ACTIVITY_BUCKET_MS = 15 * 60 * 1000;

/** Start (UTC) of the 15-minute window that contains `at`. */
export function activityBucket(at: Date): Date {
  return new Date(Math.floor(at.getTime() / ACTIVITY_BUCKET_MS) * ACTIVITY_BUCKET_MS);
}

/**
 * When students learn (LearningActivity), for the weekly activity of the Home screen.
 *
 * `record` is called after a student action has been saved (lesson progress, assignment
 * submission, quiz attempt). Best effort, like notifications: one idempotent insert, and a
 * failure is logged, never thrown, so it cannot fail the student's action.
 */
@Injectable()
export class ActivityService {
  private readonly logger = new Logger('Activity');

  constructor(private readonly prisma: PrismaService) {}

  async record(userId: string, at: Date = new Date()): Promise<void> {
    try {
      await this.prisma.learningActivity.createMany({
        data: [{ userId, bucketStart: activityBucket(at) }],
        skipDuplicates: true,
      });
    } catch (error) {
      this.logger.error(JSON.stringify({ event: 'activity.record_failed', userId, error: String(error) }));
    }
  }

  /** Window starts with activity since `since` (inclusive), oldest first. */
  async since(userId: string, since: Date): Promise<Date[]> {
    const rows = await this.prisma.learningActivity.findMany({
      where: { userId, bucketStart: { gte: activityBucket(since) } },
      select: { bucketStart: true },
      orderBy: { bucketStart: 'asc' },
    });
    return rows.map((r) => r.bucketStart);
  }
}

/** Global so lessons, submissions and quizzes can record activity without importing it. */
@Global()
@Module({ providers: [ActivityService], exports: [ActivityService] })
export class ActivityModule {}
