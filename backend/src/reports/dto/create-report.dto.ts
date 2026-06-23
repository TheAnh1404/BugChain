import { Severity } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength, MinLength, ValidateIf } from 'class-validator';

export class CreateReportDto {
  @IsOptional()
  @IsString()
  @MaxLength(128)
  onchainReportId?: string;

  @IsString()
  @MinLength(3)
  @MaxLength(140)
  title: string;

  @IsEnum(Severity)
  severity: Severity;

  @ValidateIf((dto) => !dto.encryptedContent)
  @IsString()
  @MinLength(20)
  @MaxLength(20000)
  description: string;

  @ValidateIf((dto) => !dto.encryptedContent)
  @IsString()
  @MinLength(20)
  @MaxLength(20000)
  stepsToReproduce: string;

  @ValidateIf((dto) => !dto.encryptedContent)
  @IsString()
  @MinLength(10)
  @MaxLength(10000)
  impact: string;

  @ValidateIf((dto) => !dto.encryptedContent)
  @IsString()
  @MinLength(10)
  @MaxLength(10000)
  recommendation: string;

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
