import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { BountyStatus, ReportStatus, TransactionStatus, TransactionType, UserRole } from '@prisma/client';
import { AuthUser } from '../common/types/auth-user.type';
import { EventsService } from '../events/events.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { FailTransactionDto } from './dto/fail-transaction.dto';

const transactionInclude = {
  bounty: {
    select: {
      id: true,
      title: true,
      status: true,
    },
  },
  report: {
    select: {
      id: true,
      title: true,
      status: true,
    },
  },
} as const;

@Injectable()
export class TransactionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventsService: EventsService,
  ) {}

  async createPending(user: AuthUser, dto: CreateTransactionDto) {
    await this.assertTransactionScope(user, dto);

    const transaction = await this.prisma.transaction.create({
      data: {
        userId: user.id,
        bountyId: dto.bountyId ?? null,
        reportId: dto.reportId ?? null,
        type: dto.type,
        status: TransactionStatus.PENDING,
      },
      include: transactionInclude,
    });

    this.emitTransactionUpdated(transaction);

    return transaction;
  }

  async markFailed(transactionId: string, user: AuthUser, dto: FailTransactionDto) {
    const transaction = await this.prisma.transaction.findUnique({
      where: { id: transactionId },
    });

    if (!transaction) {
      throw new NotFoundException('Transaction not found');
    }

    if (transaction.userId !== user.id && user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('You can only update your own transaction records');
    }

    if (transaction.status === TransactionStatus.SUCCESS) {
      throw new BadRequestException('Successful transactions cannot be marked failed');
    }

    const updated = await this.prisma.transaction.update({
      where: { id: transaction.id },
      data: {
        status: TransactionStatus.FAILED,
        txHash: dto.txHash?.toLowerCase(),
      },
      include: transactionInclude,
    });

    this.emitTransactionUpdated(updated);

    return updated;
  }

  async listMine(userId: string, page = 1, limit = 20) {
    const pagination = this.getPagination(page, limit);
    const where = { userId };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.transaction.findMany({
        where,
        include: transactionInclude,
        orderBy: { createdAt: 'desc' },
        skip: pagination.skip,
        take: pagination.limit,
      }),
      this.prisma.transaction.count({ where }),
    ]);

    return {
      items,
      meta: this.buildMeta(total, pagination.page, pagination.limit),
    };
  }

  async listForBounty(
    bountyId: string,
    user: AuthUser,
    page = 1,
    limit = 20,
  ) {
    const bounty = await this.prisma.bounty.findUnique({
      where: { id: bountyId },
      select: { id: true, ownerId: true },
    });

    if (!bounty) {
      throw new NotFoundException('Bounty not found');
    }




    const pagination = this.getPagination(page, limit);
    const where = { bountyId };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.transaction.findMany({
        where,
        include: transactionInclude,
        orderBy: { createdAt: 'desc' },
        skip: pagination.skip,
        take: pagination.limit,
      }),
      this.prisma.transaction.count({ where }),
    ]);

    return {
      items,
      meta: this.buildMeta(total, pagination.page, pagination.limit),
    };
  }

  private async assertTransactionScope(user: AuthUser, dto: CreateTransactionDto) {
    if (dto.type === TransactionType.CREATE_BOUNTY || dto.type === TransactionType.REFUND) {
      if (!dto.bountyId) {
        throw new BadRequestException('bountyId is required for bounty transactions');
      }

      const bounty = await this.prisma.bounty.findUnique({
        where: { id: dto.bountyId },
        select: { ownerId: true, status: true },
      });

      if (!bounty) {
        throw new NotFoundException('Bounty not found');
      }

      if (bounty.ownerId !== user.id && user.role !== UserRole.ADMIN) {
        throw new ForbiddenException('Only the bounty owner can create this transaction');
      }

      if (dto.type === TransactionType.REFUND && bounty.status !== BountyStatus.OPEN) {
        throw new BadRequestException('Only open bounties can be refunded');
      }

      return;
    }

    if (
      dto.type === TransactionType.SUBMIT_REPORT ||
      dto.type === TransactionType.APPROVE_REPORT ||
      dto.type === TransactionType.REJECT_REPORT ||
      dto.type === TransactionType.CLAIM_REWARD
    ) {
      if (!dto.reportId) {
        throw new BadRequestException('reportId is required for report transactions');
      }

      const report = await this.prisma.report.findUnique({
        where: { id: dto.reportId },
        select: {
          hunterId: true,
          bountyId: true,
          status: true,
          bounty: { select: { ownerId: true } },
        },
      });

      if (!report) {
        throw new NotFoundException('Report not found');
      }

      if (dto.bountyId && dto.bountyId !== report.bountyId) {
        throw new BadRequestException('bountyId does not match report bounty');
      }

      if (dto.type === TransactionType.SUBMIT_REPORT && report.hunterId !== user.id) {
        throw new ForbiddenException('Only the report hunter can create this transaction');
      }

      if (
        (dto.type === TransactionType.APPROVE_REPORT || dto.type === TransactionType.REJECT_REPORT) &&
        report.bounty.ownerId !== user.id &&
        user.role !== UserRole.ADMIN
      ) {
        throw new ForbiddenException('Only the bounty owner can create this transaction');
      }

      if (dto.type === TransactionType.CLAIM_REWARD && report.hunterId !== user.id) {
        throw new ForbiddenException('Only the report hunter can create this transaction');
      }

      if (
        dto.type === TransactionType.CLAIM_REWARD &&
        report.status !== ReportStatus.APPROVED
      ) {
        throw new BadRequestException('Only approved reports can be claimed');
      }

      return;
    }

    throw new BadRequestException('Unsupported transaction type for lifecycle tracking');
  }

  private getPagination(page: number, limit: number) {
    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = Math.min(100, Math.max(1, Number(limit) || 20));

    return {
      page: safePage,
      limit: safeLimit,
      skip: (safePage - 1) * safeLimit,
    };
  }

  private buildMeta(total: number, page: number, limit: number) {
    return {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    };
  }

  private emitTransactionUpdated(transaction: {
    id: string;
    bountyId: string | null;
    reportId: string | null;
    txHash: string | null;
    type: TransactionType;
    status: TransactionStatus;
  }) {
    this.eventsService.emit('transaction_updated', {
      transactionId: transaction.id,
      bountyId: transaction.bountyId || undefined,
      reportId: transaction.reportId || undefined,
      txHash: transaction.txHash || undefined,
      transactionType: transaction.type,
      transactionStatus: transaction.status,
    });
  }
}
