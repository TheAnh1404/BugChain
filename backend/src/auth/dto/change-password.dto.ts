import { IsString, Matches, MinLength, MaxLength } from 'class-validator';

export class ChangePasswordDto {
  @IsString()
  currentPassword: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/, {
    message: 'Password must contain at least one uppercase letter, one lowercase letter, and one number.',
  })
  newPassword: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  confirmNewPassword: string;
}
