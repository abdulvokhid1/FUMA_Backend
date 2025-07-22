import { IsEnum } from 'class-validator';

export enum TierRole {
  TIER1 = 'TIER1',
  TIER2 = 'TIER2',
  TIER3 = 'TIER3',
  VIP = 'VIP',
}

export class ApproveUserDto {
  @IsEnum(TierRole)
  role: TierRole;
}
