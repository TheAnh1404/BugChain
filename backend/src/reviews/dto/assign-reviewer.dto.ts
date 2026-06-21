import { IsEmail, IsInt, Max, Min } from 'class-validator';

export class AssignReviewerDto {
  @IsEmail()
  email: string;

  @IsInt()
  @Min(1)
  @Max(3)
  reviewerOrder: number;
}
