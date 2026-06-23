import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import { Keypair } from '@stellar/stellar-sdk';
import { WalletInteractionAction } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UserProofsService } from '../user-proofs/user-proofs.service';
import { WalletLinkDto } from './dto/wallet-link.dto';
import { WalletNonceDto } from './dto/wallet-nonce.dto';

@Injectable()
export class WalletsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly userProofsService: UserProofsService,
  ) {}

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

    await this.userProofsService.record({
      userId,
      walletAddress,
      action: WalletInteractionAction.WALLET_CONNECTED,
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
    try {
      const keypair = Keypair.fromPublicKey(walletAddress);
      const messageBytes = Buffer.from(message, 'utf8');
      const messageDigest = createHash('sha256').update(messageBytes).digest();

      return this.decodeSignatureCandidates(signature).some((candidate) => {
        if (candidate.length !== 64) {
          return false;
        }

        return (
          keypair.verify(messageBytes, candidate) ||
          keypair.verify(messageDigest, candidate)
        );
      });
    } catch {
      return false;
    }
  }

  private decodeSignatureCandidates(signature: string) {
    const trimmed = signature?.trim();
    if (!trimmed) {
      return [];
    }

    const candidates: Buffer[] = [];

    if (/^[a-fA-F0-9]{128}$/.test(trimmed)) {
      candidates.push(Buffer.from(trimmed, 'hex'));
    }

    candidates.push(Buffer.from(trimmed, 'base64'));

    if (/[-_]/.test(trimmed)) {
      candidates.push(
        Buffer.from(trimmed.replace(/-/g, '+').replace(/_/g, '/'), 'base64'),
      );
    }

    try {
      const parsed = JSON.parse(trimmed);
      if (
        parsed?.type === 'Buffer' &&
        Array.isArray(parsed.data) &&
        parsed.data.every((value: unknown) => Number.isInteger(value))
      ) {
        candidates.push(Buffer.from(parsed.data));
      }
    } catch {
      // Freighter normally returns a base64 signature; JSON support is only for SDK wrappers.
    }

    return candidates;
  }
}
