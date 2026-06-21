import { Injectable } from '@nestjs/common';
import { AuditAction, EntityType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

type AuditClient = PrismaService | Prisma.TransactionClient;

@Injectable()
export class AuditLogsService {
  constructor(private readonly prisma: PrismaService) {}

  record(data: {
    userId: string;
    action: AuditAction;
    entityType: EntityType;
    entityId: string;
    txHash?: string | null;
  }) {
    return this.recordWithClient(this.prisma, data);
  }

  recordWithClient(
    client: AuditClient,
    data: {
      userId: string;
      action: AuditAction;
      entityType: EntityType;
      entityId: string;
      txHash?: string | null;
    },
  ) {
    return client.auditLog.create({
      data: {
        userId: data.userId,
        action: data.action,
        entityType: data.entityType,
        entityId: data.entityId,
        txHash: data.txHash?.toLowerCase(),
      },
    });
  }
}
