import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ReviewReportDto {
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  comment?: string;

  @IsOptional()
  @IsString()
  txHash?: string;
}
