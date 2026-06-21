import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { AuthUser } from '../common/types/auth-user.type';
import { ReputationService } from './reputation.service';

@Controller('reputation')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.HUNTER, UserRole.OWNER, UserRole.REVIEWER, UserRole.ADMIN)
export class ReputationController {
  constructor(private readonly reputationService: ReputationService) {}

  @Get('me')
  async me(@CurrentUser() user: AuthUser) {
    return { data: await this.reputationService.getProfile(user.id) };
  }

  @Get('leaderboard')
  async leaderboard(@Query('limit') limit?: number) {
    return { data: await this.reputationService.leaderboard(limit) };
  }

  @Get('users/:id')
  async userProfile(@Param('id') userId: string) {
    return { data: await this.reputationService.getProfile(userId) };
  }
}
