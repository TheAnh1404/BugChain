import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { WalletLinkDto } from './dto/wallet-link.dto';
import { WalletNonceDto } from './dto/wallet-nonce.dto';

@Injectable()
export class WalletsService {
  constructor(private readonly prisma: PrismaService) {}

  async createNonce(userId: string, dto: WalletNonceDto) {
    const walletAddress = this.normalizeWalletAddress(dto.walletAddress);
    const existingWallet = await this.prisma.wallet.findUnique({
      where: { walletAddress },
    });

    if (existingWallet && existingWallet.userId !== userId) {
      throw new ConflictException('Wallet address is already linked to another account');
    }

    const nonce = randomBytes(32).toString('hex');

    if (existingWallet) {
      await this.prisma.wallet.update({
        where: { id: existingWallet.id },
        data: { nonce },
      });
    } else {
      const walletCount = await this.prisma.wallet.count({
        where: { userId },
      });

      await this.prisma.wallet.create({
        data: {
          userId,
          walletAddress,
          nonce,
          isPrimary: walletCount === 0,
        },
      });
    }

    return {
      walletAddress,
      nonce,
      message: this.buildVerificationMessage(walletAddress, nonce),
    };
  }

  async linkWallet(userId: string, dto: WalletLinkDto) {
    const walletAddress = this.normalizeWalletAddress(dto.walletAddress);
    const wallet = await this.prisma.wallet.findUnique({
      where: { walletAddress },
    });

    if (!wallet) {
      throw new NotFoundException('Request a wallet nonce before linking');
    }

    if (wallet.userId !== userId) {
      throw new UnauthorizedException('Wallet address does not belong to the current user');
    }

    if (!wallet.nonce) {
      throw new BadRequestException('Wallet nonce is missing or already used');
    }

    const message = this.buildVerificationMessage(walletAddress, wallet.nonce);
    if (!dto.message.includes(wallet.nonce) || dto.message !== message) {
      throw new BadRequestException('Wallet verification message is invalid or expired');
    }

    const verified = await this.verifyWalletSignature(
      walletAddress,
      dto.message,
      dto.signature,
    );

    if (!verified) {
      throw new BadRequestException('Invalid wallet signature');
    }

    const linkedWallet = await this.prisma.$transaction(async (tx) => {
      const primaryWallet = await tx.wallet.findFirst({
        where: {
          userId,
          isPrimary: true,
          verifiedAt: { not: null },
        },
        select: { id: true },
      });

      return tx.wallet.update({
        where: { id: wallet.id },
        data: {
          nonce: null,
          verifiedAt: new Date(),
          isPrimary: wallet.isPrimary || !primaryWallet,
        },
      });
    });

    return linkedWallet;
  }

  async listMine(userId: string) {
    return this.prisma.wallet.findMany({
      where: { userId },
      orderBy: [{ isPrimary: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async remove(userId: string, walletId: string) {
    const wallet = await this.prisma.wallet.findUnique({
      where: { id: walletId },
    });

    if (!wallet) {
      throw new NotFoundException('Wallet not found');
    }

    if (wallet.userId !== userId) {
      throw new ForbiddenException('You can only remove your own wallets');
    }

    await this.prisma.wallet.delete({ where: { id: walletId } });

    if (wallet.isPrimary) {
      const replacement = await this.prisma.wallet.findFirst({
        where: {
          userId,
          verifiedAt: { not: null },
        },
        orderBy: { createdAt: 'asc' },
      });

      if (replacement) {
        await this.prisma.wallet.update({
          where: { id: replacement.id },
          data: { isPrimary: true },
        });
      }
    }

    return { deleted: true };
  }

  private buildVerificationMessage(walletAddress: string, nonce: string) {
    return `BugChain Wallet Verification\nWallet: ${walletAddress}\nNonce: ${nonce}`;
  }

  private normalizeWalletAddress(walletAddress: string) {
    const normalized = walletAddress?.trim().toUpperCase();
    if (!normalized) {
      throw new BadRequestException('walletAddress is required');
    }

    return normalized;
  }

  private async verifyWalletSignature(
    walletAddress: string,
    message: string,
    signature: string,
  ) {
    // TODO: Implement real Freighter/Stellar signature verification before production.
    // Freighter signs the exact verification message with the Testnet passphrase on the frontend.
    // Keep this fallback isolated so production cannot silently accept unverified wallets.
    return (
      process.env.NODE_ENV !== 'production' &&
      Boolean(walletAddress && message && signature)
    );
  }
}
