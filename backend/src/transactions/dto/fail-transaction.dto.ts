import { IsOptional, IsString, Matches } from 'class-validator';

export class FailTransactionDto {
  @IsOptional()
  @IsString()
  @Matches(/^[a-fA-F0-9]{64}$/, {
    message: 'txHash must be a 64-character Stellar transaction hash',
  })
  txHash?: string;
}
