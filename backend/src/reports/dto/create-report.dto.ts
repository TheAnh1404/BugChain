import { Severity } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

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

  @IsString()
  @MinLength(20)
  @MaxLength(20000)
  description: string;

  @IsString()
  @MinLength(20)
  @MaxLength(20000)
  stepsToReproduce: string;

  @IsString()
  @MinLength(10)
  @MaxLength(10000)
  impact: string;

  @IsString()
  @MinLength(10)
  @MaxLength(10000)
  recommendation: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  reportHash?: string;
}
