import { IsOptional, IsString, IsUUID, Matches, MaxLength } from 'class-validator';

export class ReviewReportDto {
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  comment?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[a-fA-F0-9]{64}$/, {
    message: 'txHash must be a 64-character Stellar transaction hash',
  })
  txHash?: string;

  @IsOptional()
  @IsUUID()
  transactionId?: string;
}
