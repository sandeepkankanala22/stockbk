import app from './app.js';
import { config } from './config/defaults.js';
import { cacheService } from './cache/cacheService.js';

async function main() {
  await cacheService.ensureDiskDir();
  const { screenerService } = await import('./services/screenerService.js');
  await screenerService.ensureCacheDir();
  app.listen(config.port, '0.0.0.0', () => {
    console.log(`NSE Backtest API running on port ${config.port}`);
  });
}

main().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
