import { Injectable } from '@nestjs/common';
import { HunterBadge, Prisma, Severity } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const SEVERITY_SCORE: Record<Severity, number> = {
  LOW: 1,
  MEDIUM: 3,
  HIGH: 7,
  CRITICAL: 10,
};

@Injectable()
export class ReputationService {
  constructor(private readonly prisma: PrismaService) {}

  async ensureProfile(userId: string) {
    return this.prisma.reputationProfile.upsert({
      where: { userId },
      update: {},
      create: { userId },
      include: { user: { select: { id: true, username: true, avatarUrl: true } } },
    });
  }

  async recordFirstReport(userId: string) {
    await this.ensureProfile(userId);
    await this.awardBadge(userId, HunterBadge.FIRST_REPORT);
  }

  async recordApprovedReport(userId: string, severity: Severity) {
    const profile = await this.ensureProfile(userId);
    const approvedReports = profile.approvedReports + 1;
    const rejectedReports = profile.rejectedReports;
    const severityScore = profile.severityScore + SEVERITY_SCORE[severity];

    await this.prisma.reputationProfile.update({
      where: { userId },
      data: {
        approvedReports,
        severityScore,
        successRate: this.calculateSuccessRate(approvedReports, rejectedReports),
      },
    });

    if (severity === Severity.CRITICAL) {
      await this.awardBadge(userId, HunterBadge.CRITICAL_FINDER);
    }
    if (approvedReports >= 5 || severityScore >= 30) {
      await this.awardBadge(userId, HunterBadge.TOP_HUNTER);
    }
  }

  async recordRejectedReport(userId: string) {
    const profile = await this.ensureProfile(userId);
    const approvedReports = profile.approvedReports;
    const rejectedReports = profile.rejectedReports + 1;

    await this.prisma.reputationProfile.update({
      where: { userId },
      data: {
        rejectedReports,
        successRate: this.calculateSuccessRate(approvedReports, rejectedReports),
      },
    });
  }

  async recordRewardClaimed(userId: string, rewardAmount: Prisma.Decimal | string | number) {
    const profile = await this.ensureProfile(userId);
    const nextEarnedXlm =
      Number(profile.earnedXLM.toString()) + Number(rewardAmount.toString());

    await this.prisma.reputationProfile.update({
      where: { userId },
      data: {
        earnedXLM: nextEarnedXlm.toFixed(7),
      },
    });

    if (nextEarnedXlm >= 1000) {
      await this.awardBadge(userId, HunterBadge.THOUSAND_XLM_EARNED);
    }
  }

  async getProfile(userId: string) {
    await this.ensureProfile(userId);
    const profile = await this.prisma.reputationProfile.findUniqueOrThrow({
      where: { userId },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            avatarUrl: true,
            reputationBadges: {
              orderBy: { awardedAt: 'asc' },
            },
          },
        },
      },
    });

    return this.serializeProfile(profile);
  }

  async leaderboard(limit = 10) {
    const profiles = await this.prisma.reputationProfile.findMany({
      include: {
        user: {
          select: {
            id: true,
            username: true,
            avatarUrl: true,
            reputationBadges: { orderBy: { awardedAt: 'asc' } },
          },
        },
      },
      orderBy: [
        { severityScore: 'desc' },
        { approvedReports: 'desc' },
        { earnedXLM: 'desc' },
      ],
      take: Math.min(50, Math.max(1, Number(limit) || 10)),
    });

    return profiles.map((profile) => this.serializeProfile(profile));
  }

  getHunterLevel(profile: {
    approvedReports: number;
    severityScore: number;
    earnedXLM: Prisma.Decimal | string | number;
  }) {
    const earned = Number(profile.earnedXLM.toString());

    if (profile.approvedReports >= 10 || profile.severityScore >= 75 || earned >= 5000) {
      return 'Elite Hunter';
    }
    if (profile.approvedReports >= 5 || profile.severityScore >= 30 || earned >= 1000) {
      return 'Level 3';
    }
    if (profile.approvedReports >= 2 || profile.severityScore >= 10) {
      return 'Level 2';
    }
    return 'Level 1';
  }

  private calculateSuccessRate(approvedReports: number, rejectedReports: number) {
    const total = approvedReports + rejectedReports;
    return total === 0 ? 0 : Number(((approvedReports / total) * 100).toFixed(2));
  }

  private awardBadge(userId: string, badge: HunterBadge) {
    return this.prisma.reputationBadge.upsert({
      where: {
        userId_badge: { userId, badge },
      },
      update: {},
      create: { userId, badge },
    });
  }

  private serializeProfile(profile: {
    userId: string;
    approvedReports: number;
    rejectedReports: number;
    successRate: number;
    earnedXLM: Prisma.Decimal;
    severityScore: number;
    updatedAt: Date;
    user?: {
      id: string;
      username: string;
      avatarUrl: string | null;
      reputationBadges?: { badge: HunterBadge; awardedAt: Date }[];
    };
  }) {
    return {
      ...profile,
      earnedXLM: profile.earnedXLM.toString(),
      hunterLevel: this.getHunterLevel(profile),
      badges: profile.user?.reputationBadges ?? [],
    };
  }
}
