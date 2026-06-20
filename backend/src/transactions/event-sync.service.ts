import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { rpc, scValToNative } from '@stellar/stellar-sdk';
import { BountyStatus, ReportStatus, TransactionStatus, TransactionType } from '@prisma/client';

@Injectable()
export class EventSyncService implements OnModuleInit {
  private readonly logger = new Logger(EventSyncService.name);
  private readonly rpcUrl = process.env.VITE_STELLAR_RPC_URL || 'https://soroban-testnet.stellar.org';
  private readonly contractId = process.env.VITE_CONTRACT_ID || 'CBRSQQ3WTR4S32JKUMO2E3MA6P3EX5IH6YC6FR4HWIZFC72TBRXBNSCS';
  private server: rpc.Server;
  private lastLedger = 0;

  constructor(private readonly prisma: PrismaService) {
    this.server = new rpc.Server(this.rpcUrl);
  }

  async onModuleInit() {
    this.logger.log('Starting Stellar Event Sync Service...');
    
    try {
      const latestLedgerRes = await this.server.getLatestLedger();
      this.lastLedger = latestLedgerRes.sequence - 200; // Look back to handle offline periods
      if (this.lastLedger < 0) this.lastLedger = 1;
    } catch (err) {
      this.logger.error('Failed to get latest ledger, defaulting to look back 200 sequences', err);
      this.lastLedger = 1;
    }

    // Run every 10 seconds
    setInterval(() => this.syncEvents(), 10000);
  }

  async syncEvents() {
    try {
      const latestLedgerRes = await this.server.getLatestLedger();
      const currentLedger = latestLedgerRes.sequence;

      if (this.lastLedger >= currentLedger) {
        return;
      }

      this.logger.log(`Syncing events from ledger ${this.lastLedger} to ${currentLedger}`);

      const response = await this.server.getEvents({
        startLedger: this.lastLedger,
        filters: [
          {
            type: 'contract',
            contractIds: [this.contractId],
          },
        ],
        limit: 100,
      });

      if (response.events && response.events.length > 0) {
        for (const event of response.events) {
          await this.processEvent(event);
        }
      }

      this.lastLedger = currentLedger;
    } catch (err) {
      this.logger.error('Error in Stellar Event Sync Service:', err);
    }
  }

