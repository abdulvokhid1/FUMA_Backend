import { IsEmail, IsOptional, IsEnum, IsString } from 'class-validator';
import { MembershipPlan, PaymentMethod } from '@prisma/client';

export class CreateUserDto {
  @IsEmail()
  email: string;

  @IsString()
  password: string;

  @IsOptional()
  name?: string;

  @IsOptional()
  phone?: string;

  @IsOptional()
  @IsEnum(MembershipPlan)
  plan?: MembershipPlan;

  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod;
}
