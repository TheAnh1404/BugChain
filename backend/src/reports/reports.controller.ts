import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AuthUser } from '../common/types/auth-user.type';
import { CreateReportDto } from './dto/create-report.dto';
import { UpdateReportDto } from './dto/update-report.dto';
import { UpdateReportOnChainDto, ClaimRewardDto } from './dto/update-report-onchain.dto';
import { ReportsService } from './reports.service';

@Controller()
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Post('bounties/:bountyId/reports')
  @UseGuards(JwtAuthGuard)
  async create(
    @Param('bountyId') bountyId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateReportDto,
  ) {
    return { data: await this.reportsService.create(bountyId, user, dto) };
  }

  @Get('bounties/:bountyId/reports')
  @UseGuards(JwtAuthGuard)
  async listForBounty(
    @Param('bountyId') bountyId: string,
    @CurrentUser() user: AuthUser,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return {
      data: await this.reportsService.listForBounty(
        bountyId,
        user,
        page,
        limit,
      ),
    };
  }

  @Get('reports/me')
  @UseGuards(JwtAuthGuard)
  async listMine(
    @CurrentUser() user: AuthUser,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return {
      data: await this.reportsService.listMine(user, page, limit),
    };
  }

  @Get('reports/:id')
  @UseGuards(JwtAuthGuard)
  async findOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return { data: await this.reportsService.findOne(id, user) };
  }

  @Patch('reports/:id')
  @UseGuards(JwtAuthGuard)
  async update(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateReportDto,
  ) {
    return { data: await this.reportsService.update(id, user, dto) };
  }

  @Patch('reports/:id/onchain')
  @UseGuards(JwtAuthGuard)
  async updateOnChain(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateReportOnChainDto,
  ) {
    return { data: await this.reportsService.updateOnChain(id, user, dto) };
  }

  @Patch('reports/:id/claim')
  @UseGuards(JwtAuthGuard)
  async claimReward(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: ClaimRewardDto,
  ) {
    return { data: await this.reportsService.claimReward(id, user, dto) };
  }
}
