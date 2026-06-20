import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { AuthUser } from '../common/types/auth-user.type';
import { PrismaService } from '../prisma/prisma.service';

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
  constructor(private readonly prisma: PrismaService) {}

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
}
