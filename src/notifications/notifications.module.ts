import { Controller, Get, Global, HttpCode, HttpStatus, Module, Param, Patch, Post, Query, Req, UseFilters, UseGuards, UseInterceptors } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { AuthModule } from '../auth/auth.module.js';
import { ApiExceptionFilter } from '../common/api-errors.js';
import { PrivateCacheInterceptor } from '../common/private-cache.interceptor.js';
import { NotificationsService } from './notifications.service.js';
import { NotificationListQueryDto } from './notification.dto.js';

/** The signed-in user's own notifications (api-contract-mobile.md, "Notifications"). */
@Controller('v1/notifications')
@UseGuards(JwtAuthGuard)
@UseFilters(ApiExceptionFilter)
@UseInterceptors(PrivateCacheInterceptor)
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  list(@Req() req: any, @Query() query: NotificationListQueryDto) {
    return this.notifications.list(req.user.id, query);
  }

  @Get('unread-count')
  unreadCount(@Req() req: any) {
    return this.notifications.unreadCount(req.user.id);
  }

  @Post('read-all')
  @HttpCode(HttpStatus.OK)
  markAllRead(@Req() req: any) {
    return this.notifications.markAllRead(req.user.id);
  }

  @Patch(':id/read')
  markRead(@Req() req: any, @Param('id') id: string) {
    return this.notifications.markRead(req.user.id, id);
  }
}

/** Global so enrollments, assignments and submissions can send notifications. */
@Global()
@Module({
  imports: [AuthModule],
  controllers: [NotificationsController],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
