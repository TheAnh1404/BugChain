import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateOnboardingDto } from './dto/update-onboarding.dto';

@Injectable()
export class OnboardingService {
  constructor(private readonly prisma: PrismaService) {}

  async getMine(userId: string) {
    const [user, feedbackCount, firstWallet, firstBounty, firstReport] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          onboardingCompleted: true,
          firstWalletConnectedAt: true,
          firstBountyCreatedAt: true,
          firstReportSubmittedAt: true,
        },
      }),
      this.prisma.feedback.count({ where: { userId } }),
      this.prisma.wallet.findFirst({
        where: {
          userId,
          verifiedAt: { not: null },
        },
        orderBy: [{ verifiedAt: 'asc' }, { createdAt: 'asc' }],
        select: { verifiedAt: true, createdAt: true },
      }),
      this.prisma.bounty.findFirst({
        where: {
          ownerId: userId,
          txHash: { not: null },
        },
        orderBy: { createdAt: 'asc' },
        select: { createdAt: true },
      }),
      this.prisma.report.findFirst({
        where: {
          hunterId: userId,
          txHash: { not: null },
        },
        orderBy: { createdAt: 'asc' },
        select: { createdAt: true },
      }),
    ]);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const walletCompletedAt =
      user.firstWalletConnectedAt || firstWallet?.verifiedAt || firstWallet?.createdAt;
    const firstBountyCompletedAt = user.firstBountyCreatedAt || firstBounty?.createdAt;
    const firstReportCompletedAt = user.firstReportSubmittedAt || firstReport?.createdAt;
    const firstActionCompletedAt = firstBountyCompletedAt || firstReportCompletedAt;

    return {
      completed: user.onboardingCompleted,
      steps: [
        {
          id: 'create-account',
          label: 'Create account',
          completed: true,
        },
        {
          id: 'connect-wallet',
          label: 'Connect Freighter wallet',
          completed: Boolean(walletCompletedAt),
          completedAt: walletCompletedAt,
        },
        {
          id: 'first-action',
          label: 'Create first bounty or submit first report',
          completed: Boolean(firstActionCompletedAt),
          completedAt: firstActionCompletedAt,
        },
        {
          id: 'view-transaction',
          label: 'View transaction on Stellar Expert',
          completed: Boolean(firstActionCompletedAt),
        },
        {
          id: 'submit-feedback',
          label: 'Submit feedback',
          completed: feedbackCount > 0,
        },
      ],
    };
  }

  async updateMine(userId: string, dto: UpdateOnboardingDto) {
    if (dto.onboardingCompleted === undefined) {
      return this.getMine(userId);
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { onboardingCompleted: dto.onboardingCompleted },
    });

    return this.getMine(userId);
  }

  async complete(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { onboardingCompleted: true },
    });

    return this.getMine(userId);
  }
}
