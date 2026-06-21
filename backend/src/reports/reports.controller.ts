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
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { AuthUser } from '../common/types/auth-user.type';
import { CreateReportDto } from './dto/create-report.dto';
import { UpdateReportDto } from './dto/update-report.dto';
import { UpdateReportOnChainDto, ClaimRewardDto } from './dto/update-report-onchain.dto';
import { ReportsService } from './reports.service';

@Controller()
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Post('bounties/:bountyId/reports')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.HUNTER, UserRole.ADMIN)
  async create(
    @Param('bountyId') bountyId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateReportDto,
  ) {
    return { data: await this.reportsService.create(bountyId, user, dto) };
  }

  @Get('bounties/:bountyId/reports')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.HUNTER, UserRole.OWNER, UserRole.REVIEWER, UserRole.ADMIN)
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
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.HUNTER, UserRole.OWNER, UserRole.REVIEWER, UserRole.ADMIN)
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
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.HUNTER, UserRole.OWNER, UserRole.REVIEWER, UserRole.ADMIN)
  async findOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return { data: await this.reportsService.findOne(id, user) };
  }

  @Patch('reports/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.HUNTER, UserRole.ADMIN)
  async update(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateReportDto,
  ) {
    return { data: await this.reportsService.update(id, user, dto) };
  }

  @Patch('reports/:id/onchain')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.HUNTER, UserRole.ADMIN)
  async updateOnChain(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateReportOnChainDto,
  ) {
    return { data: await this.reportsService.updateOnChain(id, user, dto) };
  }

  @Patch('reports/:id/claim')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.HUNTER, UserRole.ADMIN)
  async claimReward(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: ClaimRewardDto,
  ) {
    return { data: await this.reportsService.claimReward(id, user, dto) };
  }
}
