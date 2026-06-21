import { Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { AuthUser } from '../common/types/auth-user.type';
import { NotificationsService } from './notifications.service';
import { UserRole } from '@prisma/client';

@Controller('notifications')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.HUNTER, UserRole.OWNER, UserRole.REVIEWER, UserRole.ADMIN)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  async mine(@CurrentUser() user: AuthUser, @Query('limit') limit?: number) {
    return { data: await this.notificationsService.listMine(user.id, limit) };
  }

  @Get('unread-count')
  async unreadCount(@CurrentUser() user: AuthUser) {
    return { data: await this.notificationsService.unreadCount(user.id) };
  }

  @Patch(':id/read')
  async markRead(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return { data: await this.notificationsService.markRead(id, user.id) };
  }

  @Patch('read-all')
  async markAllRead(@CurrentUser() user: AuthUser) {
    return { data: await this.notificationsService.markAllRead(user.id) };
  }
}
