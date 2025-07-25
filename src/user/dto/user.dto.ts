import { MembershipPlan } from '@prisma/client';
import {
  IsEmail,
  IsNotEmpty,
  IsString,
  IsPhoneNumber,
  IsEnum,
} from 'class-validator';

export class RegisterDto {
  @IsEmail({}, { message: 'Invalid email format' })
  email: string;

  @IsString()
  // @MinLength(6, { message: 'Password must be at least 6 characters' })
  // @MaxLength(30, { message: 'Password must not exceed 30 characters' })
  // @Matches(/^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d@$!%*?&]+$/, {
  //   message: 'Password must contain letters and numbers',
  // })
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
  @IsEnum(MembershipPlan, { message: '올바른 멤버십 플랜을 선택해주세요.' })
  membershipPlan: MembershipPlan;
}
