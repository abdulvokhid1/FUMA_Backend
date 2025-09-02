import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';

// forgot-password.dto.ts
export class ForgotPasswordDto {
  @IsEmail()
  email: string;
}

// reset-password.dto.ts
export class ResetPasswordDto {
  @IsString()
  @IsNotEmpty()
  token: string;

  @IsString()
  @MinLength(6)
  newPassword: string;
}
