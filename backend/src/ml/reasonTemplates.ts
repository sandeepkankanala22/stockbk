import type { FeatureName } from './featureDefinitions.js';

export const REASON_TEMPLATES: Record<FeatureName, { positive: string; negative: string }> = {
  target_percent: {
    positive: 'Higher target ({value}%) gives more room before stoploss is hit',
    negative: 'Lower target ({value}%) makes hitting target harder relative to risk',
  },
  stoploss_percent: {
    positive: 'Wider stoploss ({value}%) reduces premature stop-outs',
    negative: 'Tight stoploss ({value}%) increases chance of stoploss hit',
  },
  reward_risk_ratio: {
    positive: 'Favorable reward-to-risk ratio ({value}) supports target outcome',
    negative: 'Unfavorable reward-to-risk ratio ({value}) favors stoploss',
  },
  breakout_extension_pct: {
    positive: 'Strong breakout extension ({value}%) shows momentum',
    negative: 'Weak breakout extension ({value}%) suggests limited follow-through',
  },
  days_to_breakout: {
    positive: 'Breakout after {value} days from month high — patience paid off historically',
    negative: 'Late breakout ({value} days) often loses momentum',
  },
  month_high_day_norm: {
    positive: 'Month high formed early in the month (day {value}) — cleaner setup',
    negative: 'Month high formed late (day {value}) — weaker base',
  },
  volume_ratio: {
    positive: 'Breakout volume surge ({value}x avg) confirms strength',
    negative: 'Low breakout volume ({value}x avg) — weak confirmation',
  },
  prior_5d_return: {
    positive: 'Positive 5-day momentum ({value}%) before breakout',
    negative: 'Negative 5-day momentum ({value}%) before breakout',
  },
};
