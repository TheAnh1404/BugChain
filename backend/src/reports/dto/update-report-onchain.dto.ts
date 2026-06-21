import { IsOptional, IsString, IsUUID, Matches, MaxLength } from 'class-validator';

export class UpdateReportOnChainDto {
  @IsString()
  @Matches(/^[a-fA-F0-9]{64}$/, {
    message: 'txHash must be a 64-character Stellar transaction hash',
  })
  txHash: string;

  @IsString()
  @MaxLength(128)
  onchainReportId: string;

  @IsString()
  @Matches(/^[a-fA-F0-9]{64}$/, {
    message: 'reportHash must be a 32-byte SHA-256 hex string',
  })
  reportHash: string;

  @IsOptional()
  @IsString()
  stellarExplorerUrl?: string;

  @IsOptional()
  @IsUUID()
  transactionId?: string;
}
export class ClaimRewardDto {
  @IsString()
  @Matches(/^[a-fA-F0-9]{64}$/, {
    message: 'txHash must be a 64-character Stellar transaction hash',
  })
  txHash: string;

  @IsOptional()
  @IsUUID()
  transactionId?: string;
}
