export const FEATURE_NAMES = [
  'target_percent',
  'stoploss_percent',
  'reward_risk_ratio',
  'breakout_extension_pct',
  'days_to_breakout',
  'month_high_day_norm',
  'volume_ratio',
  'prior_5d_return',
] as const;

export type FeatureName = (typeof FEATURE_NAMES)[number];

export type FeatureVector = Record<FeatureName, number>;
