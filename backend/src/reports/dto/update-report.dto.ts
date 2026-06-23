import { Severity } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateReportDto {
  @IsOptional()
  @IsString()
  @MaxLength(128)
  onchainReportId?: string;

  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(140)
  title?: string;

  @IsOptional()
  @IsEnum(Severity)
  severity?: Severity;

  @IsOptional()
  @IsString()
  @MinLength(20)
  @MaxLength(20000)
  description?: string;

  @IsOptional()
  @IsString()
  @MinLength(20)
  @MaxLength(20000)
  stepsToReproduce?: string;

  @IsOptional()
  @IsString()
  @MinLength(10)
  @MaxLength(10000)
  impact?: string;

  @IsOptional()
  @IsString()
  @MinLength(10)
  @MaxLength(10000)
  recommendation?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  reportHash?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120000)
  encryptedContent?: string;

  @IsOptional()
  @IsString()
  @MaxLength(12000)
  encryptedAesKey?: string;

  @IsOptional()
  @IsString()
  @MaxLength(256)
  iv?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  encryptionScheme?: string;
}
