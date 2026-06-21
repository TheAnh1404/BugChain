import { Injectable } from '@nestjs/common';
import { ReportStatus, Severity } from '@prisma/client';
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
