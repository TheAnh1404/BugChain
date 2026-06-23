import { Injectable } from '@nestjs/common';
import { ReportStatus, Severity, WalletInteractionAction } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ReputationService } from '../reputation/reputation.service';

const SEVERITIES: Severity[] = [
  Severity.LOW,
  Severity.MEDIUM,
  Severity.HIGH,
  Severity.CRITICAL,
];

@Injectable()
export class AnalyticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reputationService: ReputationService,
  ) {}

  async securityDashboard() {
    const [
      totalBounties,
      totalReports,
      approvedReports,
      paidReports,
      severityRows,
      resolvedReports,
      reports,
      paidReportRows,
      leaderboard,
    ] = await Promise.all([
      this.prisma.bounty.count(),
      this.prisma.report.count(),
      this.prisma.report.count({
        where: { status: { in: [ReportStatus.APPROVED, ReportStatus.PAID] } },
      }),
      this.prisma.report.count({ where: { status: ReportStatus.PAID } }),
      this.prisma.report.groupBy({
        by: ['severity'],
        _count: { severity: true },
      }),
      this.prisma.report.findMany({
        where: {
          status: {
            in: [ReportStatus.APPROVED, ReportStatus.REJECTED, ReportStatus.PAID],
          },
          reviews: { some: {} },
        },
        select: {
          createdAt: true,
          reviews: {
            orderBy: { createdAt: 'asc' },
            take: 1,
            select: { createdAt: true },
          },
        },
      }),
      this.prisma.report.findMany({
        select: {
          createdAt: true,
          status: true,
        },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.report.findMany({
        where: { status: ReportStatus.PAID },
        select: {
          updatedAt: true,
          bounty: { select: { rewardAmount: true, rewardAsset: true } },
        },
        orderBy: { updatedAt: 'asc' },
      }),
      this.reputationService.leaderboard(10),
    ]);

    const rewardsPaid = paidReportRows.reduce(
      (sum, report) => sum + Number(report.bounty.rewardAmount.toString()),
      0,
    );

    return {
      metrics: {
        totalBounties,
        totalReports,
        approvalRate: totalReports === 0
          ? 0
          : Number(((approvedReports / totalReports) * 100).toFixed(2)),
        averageResolutionTimeHours: this.averageResolutionTimeHours(resolvedReports),
        rewardsPaid: rewardsPaid.toFixed(7),
        paidReports,
      },
      severityDistribution: this.severityDistribution(severityRows),
      reportsOverTime: this.reportsOverTime(reports),
      rewardsOverTime: this.rewardsOverTime(paidReportRows),
      hunterLeaderboard: leaderboard,
    };
  }

  async overview() {
    const [
      totalUsers,
      walletConnectedUsers,
      totalBounties,
      totalReports,
      totalWalletInteractions,
      feedbackRating,
      feedbackCount,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({
        where: { wallets: { some: { verifiedAt: { not: null } } } },
      }),
      this.prisma.bounty.count(),
      this.prisma.report.count(),
      this.prisma.userWalletInteraction.count(),
      this.prisma.feedback.aggregate({ _avg: { rating: true } }),
      this.prisma.feedback.count(),
    ]);

    return {
      totalUsers,
      walletConnectedUsers,
      totalBounties,
      totalReports,
      totalWalletInteractions,
      feedbackCount,
      feedbackAverageRating: Number((feedbackRating._avg.rating || 0).toFixed(2)),
    };
  }

  async funnel() {
    const [
      totalUsers,
      verifiedUsers,
      walletConnectedUsers,
      firstActionUsers,
      feedbackUsers,
      completedUsers,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { emailVerified: true } }),
      this.prisma.user.count({
        where: {
          OR: [
            { firstWalletConnectedAt: { not: null } },
            { wallets: { some: { verifiedAt: { not: null } } } },
          ],
        },
      }),
      this.prisma.user.count({
        where: {
          OR: [
            { firstBountyCreatedAt: { not: null } },
            { firstReportSubmittedAt: { not: null } },
            { bounties: { some: { txHash: { not: null } } } },
            { reports: { some: { txHash: { not: null } } } },
          ],
        },
      }),
      this.prisma.user.count({ where: { feedback: { some: {} } } }),
      this.prisma.user.count({ where: { onboardingCompleted: true } }),
    ]);

    return [
      { step: 'Registered', count: totalUsers },
      { step: 'Email verified', count: verifiedUsers },
      { step: 'Wallet connected', count: walletConnectedUsers },
      { step: 'First bounty or report', count: firstActionUsers },
      { step: 'Feedback submitted', count: feedbackUsers },
      { step: 'Onboarding completed', count: completedUsers },
    ];
  }

  async walletInteractions() {
    const [total, byAction, latest] = await Promise.all([
      this.prisma.userWalletInteraction.count(),
      this.prisma.userWalletInteraction.groupBy({
        by: ['action'],
        _count: { action: true },
      }),
      this.prisma.userWalletInteraction.findMany({
        include: {
          user: { select: { id: true, username: true, role: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
    ]);

    return {
      total,
      byAction: Object.values(WalletInteractionAction).map((action) => ({
        action,
        count: byAction.find((row) => row.action === action)?._count.action ?? 0,
      })),
      latest,
    };
  }

  private severityDistribution(
    rows: { severity: Severity; _count: { severity: number } }[],
  ) {
    return SEVERITIES.map((severity) => ({
      severity,
      count: rows.find((row) => row.severity === severity)?._count.severity ?? 0,
    }));
  }

  private reportsOverTime(reports: { createdAt: Date; status: ReportStatus }[]) {
    const buckets = new Map<string, { date: string; total: number; approved: number; rejected: number }>();

    for (const report of reports) {
      const date = report.createdAt.toISOString().slice(0, 10);
      const bucket = buckets.get(date) ?? { date, total: 0, approved: 0, rejected: 0 };
      bucket.total += 1;
      if (report.status === ReportStatus.APPROVED || report.status === ReportStatus.PAID) {
        bucket.approved += 1;
      }
      if (report.status === ReportStatus.REJECTED) {
        bucket.rejected += 1;
      }
      buckets.set(date, bucket);
    }

    return Array.from(buckets.values());
  }

  private rewardsOverTime(
    reports: { updatedAt: Date; bounty: { rewardAmount: { toString(): string } } }[],
  ) {
    const buckets = new Map<string, { date: string; amount: number }>();

    for (const report of reports) {
      const date = report.updatedAt.toISOString().slice(0, 10);
      const bucket = buckets.get(date) ?? { date, amount: 0 };
      bucket.amount += Number(report.bounty.rewardAmount.toString());
      buckets.set(date, bucket);
    }

    return Array.from(buckets.values()).map((bucket) => ({
      ...bucket,
      amount: Number(bucket.amount.toFixed(7)),
    }));
  }

  private averageResolutionTimeHours(
    reports: { createdAt: Date; reviews: { createdAt: Date }[] }[],
  ) {
    if (reports.length === 0) {
      return 0;
    }

    const totalHours = reports.reduce((sum, report) => {
      const firstReview = report.reviews[0];
      if (!firstReview) {
        return sum;
      }

      return sum + ((firstReview.createdAt.getTime() - report.createdAt.getTime()) / 36e5);
    }, 0);

    return Number((totalHours / reports.length).toFixed(2));
  }
}
