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
  ReviewDecision,
  TransactionStatus,
  TransactionType,
} from '@prisma/client';
import { AuthUser } from '../common/types/auth-user.type';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ReviewsService {
  constructor(private readonly prisma: PrismaService) {}
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
        bounty: {
          select: {
            id: true,
            ownerId: true,
          },
        },
      },
    });

    if (!report) {
      throw new NotFoundException('Report not found');
    }

    if (report.bounty.ownerId !== reviewer.id) {
      throw new ForbiddenException('Only the bounty owner can review this report');
    }

    if (report.status !== ReportStatus.PENDING) {
      throw new BadRequestException('Only pending reports can be reviewed');
    }

    const nextStatus =
      decision === ReviewDecision.APPROVE
        ? ReportStatus.APPROVED
        : ReportStatus.REJECTED;

    const result = await this.prisma.$transaction(async (tx) => {
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
          decision,
          comment: comment?.trim(),
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

      return { report: updatedReport, review };
    });

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
