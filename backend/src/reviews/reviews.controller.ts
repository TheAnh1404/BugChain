import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AuthUser } from '../common/types/auth-user.type';
import { ReviewReportDto } from './dto/review-report.dto';
import { ReviewsService } from './reviews.service';

@Controller('reports')
@UseGuards(JwtAuthGuard)
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Post(':id/approve')
  async approve(
    @Param('id') reportId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: ReviewReportDto,
  ) {
    return {
      data: await this.reviewsService.approve(reportId, user, dto.comment, dto.txHash),
    };
  }

  @Post(':id/reject')
  async reject(
    @Param('id') reportId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: ReviewReportDto,
  ) {
    return {
      data: await this.reviewsService.reject(reportId, user, dto.comment, dto.txHash),
    };
  }
}
