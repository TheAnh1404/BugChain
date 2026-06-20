import { BountyStatus, Severity } from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateBountyDto {
  @IsOptional()
  @IsString()
  @MaxLength(128)
  onchainBountyId?: string;

  @IsString()
  @MinLength(3)
  @MaxLength(140)
  title: string;

  @IsString()
  @MinLength(20)
  @MaxLength(10000)
  description: string;

  @IsString()
  @MinLength(5)
  @MaxLength(5000)
  scope: string;

  @IsEnum(Severity)
  severity: Severity;

  @IsString()
  @Matches(/^\d+(\.\d{1,7})?$/, {
    message: 'rewardAmount must be a positive decimal string',
  })
  rewardAmount: string;

  @IsOptional()
  @IsString()
  @Matches(/^([A-Z0-9]{2,12}|C[A-Z2-7]{55}|[A-Z0-9]{1,12}:G[A-Z2-7]{55})$/, {
    message: 'rewardAsset must be XLM, a contract ID, or CODE:G... issuer format',
  })
  rewardAsset?: string;

  @IsDateString()
  deadline: string;

  @IsOptional()
  @IsEnum(BountyStatus)
  status?: BountyStatus;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  metadataHash?: string;
}
