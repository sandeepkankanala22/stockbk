export const config = {
  port: Number(process.env.PORT) || 3001,
  uploadMaxSizeBytes: 10 * 1024 * 1024,
  yahooConcurrency: 1,
  yahooMinIntervalMs: 800,
  yahooRetryAttempts: 3,
  yahooRetryBaseDelayMs: 2000,
  yahooRateLimitWaitMs: 12000,
  symbolConcurrency: 3,
  cacheTtlSeconds: 86400,
  diskCacheEnabled: true,
  diskCacheDir: 'cache/yahoo',
  uploadExpiryMs: 24 * 60 * 60 * 1000,
  screenerCacheDir: 'cache/screener',
  screenerConcurrency: 2,
  screenerMinIntervalMs: 1200,
  /** Days after quarter-end before treating results as announced on screener.in */
  screenerAnnouncementLagDays: 45,
  /** Only attach QOQ/YOY fundamentals when price is within this % of buy price */
  fundamentalsPriceBandPct: 15,
};
