import { Injectable, Logger } from '@nestjs/common';
import { NotificationType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { apiError } from '../common/api-errors.js';
import type { AppNotification, NotificationList, ReadAllResult, UnreadCount } from '../types/api.contract.js';
import { NotificationListQueryDto } from './notification.dto.js';

export type NewNotification = {
  type: NotificationType;
  title: string;
  message: string;
  actionUrl?: string | null;
};

const SELECT = {
  id: true,
  type: true,
  title: true,
  message: true,
  isRead: true,
  actionUrl: true,
  createdAt: true,
} satisfies Prisma.NotificationSelect;

/** In-app notifications: reading them (learner API) and sending them (other modules). */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger('Notifications');

  constructor(private readonly prisma: PrismaService) {}

  /* ------------------------------- Sending -------------------------------- */

  /**
   * Sends the same notification to several users. Best effort: called after the action
   * that triggers it has been saved, and a failure is logged, never thrown.
   */
  async notify(userIds: string[], notification: NewNotification): Promise<number> {
    const unique = [...new Set(userIds)];
    if (unique.length === 0) return 0;
    try {
      const { count } = await this.prisma.notification.createMany({
        data: unique.map((userId) => ({ userId, ...notification, actionUrl: notification.actionUrl ?? null })),
      });
      return count;
    } catch (error) {
      this.logger.error(
        JSON.stringify({ event: 'notification.failed', type: notification.type, users: unique.length, error: String(error) }),
      );
      return 0;
    }
  }

  /* ------------------------------- Reading -------------------------------- */

  async list(userId: string, query: NotificationListQueryDto): Promise<NotificationList> {
    const where: Prisma.NotificationWhereInput = { userId, ...(query.unreadOnly ? { isRead: false } : {}) };
    const [rows, total, unreadCount] = await this.prisma.$transaction([
      this.prisma.notification.findMany({
        where,
        select: SELECT,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.notification.count({ where }),
      this.prisma.notification.count({ where: { userId, isRead: false } }),
    ]);
    return { items: rows.map(toDto), page: query.page, pageSize: query.pageSize, total, unreadCount };
  }

  async unreadCount(userId: string): Promise<UnreadCount> {
    return { unreadCount: await this.prisma.notification.count({ where: { userId, isRead: false } }) };
  }

  /** Only the user's own notifications; anyone else's id gives 404. */
  async markRead(userId: string, id: string): Promise<AppNotification> {
    const { count } = await this.prisma.notification.updateMany({ where: { id, userId }, data: { isRead: true } });
    if (count === 0) throw apiError('NOT_FOUND', 'Notification not found.');
    return toDto(await this.prisma.notification.findUniqueOrThrow({ where: { id }, select: SELECT }));
  }

  async markAllRead(userId: string): Promise<ReadAllResult> {
    const { count } = await this.prisma.notification.updateMany({ where: { userId, isRead: false }, data: { isRead: true } });
    return { updated: count, unreadCount: 0 };
  }
}

function toDto(row: Prisma.NotificationGetPayload<{ select: typeof SELECT }>): AppNotification {
  return { ...row, createdAt: row.createdAt.toISOString() };
}
