import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class SendResetDto {
  @IsEmail()
  email: string;
}

export class ResetPasswordDto {
  @IsString()
  token: string;

  @IsString()
  @MinLength(8)
  @MaxLength(72)
  newPassword: string;
}
