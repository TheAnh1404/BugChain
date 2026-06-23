import { IsIn, IsInt, IsString, MaxLength, Min, Max } from 'class-validator';

export class CreateFeedbackDto {
  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;

  @IsString()
  @IsIn(['Owner', 'Hunter', 'Tester'])
  role: string;

  @IsString()
  @MaxLength(1000)
  comment: string;
}
