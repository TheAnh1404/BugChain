import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { AuthUser } from '../common/types/auth-user.type';
import { CreateFeedbackDto } from './dto/create-feedback.dto';
import { FeedbackService } from './feedback.service';

@Controller('feedback')
@UseGuards(JwtAuthGuard, RolesGuard)
export class FeedbackController {
  constructor(private readonly feedbackService: FeedbackService) {}

  @Post()
  @Roles(UserRole.HUNTER, UserRole.OWNER, UserRole.REVIEWER, UserRole.ADMIN)
  async create(@CurrentUser() user: AuthUser, @Body() dto: CreateFeedbackDto) {
    return { data: await this.feedbackService.create(user.id, dto) };
  }

  @Get('me')
  @Roles(UserRole.HUNTER, UserRole.OWNER, UserRole.REVIEWER, UserRole.ADMIN)
  async mine(@CurrentUser() user: AuthUser) {
    return { data: await this.feedbackService.mine(user.id) };
  }

  @Get('summary')
  @Roles(UserRole.OWNER, UserRole.REVIEWER, UserRole.ADMIN)
  async summary() {
    return { data: await this.feedbackService.summary() };
  }
}
