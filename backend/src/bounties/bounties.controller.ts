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
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
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
  @UseGuards(JwtAuthGuard)
  async create(@CurrentUser() user: AuthUser, @Body() dto: CreateBountyDto) {
    return { data: await this.bountiesService.create(user.id, dto) };
  }

  @Get()
  async findAll(@Query() query: QueryBountyDto) {
    return { data: await this.bountiesService.findAll(query) };
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return { data: await this.bountiesService.findOne(id) };
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  async update(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateBountyDto,
  ) {
    return { data: await this.bountiesService.update(id, user, dto) };
  }

  @Patch(':id/onchain')
  @UseGuards(JwtAuthGuard)
  async updateOnChain(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateBountyOnChainDto,
  ) {
    return { data: await this.bountiesService.updateOnChain(id, user, dto) };
  }

  @Patch(':id/refund')
  @UseGuards(JwtAuthGuard)
  async refund(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: RefundBountyDto,
  ) {
    return { data: await this.bountiesService.refundBounty(id, user, dto) };
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  async remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return { data: await this.bountiesService.remove(id, user) };
  }
}
