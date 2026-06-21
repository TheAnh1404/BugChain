import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AuditAction,
  BountyStatus,
  EntityType,
  NotificationType,
  Prisma,
  ReportStatus,
  TransactionStatus,
  TransactionType,
  UserRole,
} from '@prisma/client';
import { AuditLogsService } from '../audit/audit-logs.service';
import { AuthUser } from '../common/types/auth-user.type';
import { EventsService } from '../events/events.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { ReputationService } from '../reputation/reputation.service';
import { ReportEncryptionService } from '../security/report-encryption.service';
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
      rewardAmount: true,
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
  private readonly encryptedPlaceholder = '[encrypted]';

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogsService: AuditLogsService,
    private readonly eventsService: EventsService,
    private readonly notificationsService: NotificationsService,
    private readonly reputationService: ReputationService,
    private readonly reportEncryptionService: ReportEncryptionService,
  ) {}

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

    const encrypted = this.reportEncryptionService.encrypt({
      description: dto.description.trim(),
      stepsToReproduce: dto.stepsToReproduce.trim(),
      impact: dto.impact.trim(),
      recommendation: dto.recommendation.trim(),
    });

    const report = await this.prisma.$transaction(async (tx) => {
      const created = await tx.report.create({
        data: {
          bountyId,
          hunterId: hunter.id,
          onchainReportId: dto.onchainReportId,
          title: dto.title.trim(),
          severity: dto.severity,
          description: this.encryptedPlaceholder,
          stepsToReproduce: this.encryptedPlaceholder,
          impact: this.encryptedPlaceholder,
          recommendation: this.encryptedPlaceholder,
          encryptedContent: encrypted.encryptedContent,
          iv: encrypted.iv,
          authTag: encrypted.authTag,
          reportHash: dto.reportHash,
          status: ReportStatus.DRAFT,
        },
        include: reportInclude,
      });

      return created;
    });

    await this.reputationService.recordFirstReport(hunter.id);

    return this.serializeReport(report);
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
      items: items.map((report) => this.serializeReport(report)),
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
      items: items.map((report) => this.serializeReport(report)),
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

    return this.serializeReport(report);
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
      data: this.buildUpdateData(dto, report),
      include: reportInclude,
    });

    return this.serializeReport(updated);
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

      await this.completeTransaction(tx, {
        transactionId: dto.transactionId,
        userId: user.id,
        bountyId: report.bountyId,
        reportId: report.id,
        txHash,
        type: TransactionType.SUBMIT_REPORT,
      });

      await this.auditLogsService.recordWithClient(tx, {
        userId: user.id,
        action: AuditAction.SUBMIT_REPORT,
        entityType: EntityType.REPORT,
        entityId: report.id,
        txHash,
      });

      await this.notificationsService.createWithClient(tx, {
        userId: report.bounty.ownerId,
        type: NotificationType.NEW_REPORT,
        title: 'New report submitted',
        message: `${user.username} submitted ${report.title} for ${report.bounty.title}.`,
      });

      return updatedReport;
    });

    this.eventsService.emit('report_submitted', {
      bountyId: report.bountyId,
      reportId: report.id,
      txHash,
      onchainBountyId: report.bounty.onchainBountyId || undefined,
      onchainReportId: dto.onchainReportId,
      transactionType: TransactionType.SUBMIT_REPORT,
    });

    return this.serializeReport(updated);
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

      await this.completeTransaction(tx, {
        transactionId: dto.transactionId,
        userId: user.id,
        bountyId: report.bountyId,
        reportId: report.id,
        txHash,
        type: TransactionType.CLAIM_REWARD,
      });

      await this.auditLogsService.recordWithClient(tx, {
        userId: user.id,
        action: AuditAction.CLAIM_REWARD,
        entityType: EntityType.REPORT,
        entityId: report.id,
        txHash,
      });

      await this.notificationsService.createWithClient(tx, {
        userId: report.hunterId,
        type: NotificationType.REWARD_CLAIMED,
        title: 'Reward claimed',
        message: `Reward for ${report.title} was claimed on Stellar Testnet.`,
      });

      return updatedReport;
    });

    await this.reputationService.recordRewardClaimed(user.id, report.bounty.rewardAmount);

    this.eventsService.emit('reward_claimed', {
      bountyId: report.bountyId,
      reportId: report.id,
      txHash,
      onchainBountyId: report.bounty.onchainBountyId || undefined,
      onchainReportId: report.onchainReportId || undefined,
      transactionType: TransactionType.CLAIM_REWARD,
    });

    return this.serializeReport(updated);
  }

  private buildUpdateData(
    dto: UpdateReportDto,
    report: Prisma.ReportGetPayload<{ include: typeof reportInclude }>,
  ): Prisma.ReportUpdateInput {
    const data: Prisma.ReportUpdateInput = {};

    if (dto.onchainReportId !== undefined) data.onchainReportId = dto.onchainReportId;
    if (dto.title !== undefined) data.title = dto.title.trim();
    if (dto.severity !== undefined) data.severity = dto.severity;
    if (dto.reportHash !== undefined) data.reportHash = dto.reportHash;

    if (
      dto.description !== undefined ||
      dto.stepsToReproduce !== undefined ||
      dto.impact !== undefined ||
      dto.recommendation !== undefined
    ) {
      const current = this.reportEncryptionService.decrypt(report);
      const encrypted = this.reportEncryptionService.encrypt({
        description: dto.description?.trim() ?? current.description,
        stepsToReproduce: dto.stepsToReproduce?.trim() ?? current.stepsToReproduce,
        impact: dto.impact?.trim() ?? current.impact,
        recommendation: dto.recommendation?.trim() ?? current.recommendation,
      });

      data.description = this.encryptedPlaceholder;
      data.stepsToReproduce = this.encryptedPlaceholder;
      data.impact = this.encryptedPlaceholder;
      data.recommendation = this.encryptedPlaceholder;
      data.encryptedContent = encrypted.encryptedContent;
      data.iv = encrypted.iv;
      data.authTag = encrypted.authTag;
    }

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

  private async completeTransaction(
    tx: Prisma.TransactionClient,
    data: {
      transactionId?: string;
      userId: string;
      bountyId: string;
      reportId: string;
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
            reportId: data.reportId,
            type: data.type,
          },
          select: { id: true },
        })
      : await tx.transaction.findFirst({
          where: {
            userId: data.userId,
            bountyId: data.bountyId,
            reportId: data.reportId,
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
        reportId: data.reportId,
        txHash,
        type: data.type,
        status: TransactionStatus.SUCCESS,
      },
    });
  }

  private serializeReport<T extends { encryptedContent?: string | null; iv?: string | null; authTag?: string | null }>(
    report: T,
  ) {
    const decrypted = this.reportEncryptionService.decrypt(report);
    const {
      encryptedContent: _encryptedContent,
      iv: _iv,
      authTag: _authTag,
      ...publicReport
    } = report;

    return {
      ...publicReport,
      ...decrypted,
    };
  }
}
