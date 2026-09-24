import { Controller, Get, Param, Patch, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  findMine(@Req() req: { user?: { sub?: number; orgId?: number } }) {
    return this.notificationsService.findMine(req.user);
  }

  @Get('unread-count')
  unreadCount(@Req() req: { user?: { sub?: number; orgId?: number } }) {
    return this.notificationsService.unreadCount(req.user);
  }

  @Patch('read-all')
  markAllRead(@Req() req: { user?: { sub?: number; orgId?: number } }) {
    return this.notificationsService.markAllRead(req.user);
  }

  @Patch(':id/read')
  markRead(
    @Param('id') id: string,
    @Req() req: { user?: { sub?: number; orgId?: number } },
  ) {
    return this.notificationsService.markRead(Number(id), req.user);
  }
}
