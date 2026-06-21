import { TransactionType } from '@prisma/client';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';

export class CreateTransactionDto {
  @IsEnum(TransactionType)
  type: TransactionType;

  @IsOptional()
  @IsUUID()
  bountyId?: string;

  @IsOptional()
  @IsUUID()
  reportId?: string;
}
