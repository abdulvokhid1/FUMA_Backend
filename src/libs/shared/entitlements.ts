// libs/shared/entitlements.ts
export type Plan = 'BASIC' | 'PRO' | 'VIP';

export const Features = {
  SIGNAL_CHARTS: 'SIGNAL_CHARTS', // 시그널차트 전략
  MARTINGALE_EA: 'MARTINGALE_EA', // 마팅게일 EA
  TELEGRAM_BASIC: 'TELEGRAM_BASIC',
  TELEGRAM_PRO: 'TELEGRAM_PRO',
  TELEGRAM_VIP: 'TELEGRAM_VIP',
  CONSULT_1ON1: 'CONSULT_1ON1', // 상담 (quota feature)
} as const;
export type FeatureId = keyof typeof Features;

export type Quotas = {
  CONSULT_1ON1?: { monthlyLimit: number; used: number };
};

export type Entitlements = {
  plan: Plan;
  isApproved: boolean;
  isPayed: boolean; // whether the user has paid for the plan
  accessExpiresAt?: string | null;
  access: Record<string, boolean>; // feature → can use?
  quotas: Quotas; // quota info (optional)
};

export const PLAN_FEATURES: Record<
  Plan,
  { flags: string[]; monthlyConsults: number | 'unlimited' }
> = {
  BASIC: {
    flags: [
      Features.SIGNAL_CHARTS,
      Features.TELEGRAM_BASIC,
      Features.CONSULT_1ON1,
    ],
    monthlyConsults: 2,
  },
  PRO: {
    flags: [
      Features.SIGNAL_CHARTS,
      Features.TELEGRAM_BASIC,
      Features.CONSULT_1ON1,
      Features.MARTINGALE_EA,
      Features.TELEGRAM_PRO,
    ],
    monthlyConsults: 4,
  },
  VIP: {
    flags: [
      Features.SIGNAL_CHARTS,
      Features.TELEGRAM_BASIC,
      Features.CONSULT_1ON1,
      Features.MARTINGALE_EA,
      Features.TELEGRAM_PRO,
      Features.TELEGRAM_VIP,
    ],
    monthlyConsults: 'unlimited',
  },
};
