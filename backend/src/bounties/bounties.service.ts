import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  BountyStatus,
  Prisma,
  TransactionStatus,
  TransactionType,
} from '@prisma/client';
import { AuthUser } from '../common/types/auth-user.type';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBountyDto } from './dto/create-bounty.dto';
import { QueryBountyDto } from './dto/query-bounty.dto';
import { UpdateBountyDto } from './dto/update-bounty.dto';
import { UpdateBountyOnChainDto, RefundBountyDto } from './dto/update-bounty-onchain.dto';

const ownerSelect = {
  id: true,
  username: true,
  avatarUrl: true,
} as const;

const bountyInclude = {
  owner: { select: ownerSelect },
  _count: { select: { reports: true } },
} satisfies Prisma.BountyInclude;

type BountyWithRelations = Prisma.BountyGetPayload<{
  include: typeof bountyInclude;
}>;

@Injectable()
export class BountiesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(ownerId: string, dto: CreateBountyDto) {
    this.ensureFutureDeadline(dto.deadline);

    const bounty = await this.prisma.$transaction(async (tx) => {
      const created = await tx.bounty.create({
        data: {
          ownerId,
          onchainBountyId: dto.onchainBountyId,
          title: dto.title.trim(),
          description: dto.description.trim(),
          scope: dto.scope.trim(),
          severity: dto.severity,
          rewardAmount: dto.rewardAmount,
          rewardAsset: dto.rewardAsset ?? 'XLM',
          deadline: new Date(dto.deadline),
          status: dto.status ?? BountyStatus.OPEN,
          metadataHash: dto.metadataHash,
        },
        include: bountyInclude,
      });

      return created;
    });

