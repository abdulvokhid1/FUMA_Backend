import { IsEnum, IsOptional, IsDateString } from 'class-validator';
import { MembershipPlan } from '@prisma/client';

export class ApproveUserDto {
  @IsEnum(MembershipPlan)
  plan: MembershipPlan;

  @IsOptional()
  @IsDateString()
  accessExpiresAt?: string; // optional expiration date
}
