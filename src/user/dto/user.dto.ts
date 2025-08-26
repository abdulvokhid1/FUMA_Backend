import {
  IsEmail,
  IsNotEmpty,
  IsString,
  IsPhoneNumber,
  IsEnum,
} from 'class-validator';
import { MembershipPlan, PaymentMethod } from '@prisma/client';

export class RegisterDto {
  @IsEmail({}, { message: 'Invalid email format' })
  email: string;

  @IsString()
  password: string;

  @IsString()
  @IsNotEmpty({ message: 'Name is required' })
  name: string;

  @IsPhoneNumber('KR', { message: 'Invalid phone number format' })
  phone: string;
}

export class LoginDto {
  @IsEmail({}, { message: 'Invalid email format' })
  email: string;

  @IsString()
  @IsNotEmpty({ message: 'Password is required' })
  password: string;
}
export class SubmitMembershipDto {
  @IsEnum(MembershipPlan, { message: '유효하지 않은 플랜입니다.' })
  membershipPlan: MembershipPlan; // BASIC | PRO | VIP (enum from Prisma)

  @IsEnum(PaymentMethod, { message: '유효하지 않은 결제수단입니다.' })
  paymentMethod: PaymentMethod; // BANK_TRANSFER | USDT
}