  private async processEvent(event: any) {
    try {
      const txHash = event.txHash.toLowerCase();
      const rawTopics = event.topic || [];
      const topics = rawTopics.map((t: any) => scValToNative(t));
      
      if (topics.length === 0) return;

      const eventName = String(topics[0]);
      this.logger.log(`Detected event: ${eventName} in tx ${txHash}`);

      if (eventName === 'bounty_created') {
        const onchainBountyId = String(topics[1]);
        
        // Find bounty by txHash
        const bounty = await this.prisma.bounty.findFirst({
          where: {
            OR: [
              { txHash },
              { onchainBountyId },
            ],
          },
        });

        if (bounty) {
          await this.prisma.bounty.update({
            where: { id: bounty.id },
            data: {
              status: BountyStatus.OPEN,
              onchainBountyId,
              txHash,
              stellarExplorerUrl: `https://stellar.expert/explorer/testnet/tx/${txHash}`,
            },
          });

          await this.ensureTransaction({
            userId: bounty.ownerId,
            bountyId: bounty.id,
            txHash,
            type: TransactionType.CREATE_BOUNTY,
          });
        }
      } 
      else if (eventName === 'report_submitted') {
        const onchainReportId = String(topics[1]);
        const value = scValToNative(event.value);
        const onchainBountyId = String(value[0]);

        // Find report by txHash or reportHash
        const report = await this.prisma.report.findFirst({
          where: {
            OR: [
              { txHash },
              { onchainReportId },
            ],
          },
        });

        if (report) {
          await this.prisma.report.update({
            where: { id: report.id },
            data: {
              status: ReportStatus.PENDING,
              onchainReportId,
              txHash,
              stellarExplorerUrl: `https://stellar.expert/explorer/testnet/tx/${txHash}`,
            },
          });

          await this.ensureTransaction({
            userId: report.hunterId,
            bountyId: report.bountyId,
            reportId: report.id,
            txHash,
            type: TransactionType.SUBMIT_REPORT,
          });
        }
      }
      else if (eventName === 'report_approved') {
        const onchainBountyId = String(topics[1]);
        const onchainReportId = String(topics[2]);

        const report = await this.prisma.report.findFirst({
          where: { onchainReportId },
          include: { bounty: true },
        });

        if (report && report.status !== ReportStatus.APPROVED && report.status !== ReportStatus.PAID) {
          await this.prisma.report.update({
            where: { id: report.id },
            data: {
              status: ReportStatus.APPROVED,
              approveTxHash: txHash,
            },
          });

          await this.prisma.bounty.update({
            where: { id: report.bountyId },
            data: { status: BountyStatus.COMPLETED },
          });

          await this.ensureTransaction({
            userId: report.bounty.ownerId,
            bountyId: report.bountyId,
            reportId: report.id,
            txHash,
            type: TransactionType.APPROVE_REPORT,
          });
        }
      }
      else if (eventName === 'report_rejected') {
        const onchainBountyId = String(topics[1]);
        const onchainReportId = String(topics[2]);

        const report = await this.prisma.report.findFirst({
          where: { onchainReportId },
          include: { bounty: true },
        });

        if (report && report.status !== ReportStatus.REJECTED) {
          await this.prisma.report.update({
            where: { id: report.id },
            data: {
              status: ReportStatus.REJECTED,
              rejectTxHash: txHash,
            },
          });

          await this.ensureTransaction({
            userId: report.bounty.ownerId,
            bountyId: report.bountyId,
            reportId: report.id,
            txHash,
            type: TransactionType.REJECT_REPORT,
          });
        }
      }
      else if (eventName === 'reward_claimed') {
        const onchainBountyId = String(topics[1]);
        const onchainReportId = String(topics[2]);

        const report = await this.prisma.report.findFirst({
          where: { onchainReportId },
          include: { bounty: true },
        });

        if (report && report.status !== ReportStatus.PAID) {
          await this.prisma.report.update({
            where: { id: report.id },
            data: {
              status: ReportStatus.PAID,
              claimTxHash: txHash,
            },
          });

          await this.ensureTransaction({
            userId: report.hunterId,
            bountyId: report.bountyId,
            reportId: report.id,
            txHash,
            type: TransactionType.CLAIM_REWARD,
          });
        }
      }
      else if (eventName === 'bounty_refunded') {
        const onchainBountyId = String(topics[1]);

        const bounty = await this.prisma.bounty.findFirst({
          where: { onchainBountyId },
        });

        if (bounty && bounty.status !== BountyStatus.REFUNDED) {
          await this.prisma.bounty.update({
            where: { id: bounty.id },
            data: {
              status: BountyStatus.REFUNDED,
              refundTxHash: txHash,
            },
          });

          await this.ensureTransaction({
            userId: bounty.ownerId,
            bountyId: bounty.id,
            txHash,
            type: TransactionType.REFUND,
          });
        }
      }
    } catch (err) {
      this.logger.error(`Failed to process event: ${(err as any).message}`, err);
    }
  }

  private async ensureTransaction(data: {
    userId: string;
    bountyId?: string;
    reportId?: string;
    txHash: string;
    type: TransactionType;
  }) {
    const existing = await this.prisma.transaction.findFirst({
      where: {
        txHash: data.txHash,
        type: data.type,
      },
    });

    if (!existing) {
      await this.prisma.transaction.create({
        data: {
          userId: data.userId,
          bountyId: data.bountyId || null,
          reportId: data.reportId || null,
          txHash: data.txHash,
          type: data.type,
          status: TransactionStatus.SUCCESS,
        },
      });
      this.logger.log(`Created missing transaction record of type ${data.type} for tx ${data.txHash}`);
    }
  }
}
