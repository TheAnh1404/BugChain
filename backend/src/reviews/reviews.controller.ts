import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { AuthUser } from '../common/types/auth-user.type';
import { AssignReviewerDto } from './dto/assign-reviewer.dto';
import { ReviewReportDto } from './dto/review-report.dto';
import { ReviewsService } from './reviews.service';

@Controller('reports')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Post(':id/reviewers')
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  async assignReviewer(
    @Param('id') reportId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: AssignReviewerDto,
  ) {
    return {
      data: await this.reviewsService.assignReviewer(reportId, user, dto),
    };
  }

  @Post(':id/approve')
  @Roles(UserRole.OWNER, UserRole.REVIEWER, UserRole.ADMIN)
  async approve(
    @Param('id') reportId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: ReviewReportDto,
  ) {
    return {
      data: await this.reviewsService.approve(
        reportId,
        user,
        dto.comment,
        dto.txHash,
        dto.transactionId,
      ),
    };
  }

  @Post(':id/reject')
  @Roles(UserRole.OWNER, UserRole.REVIEWER, UserRole.ADMIN)
  async reject(
    @Param('id') reportId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: ReviewReportDto,
  ) {
    return {
      data: await this.reviewsService.reject(
        reportId,
        user,
        dto.comment,
        dto.txHash,
        dto.transactionId,
      ),
    };
  }
}
