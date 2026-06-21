import {
  Body,
  Controller,
  Delete,
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
import { BountiesService } from './bounties.service';
import { CreateBountyDto } from './dto/create-bounty.dto';
import { QueryBountyDto } from './dto/query-bounty.dto';
import { UpdateBountyDto } from './dto/update-bounty.dto';
import { UpdateBountyOnChainDto, RefundBountyDto } from './dto/update-bounty-onchain.dto';

@Controller('bounties')
export class BountiesController {
  constructor(private readonly bountiesService: BountiesService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.HUNTER, UserRole.OWNER, UserRole.ADMIN)
  async create(@CurrentUser() user: AuthUser, @Body() dto: CreateBountyDto) {
    return { data: await this.bountiesService.create(user.id, dto, user) };
  }

  @Get()
  async findAll(@Query() query: QueryBountyDto) {
    return { data: await this.bountiesService.findAll(query) };
  }

  @Get('reward-suggestions')
  async rewardSuggestions() {
    return { data: this.bountiesService.rewardSuggestions() };
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return { data: await this.bountiesService.findOne(id) };
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  async update(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateBountyDto,
  ) {
    return { data: await this.bountiesService.update(id, user, dto) };
  }

  @Patch(':id/onchain')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.HUNTER, UserRole.OWNER, UserRole.ADMIN)
  async updateOnChain(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateBountyOnChainDto,
  ) {
    return { data: await this.bountiesService.updateOnChain(id, user, dto) };
  }

  @Patch(':id/refund')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  async refund(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: RefundBountyDto,
  ) {
    return { data: await this.bountiesService.refundBounty(id, user, dto) };
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  async remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return { data: await this.bountiesService.remove(id, user) };
  }
}
