import { Transform } from 'class-transformer';
import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class WalletLinkDto {
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsString()
  @Matches(/^G[A-Z2-7]{55}$/, {
    message: 'walletAddress must be a valid Stellar public key',
  })
  walletAddress: string;

  @IsString()
  @MinLength(1)
  @MaxLength(2048)
  message: string;

  @IsString()
  @MinLength(1)
  @MaxLength(2048)
  signature: string;
}
