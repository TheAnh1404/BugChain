import { IsString, Matches, MaxLength } from 'class-validator';

export class UpdateBountyOnChainDto {
  @IsString()
  @Matches(/^[a-fA-F0-9]{64}$/, {
    message: 'txHash must be a 64-character Stellar transaction hash',
  })
  txHash: string;

  @IsString()
  @MaxLength(128)
  onchainBountyId: string;

  @IsString()
  @Matches(/^[a-fA-F0-9]{64}$/, {
    message: 'metadataHash must be a 32-byte SHA-256 hex string',
  })
  metadataHash: string;
}
export class RefundBountyDto {
  @IsString()
  @Matches(/^[a-fA-F0-9]{64}$/, {
    message: 'txHash must be a 64-character Stellar transaction hash',
  })
  txHash: string;
}
