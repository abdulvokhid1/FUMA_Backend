// src/utils/plan-access.util.ts

export type PlanAccessMap = Record<string, boolean>;

export function getPlanAccessMap(
  metaFeatures?: Record<string, any> | null,
  isActive = true,
): PlanAccessMap {
  if (!isActive || !metaFeatures) return defaultAccess(false);

  const flags = {
    SIGNAL_CHARTS: !!metaFeatures.SIGNAL_CHARTS,
    TELEGRAM_BASIC: !!metaFeatures.TELEGRAM_BASIC,
    MARTINGALE_EA: !!metaFeatures.MARTINGALE_EA,
    TELEGRAM_PRO: !!metaFeatures.TELEGRAM_PRO,
    TELEGRAM_VIP: !!metaFeatures.TELEGRAM_VIP,
    CONSULT_1ON1: !!metaFeatures.CONSULT_1ON1,
  };

  return defaultAccess(isActive, flags);
}

function defaultAccess(
  base: boolean,
  override: Partial<PlanAccessMap> = {},
): PlanAccessMap {
  return {
    SIGNAL_CHARTS: override.SIGNAL_CHARTS ?? false,
    TELEGRAM_BASIC: override.TELEGRAM_BASIC ?? false,
    MARTINGALE_EA: override.MARTINGALE_EA ?? false,
    TELEGRAM_PRO: override.TELEGRAM_PRO ?? false,
    TELEGRAM_VIP: override.TELEGRAM_VIP ?? false,
    CONSULT_1ON1: override.CONSULT_1ON1 ?? false,
  };
}
