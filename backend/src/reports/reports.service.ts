import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  BountyStatus,
  Prisma,
  ReportStatus,
  TransactionStatus,
  TransactionType,
  UserRole,
} from '@prisma/client';
import { AuthUser } from '../common/types/auth-user.type';
import { PrismaService } from '../prisma/prisma.service';
import { CreateReportDto } from './dto/create-report.dto';
import { UpdateReportDto } from './dto/update-report.dto';
import { UpdateReportOnChainDto, ClaimRewardDto } from './dto/update-report-onchain.dto';

const reportInclude = {
  bounty: {
    select: {
      id: true,
      title: true,
      ownerId: true,
      status: true,
      onchainBountyId: true,
    },
  },
  hunter: {
    select: {
      id: true,
      username: true,
      avatarUrl: true,
    },
  },
} satisfies Prisma.ReportInclude;

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(bountyId: string, hunter: AuthUser, dto: CreateReportDto) {
    const bounty = await this.prisma.bounty.findUnique({
      where: { id: bountyId },
      select: { id: true, ownerId: true, status: true },
    });

    if (!bounty) {
      throw new NotFoundException('Bounty not found');
    }

    if (bounty.ownerId === hunter.id) {
      throw new ForbiddenException('Hunters cannot submit reports to their own bounty');
    }

    if (bounty.status !== BountyStatus.OPEN) {
      throw new BadRequestException('Reports can only be submitted to open bounties');
    }

    const report = await this.prisma.$transaction(async (tx) => {
      const created = await tx.report.create({
        data: {
          bountyId,
          hunterId: hunter.id,
          onchainReportId: dto.onchainReportId,
          title: dto.title.trim(),
          severity: dto.severity,
          description: dto.description.trim(),
          stepsToReproduce: dto.stepsToReproduce.trim(),
          impact: dto.impact.trim(),
          recommendation: dto.recommendation.trim(),
          reportHash: dto.reportHash,
          status: ReportStatus.DRAFT,
        },
        include: reportInclude,
      });

      return created;
    });

    return report;
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
    const isOwnerOrAdmin = bounty.ownerId === user.id || user.role === UserRole.ADMIN;
    
    const where = isOwnerOrAdmin
      ? { bountyId }
      : { bountyId, hunterId: user.id };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.report.findMany({
        where,
        include: reportInclude,
        orderBy: { createdAt: 'desc' },
        skip: pagination.skip,
        take: pagination.limit,
      }),
      this.prisma.report.count({ where }),
    ]);

    return {
      items,
      meta: this.buildMeta(total, pagination.page, pagination.limit),
    };
  }

  async listMine(user: AuthUser, page = 1, limit = 20) {
    const pagination = this.getPagination(page, limit);
    const where = { hunterId: user.id };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.report.findMany({
        where,
        include: reportInclude,
        orderBy: { createdAt: 'desc' },
        skip: pagination.skip,
        take: pagination.limit,
      }),
      this.prisma.report.count({ where }),
    ]);

    return {
      items,
      meta: this.buildMeta(total, pagination.page, pagination.limit),
    };
  }

  async findOne(id: string, user: AuthUser) {
    const report = await this.prisma.report.findUnique({
      where: { id },
      include: reportInclude,
    });

    if (!report) {
      throw new NotFoundException('Report not found');
    }

    const canView =
      report.hunterId === user.id ||
      report.bounty.ownerId === user.id ||
      user.role === UserRole.ADMIN;

    if (!canView) {
      throw new ForbiddenException('You cannot view this report');
    }

    return report;
  }

  async update(id: string, user: AuthUser, dto: UpdateReportDto) {
    const report = await this.prisma.report.findUnique({
      where: { id },
      include: reportInclude,
    });

    if (!report) {
      throw new NotFoundException('Report not found');
    }

    if (report.hunterId !== user.id) {
      throw new ForbiddenException('Only the report hunter can update this report');
    }

    if (report.status !== ReportStatus.DRAFT && report.status !== ReportStatus.PENDING) {
      throw new BadRequestException('Only draft or pending reports can be updated');
    }

    const updated = await this.prisma.report.update({
      where: { id },
      data: this.buildUpdateData(dto),
      include: reportInclude,
    });

    return updated;
  }

  async updateOnChain(id: string, user: AuthUser, dto: UpdateReportOnChainDto) {
    const report = await this.prisma.report.findUnique({
      where: { id },
      include: reportInclude,
    });

    if (!report) {
      throw new NotFoundException('Report not found');
    }

    if (report.hunterId !== user.id) {
      throw new ForbiddenException('Only the report hunter can update this report');
    }

    const txHash = dto.txHash.toLowerCase();
    const stellarExplorerUrl = dto.stellarExplorerUrl || `https://stellar.expert/explorer/testnet/tx/${txHash}`;

    const updated = await this.prisma.$transaction(async (tx) => {
      const updatedReport = await tx.report.update({
        where: { id },
        data: {
          txHash,
          onchainReportId: dto.onchainReportId,
          reportHash: dto.reportHash,
          stellarExplorerUrl,
          status: ReportStatus.PENDING,
        },
        include: reportInclude,
      });

      const existingTransaction = await tx.transaction.findFirst({
        where: {
          reportId: report.id,
          type: TransactionType.SUBMIT_REPORT,
        },
        select: { id: true },
      });

      if (existingTransaction) {
        await tx.transaction.update({
          where: { id: existingTransaction.id },
          data: {
            txHash,
            status: TransactionStatus.SUCCESS,
          },
        });
      } else {
        await tx.transaction.create({
          data: {
            userId: user.id,
            bountyId: report.bountyId,
            reportId: report.id,
            txHash,
            type: TransactionType.SUBMIT_REPORT,
            status: TransactionStatus.SUCCESS,
          },
        });
      }

      return updatedReport;
    });

    return updated;
  }

  async claimReward(id: string, user: AuthUser, dto: ClaimRewardDto) {
    const report = await this.prisma.report.findUnique({
      where: { id },
      include: { bounty: true },
    });

    if (!report) {
      throw new NotFoundException('Report not found');
    }

    if (report.hunterId !== user.id) {
      throw new ForbiddenException('Only the hunter who submitted this report can claim the reward');
    }

    if (report.status !== ReportStatus.APPROVED) {
      throw new BadRequestException('Reward can only be claimed for approved reports');
    }

    const txHash = dto.txHash.toLowerCase();

    const updated = await this.prisma.$transaction(async (tx) => {
      const updatedReport = await tx.report.update({
        where: { id },
        data: {
          status: ReportStatus.PAID,
          claimTxHash: txHash,
        },
        include: reportInclude,
      });

      await tx.transaction.create({
        data: {
          userId: user.id,
          bountyId: report.bountyId,
          reportId: report.id,
          txHash,
          type: TransactionType.CLAIM_REWARD,
          status: TransactionStatus.SUCCESS,
        },
      });

      return updatedReport;
    });

    return updated;
  }

  private buildUpdateData(dto: UpdateReportDto): Prisma.ReportUpdateInput {
    const data: Prisma.ReportUpdateInput = {};

    if (dto.onchainReportId !== undefined) data.onchainReportId = dto.onchainReportId;
    if (dto.title !== undefined) data.title = dto.title.trim();
    if (dto.severity !== undefined) data.severity = dto.severity;
    if (dto.description !== undefined) data.description = dto.description.trim();
    if (dto.stepsToReproduce !== undefined) data.stepsToReproduce = dto.stepsToReproduce.trim();
    if (dto.impact !== undefined) data.impact = dto.impact.trim();
    if (dto.recommendation !== undefined) data.recommendation = dto.recommendation.trim();
    if (dto.reportHash !== undefined) data.reportHash = dto.reportHash;

    return data;
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
