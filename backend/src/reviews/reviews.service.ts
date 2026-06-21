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
  ReviewAssignmentStatus,
  ReviewDecision,
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
import { AssignReviewerDto } from './dto/assign-reviewer.dto';

@Injectable()
export class ReviewsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogsService: AuditLogsService,
    private readonly eventsService: EventsService,
    private readonly notificationsService: NotificationsService,
    private readonly reputationService: ReputationService,
  ) {}

  async assignReviewer(reportId: string, owner: AuthUser, dto: AssignReviewerDto) {
    const report = await this.prisma.report.findUnique({
      where: { id: reportId },
      include: {
        bounty: {
          select: {
            id: true,
            title: true,
            ownerId: true,
          },
        },
      },
    });

    if (!report) {
      throw new NotFoundException('Report not found');
    }

    if (report.bounty.ownerId !== owner.id && owner.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Only the bounty owner can assign reviewers');
    }

    const reviewer = await this.prisma.user.findUnique({
      where: { email: dto.email.trim().toLowerCase() },
      select: { id: true, username: true, email: true, avatarUrl: true },
    });

    if (!reviewer) {
      throw new NotFoundException('Reviewer user not found');
    }

    const assignment = await this.prisma.reviewAssignment.upsert({
      where: {
        reportId_reviewerId: {
          reportId,
          reviewerId: reviewer.id,
        },
      },
      update: {
        reviewerOrder: dto.reviewerOrder,
        status: ReviewAssignmentStatus.PENDING,
        reviewedAt: null,
      },
      create: {
        reportId,
        reviewerId: reviewer.id,
        reviewerOrder: dto.reviewerOrder,
      },
      include: {
        reviewer: { select: { id: true, username: true, email: true, avatarUrl: true } },
      },
    });

    await this.notificationsService.create({
      userId: reviewer.id,
      type: NotificationType.NEW_REPORT,
      title: 'Reviewer assignment',
      message: `You were assigned reviewer ${dto.reviewerOrder} for ${report.title}.`,
    });

    return assignment;
  }
  async approve(
    reportId: string,
    reviewer: AuthUser,
    comment?: string,
    txHash?: string,
    transactionId?: string,
  ) {
    return this.review(reportId, reviewer, ReviewDecision.APPROVE, comment, txHash, transactionId);
  }

  async reject(
    reportId: string,
    reviewer: AuthUser,
    comment?: string,
    txHash?: string,
    transactionId?: string,
  ) {
    return this.review(reportId, reviewer, ReviewDecision.REJECT, comment, txHash, transactionId);
  }

  private async review(
    reportId: string,
    reviewer: AuthUser,
    decision: ReviewDecision,
    comment?: string,
    txHash?: string,
    transactionId?: string,
  ) {
    const report = await this.prisma.report.findUnique({
      where: { id: reportId },
      include: {
          bounty: { select: { id: true, title: true, ownerId: true, onchainBountyId: true } },
          reviewAssignments: true,
      },
    });

    if (!report) {
      throw new NotFoundException('Report not found');
    }

    const assignedReviewer = report.reviewAssignments.find(
      (assignment) => assignment.reviewerId === reviewer.id,
    );

    if (
      report.bounty.ownerId !== reviewer.id &&
      reviewer.role !== UserRole.ADMIN &&
      !assignedReviewer
    ) {
      throw new ForbiddenException('Only the bounty owner or an assigned reviewer can review this report');
    }

    if (report.status !== ReportStatus.PENDING) {
      throw new BadRequestException('Only pending reports can be reviewed');
    }

    const nextStatus =
      decision === ReviewDecision.APPROVE
        ? ReportStatus.APPROVED
        : ReportStatus.REJECTED;

    const result = await this.prisma.$transaction(async (tx) => {
      const reviewerSlot = assignedReviewer?.reviewerOrder ?? 1;
      const updatedReport = await tx.report.update({
        where: { id: reportId },
        data: {
          status: nextStatus,
          approveTxHash: decision === ReviewDecision.APPROVE ? txHash?.toLowerCase() : undefined,
          rejectTxHash: decision === ReviewDecision.REJECT ? txHash?.toLowerCase() : undefined,
        },
        include: {
          bounty: {
            select: {
              id: true,
              title: true,
              ownerId: true,
              status: true,
            },
          },
          hunter: {
            select: {
              id: true,
              username: true,
              avatarUrl: true,
            },
          },
        },
      });

      const review = await tx.review.create({
        data: {
          reportId,
          reviewerId: reviewer.id,
          reviewerSlot,
          decision,
          comment: comment?.trim(),
        },
      });

      await tx.reviewAssignment.upsert({
        where: {
          reportId_reviewerId: {
            reportId,
            reviewerId: reviewer.id,
          },
        },
        update: {
          status:
            decision === ReviewDecision.APPROVE
              ? ReviewAssignmentStatus.APPROVED
              : ReviewAssignmentStatus.REJECTED,
          reviewedAt: new Date(),
        },
        create: {
          reportId,
          reviewerId: reviewer.id,
          reviewerOrder: reviewerSlot,
          status:
            decision === ReviewDecision.APPROVE
              ? ReviewAssignmentStatus.APPROVED
              : ReviewAssignmentStatus.REJECTED,
          reviewedAt: new Date(),
        },
      });

      if (decision === ReviewDecision.APPROVE) {
        await tx.bounty.update({
          where: { id: report.bountyId },
          data: { status: BountyStatus.COMPLETED },
        });

        await this.completeTransaction(tx, {
          transactionId,
          userId: reviewer.id,
          bountyId: report.bountyId,
          reportId,
          type: TransactionType.APPROVE_REPORT,
          txHash,
        });
      } else {
        await this.completeTransaction(tx, {
          transactionId,
          userId: reviewer.id,
          bountyId: report.bountyId,
          reportId,
          type: TransactionType.REJECT_REPORT,
          txHash,
        });
      }

      await this.auditLogsService.recordWithClient(tx, {
        userId: reviewer.id,
        action:
          decision === ReviewDecision.APPROVE
            ? AuditAction.APPROVE_REPORT
            : AuditAction.REJECT_REPORT,
        entityType: EntityType.REPORT,
        entityId: reportId,
        txHash,
      });

      await this.notificationsService.createWithClient(tx, {
        userId: report.hunterId,
        type:
          decision === ReviewDecision.APPROVE
            ? NotificationType.REPORT_APPROVED
            : NotificationType.REPORT_REJECTED,
        title:
          decision === ReviewDecision.APPROVE
            ? 'Report approved'
            : 'Report rejected',
        message:
          decision === ReviewDecision.APPROVE
            ? `${report.title} was approved for ${report.bounty.title}.`
            : `${report.title} was rejected for ${report.bounty.title}.`,
      });

      return { report: updatedReport, review };
    });

    if (decision === ReviewDecision.APPROVE) {
      await this.reputationService.recordApprovedReport(report.hunterId, report.severity);
      this.eventsService.emit('report_approved', {
        bountyId: report.bountyId,
        reportId,
        txHash: txHash?.toLowerCase(),
        onchainBountyId: report.bounty.onchainBountyId || undefined,
        onchainReportId: report.onchainReportId || undefined,
        transactionType: TransactionType.APPROVE_REPORT,
      });
    } else {
      await this.reputationService.recordRejectedReport(report.hunterId);
      this.eventsService.emit('report_rejected', {
        bountyId: report.bountyId,
        reportId,
        txHash: txHash?.toLowerCase(),
        onchainBountyId: report.bounty.onchainBountyId || undefined,
        onchainReportId: report.onchainReportId || undefined,
        transactionType: TransactionType.REJECT_REPORT,
      });
    }

    return result;
  }

  private async completeTransaction(
    tx: Prisma.TransactionClient,
    data: {
      transactionId?: string;
      userId: string;
      bountyId: string;
      reportId: string;
      type: TransactionType;
      txHash?: string;
    },
  ) {
    const normalizedTxHash = data.txHash?.toLowerCase();
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
          txHash: normalizedTxHash,
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
        type: data.type,
        status: TransactionStatus.SUCCESS,
        txHash: normalizedTxHash,
      },
    });
  }
}
