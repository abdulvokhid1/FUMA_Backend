import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

const ALLOWED_PLAN_ENUMS = ['BASIC', 'PRO', 'VIP'] as const;
export type AllowedPlanName = (typeof ALLOWED_PLAN_ENUMS)[number];

export class CreatePlanDto {
  @IsString()
  @IsNotEmpty()
  name!: string; // must match MembershipPlan enum

  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  label!: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string;

  @IsInt()
  @IsPositive()
  price!: number; // cents or KRW (int)

  @IsInt()
  @Min(1)
  durationDays!: number;

  @IsObject()
  @IsOptional()
  features?: Record<string, any>;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class UpdatePlanDto {
  @IsString()
  @IsOptional()
  @MaxLength(80)
  label?: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string;

  @IsInt()
  @IsOptional()
  @IsPositive()
  price?: number;

  @IsInt()
  @IsOptional()
  @Min(1)
  durationDays?: number;

  @IsObject()
  @IsOptional()
  features?: Record<string, any>;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class TogglePlanDto {
  @IsBoolean()
  isActive!: boolean;
}

// small helper used by service to validate enum names
export const assertAllowedPlanName = (name: string) => {
  if (!ALLOWED_PLAN_ENUMS.includes(name as AllowedPlanName)) {
    throw new Error(
      `Invalid plan name. Must be one of: ${ALLOWED_PLAN_ENUMS.join(', ')}`,
    );
  }
};
