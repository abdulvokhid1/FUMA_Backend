import { IsEnum } from 'class-validator';

export enum TierRole {
  LEVEL1 = 'LEVEL1',
  LEVEL2 = 'LEVEL2',
  LEVEL3 = 'LEVEL3',
  LEVEL4 = 'LEVEL4',
  VIP = 'VIP',
}

export class ApproveUserDto {
  @IsEnum(TierRole)
  role: TierRole;
}
