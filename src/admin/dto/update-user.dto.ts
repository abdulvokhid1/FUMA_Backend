import {
  IsOptional,
  IsString,
  IsEmail,
  IsBoolean,
  IsEnum,
  IsUrl,
  IsISO8601,
  Length,
} from 'class-validator';
import { MembershipPlan } from '@prisma/client';

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @Length(1, 120)
  name?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @Length(3, 40)
  phone?: string;

  @IsOptional()
  @IsBoolean()
  isApproved?: boolean;

  @IsOptional()
  @IsBoolean()
  isPayed?: boolean;

  @IsOptional()
  @IsISO8601()
  accessExpiresAt?: string; // ISO date string

  @IsOptional()
  @IsUrl()
  paymentProofUrl?: string;
}
