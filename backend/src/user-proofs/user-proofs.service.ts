import { Injectable } from '@nestjs/common';
import { WalletInteractionAction } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

type RecordWalletInteractionInput = {
  userId: string;
  action: WalletInteractionAction;
  walletAddress?: string | null;
  txHash?: string | null;
  stellarExplorerUrl?: string | null;
};

@Injectable()
export class UserProofsService {
  constructor(private readonly prisma: PrismaService) {}

  async record(input: RecordWalletInteractionInput) {
    const walletAddress = await this.resolveWalletAddress(
      input.userId,
      input.walletAddress,
    );

    if (!walletAddress) {
      return null;
    }

    const txHash = input.txHash?.toLowerCase() || null;
    const interaction = await this.prisma.userWalletInteraction.create({
      data: {
        userId: input.userId,
        walletAddress,
        action: input.action,
        txHash,
        stellarExplorerUrl:
          input.stellarExplorerUrl ||
          (txHash ? this.buildStellarExplorerUrl(txHash) : null),
      },
    });

    await this.updateOnboardingMilestone(input.userId, input.action);

    return interaction;
  }

  async list() {
    return this.prisma.userWalletInteraction.findMany({
      include: {
        user: {
          select: {
            id: true,
            email: true,
            username: true,
            role: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });
  }

  async exportCsv() {
    const rows = await this.list();
    const header = [
      'userId',
      'email',
      'username',
      'walletAddress',
      'action',
      'txHash',
      'stellarExplorerUrl',
      'createdAt',
    ];

    return [
      header.join(','),
      ...rows.map((row) =>
        [
          row.userId,
          row.user.email,
          row.user.username,
          row.walletAddress,
          row.action,
          row.txHash || '',
          row.stellarExplorerUrl || '',
          row.createdAt.toISOString(),
        ]
          .map((value) => this.csvCell(value))
          .join(','),
      ),
    ].join('\n');
  }

  private async resolveWalletAddress(userId: string, walletAddress?: string | null) {
    const normalized = walletAddress?.trim().toUpperCase();
    if (normalized) {
      return normalized;
    }

    const wallet = await this.prisma.wallet.findFirst({
      where: { userId },
      orderBy: [{ isPrimary: 'desc' }, { verifiedAt: 'desc' }, { createdAt: 'desc' }],
      select: { walletAddress: true },
    });

    return wallet?.walletAddress || null;
  }

  private async updateOnboardingMilestone(
    userId: string,
    action: WalletInteractionAction,
  ) {
    if (action === WalletInteractionAction.WALLET_CONNECTED) {
      await this.prisma.user.updateMany({
        where: { id: userId, firstWalletConnectedAt: null },
        data: { firstWalletConnectedAt: new Date() },
      });
    }

    if (action === WalletInteractionAction.BOUNTY_CREATED) {
      await this.prisma.user.updateMany({
        where: { id: userId, firstBountyCreatedAt: null },
        data: { firstBountyCreatedAt: new Date() },
      });
    }

    if (action === WalletInteractionAction.REPORT_SUBMITTED) {
      await this.prisma.user.updateMany({
        where: { id: userId, firstReportSubmittedAt: null },
        data: { firstReportSubmittedAt: new Date() },
      });
    }
  }

  private buildStellarExplorerUrl(txHash: string) {
    return `https://stellar.expert/explorer/testnet/tx/${txHash}`;
  }

  private csvCell(value: string) {
    return `"${value.replace(/"/g, '""')}"`;
  }
}
