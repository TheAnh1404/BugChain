import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  BountyStatus,
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
  async approve(reportId: string, reviewer: AuthUser, comment?: string, txHash?: string) {
    return this.review(reportId, reviewer, ReviewDecision.APPROVE, comment, txHash);
  }

  async reject(reportId: string, reviewer: AuthUser, comment?: string, txHash?: string) {
    return this.review(reportId, reviewer, ReviewDecision.REJECT, comment, txHash);
  }

  private async review(
    reportId: string,
    reviewer: AuthUser,
    decision: ReviewDecision,
    comment?: string,
    txHash?: string,
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

        await tx.transaction.create({
          data: {
            userId: reviewer.id,
            bountyId: report.bountyId,
            reportId,
            type: TransactionType.APPROVE_REPORT,
            status: TransactionStatus.SUCCESS,
            txHash: txHash?.toLowerCase(),
          },
        });
      } else {
        await tx.transaction.create({
          data: {
            userId: reviewer.id,
            bountyId: report.bountyId,
            reportId,
            type: TransactionType.REJECT_REPORT,
            status: TransactionStatus.SUCCESS,
            txHash: txHash?.toLowerCase(),
          },
        });
      }

      return { report: updatedReport, review };
    });

    return result;
  }}
