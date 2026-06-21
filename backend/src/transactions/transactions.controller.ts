import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AuthUser } from '../common/types/auth-user.type';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { FailTransactionDto } from './dto/fail-transaction.dto';
import { TransactionsService } from './transactions.service';

@Controller('transactions')
@UseGuards(JwtAuthGuard)
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Post()
  async createPending(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateTransactionDto,
  ) {
    return {
      data: await this.transactionsService.createPending(user, dto),
    };
  }

  @Patch(':id/fail')
  async markFailed(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: FailTransactionDto,
  ) {
    return {
      data: await this.transactionsService.markFailed(id, user, dto),
    };
  }

  @Get('me')
  async mine(
    @CurrentUser() user: AuthUser,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return {
      data: await this.transactionsService.listMine(user.id, page, limit),
    };
  }

  @Get('bounty/:bountyId')
  async bountyTransactions(
    @Param('bountyId') bountyId: string,
    @CurrentUser() user: AuthUser,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return {
      data: await this.transactionsService.listForBounty(
        bountyId,
        user,
        page,
        limit,
      ),
    };
  }
}
