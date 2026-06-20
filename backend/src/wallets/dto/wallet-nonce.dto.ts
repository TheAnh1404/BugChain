import { Transform } from 'class-transformer';
import { IsString, Matches } from 'class-validator';

export class WalletNonceDto {
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsString()
  @Matches(/^G[A-Z2-7]{55}$/, {
    message: 'walletAddress must be a valid Stellar public key',
  })
  walletAddress: string;
}