    return this.serializeBounty(bounty);
  }

  async findAll(query: QueryBountyDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;
    const where: Prisma.BountyWhereInput = {};

    if (query.severity) {
      where.severity = query.severity;
    }
    if (query.status) {
      where.status = query.status;
    }
    if (query.ownerId) {
      where.ownerId = query.ownerId;
    }
    if (query.search) {
      const search = query.search.trim();
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { scope: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await this.prisma.$transaction([
      this.prisma.bounty.findMany({
        where,
        include: bountyInclude,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.bounty.count({ where }),
    ]);

    return {
      items: items.map((bounty) => this.serializeBounty(bounty)),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string) {
    const bounty = await this.prisma.bounty.findUnique({
      where: { id },
      include: bountyInclude,
    });

    if (!bounty) {
      throw new NotFoundException('Bounty not found');
    }

    return this.serializeBounty(bounty);
  }

  async update(id: string, user: AuthUser, dto: UpdateBountyDto) {
    const bounty = await this.getBountyForOwner(id, user.id);
    const data = this.buildUpdateData(dto);

    if (dto.deadline) {
      this.ensureFutureDeadline(dto.deadline);
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const updatedBounty = await tx.bounty.update({
        where: { id: bounty.id },
        data,
        include: bountyInclude,
      });

      if (dto.txHash) {
        const existingTransaction = await tx.transaction.findFirst({
          where: {
            bountyId: bounty.id,
            type: TransactionType.CREATE_BOUNTY,
          },
          select: { id: true },
        });

        if (existingTransaction) {
          await tx.transaction.update({
            where: { id: existingTransaction.id },
            data: {
              txHash: dto.txHash.toLowerCase(),
              status: TransactionStatus.SUCCESS,
            },
          });
        } else {
          await tx.transaction.create({
            data: {
              userId: user.id,
              bountyId: bounty.id,
              txHash: dto.txHash.toLowerCase(),
              type: TransactionType.CREATE_BOUNTY,
              status: TransactionStatus.SUCCESS,
            },
          });
        }
      }

      return updatedBounty;
    });

    return this.serializeBounty(updated);
  }

  async updateOnChain(id: string, user: AuthUser, dto: UpdateBountyOnChainDto) {
    const bounty = await this.getBountyForOwner(id, user.id);

    const updated = await this.prisma.$transaction(async (tx) => {
      const updatedBounty = await tx.bounty.update({
        where: { id: bounty.id },
        data: {
          onchainBountyId: dto.onchainBountyId,
          txHash: dto.txHash.toLowerCase(),
          stellarExplorerUrl: this.buildStellarExplorerUrl(dto.txHash.toLowerCase()),
          metadataHash: dto.metadataHash,
          status: BountyStatus.OPEN,
        },
        include: bountyInclude,
      });

      await this.completeTransaction(tx, {
        transactionId: dto.transactionId,
        userId: user.id,
        bountyId: bounty.id,
        txHash: dto.txHash,
        type: TransactionType.CREATE_BOUNTY,
      });

      return updatedBounty;
    });

    return this.serializeBounty(updated);
  }

  async refundBounty(id: string, user: AuthUser, dto: RefundBountyDto) {
    const bounty = await this.getBountyForOwner(id, user.id);

    if (bounty.status !== BountyStatus.OPEN) {
      throw new BadRequestException('Bounty must be in OPEN status to be refunded');
    }

    if (new Date(bounty.deadline).getTime() > Date.now()) {
      throw new BadRequestException('Bounty deadline has not passed yet');
    }

    const txHash = dto.txHash.toLowerCase();

    const updated = await this.prisma.$transaction(async (tx) => {
      const updatedBounty = await tx.bounty.update({
        where: { id: bounty.id },
        data: {
          status: BountyStatus.REFUNDED,
          refundTxHash: txHash,
        },
        include: bountyInclude,
      });

      await this.completeTransaction(tx, {
        transactionId: dto.transactionId,
        userId: user.id,
        bountyId: bounty.id,
        txHash,
        type: TransactionType.REFUND,
      });

      return updatedBounty;
    });

    return this.serializeBounty(updated);
  }

  async remove(id: string, user: AuthUser) {
    const bounty = await this.getBountyForOwner(id, user.id);
    const reportsCount = await this.prisma.report.count({
      where: { bountyId: bounty.id },
    });

    if (reportsCount > 0) {
      throw new BadRequestException('Cannot delete a bounty that has reports');
    }

    await this.prisma.bounty.delete({ where: { id: bounty.id } });
    return { deleted: true };
  }

  private async getBountyForOwner(id: string, userId: string) {
    const bounty = await this.prisma.bounty.findUnique({ where: { id } });

    if (!bounty) {
      throw new NotFoundException('Bounty not found');
    }

    if (bounty.ownerId !== userId) {
      throw new ForbiddenException('Only the bounty owner can modify this bounty');
    }

    return bounty;
  }

  private buildUpdateData(dto: UpdateBountyDto): Prisma.BountyUpdateInput {
    const data: Prisma.BountyUpdateInput = {};

    if (dto.onchainBountyId !== undefined) data.onchainBountyId = dto.onchainBountyId;
    if (dto.title !== undefined) data.title = dto.title.trim();
    if (dto.description !== undefined) data.description = dto.description.trim();
    if (dto.scope !== undefined) data.scope = dto.scope.trim();
    if (dto.severity !== undefined) data.severity = dto.severity;
    if (dto.rewardAmount !== undefined) data.rewardAmount = dto.rewardAmount;
    if (dto.rewardAsset !== undefined) data.rewardAsset = dto.rewardAsset;
    if (dto.deadline !== undefined) data.deadline = new Date(dto.deadline);
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.metadataHash !== undefined) data.metadataHash = dto.metadataHash;
    if (dto.txHash !== undefined) {
      const txHash = dto.txHash.toLowerCase();
      data.txHash = txHash;
      data.stellarExplorerUrl = this.buildStellarExplorerUrl(txHash);
    }

    return data;
  }

  private buildStellarExplorerUrl(txHash: string) {
    return `https://stellar.expert/explorer/testnet/tx/${txHash}`;
  }

  private ensureFutureDeadline(deadline: string) {
    if (new Date(deadline).getTime() <= Date.now()) {
      throw new BadRequestException('Bounty deadline must be in the future');
    }
  }

  private async completeTransaction(
    tx: Prisma.TransactionClient,
    data: {
      transactionId?: string;
      userId: string;
      bountyId: string;
      txHash: string;
      type: TransactionType;
    },
  ) {
    const txHash = data.txHash.toLowerCase();
    const existing = data.transactionId
      ? await tx.transaction.findFirst({
          where: {
            id: data.transactionId,
            userId: data.userId,
            bountyId: data.bountyId,
            type: data.type,
          },
          select: { id: true },
        })
      : await tx.transaction.findFirst({
          where: {
            userId: data.userId,
            bountyId: data.bountyId,
            type: data.type,
            status: TransactionStatus.PENDING,
          },
          select: { id: true },
        });

    if (existing) {
      await tx.transaction.update({
        where: { id: existing.id },
        data: {
          txHash,
          status: TransactionStatus.SUCCESS,
        },
      });
      return;
    }

    await tx.transaction.create({
      data: {
        userId: data.userId,
        bountyId: data.bountyId,
        txHash,
        type: data.type,
        status: TransactionStatus.SUCCESS,
      },
    });
  }

  private serializeBounty(bounty: BountyWithRelations) {
    return {
      ...bounty,
      rewardAmount: bounty.rewardAmount.toString(),
    };
  }
}
