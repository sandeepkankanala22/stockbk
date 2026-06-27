import type { NextFunction, Request, Response } from 'express';
import { Router } from 'express';
import { startBacktest, getResults } from '../controllers/backtestController.js';
import { exportCsv, exportExcel } from '../controllers/exportController.js';
import { getModelInfo, predictJob, trainAndPredict, trainModel } from '../controllers/mlController.js';
import { getStatus } from '../controllers/statusController.js';
import {
  exportScannerCsv,
  exportScannerExcel,
  getScannerOptionsHandler,
  getScannerResults,
  getScannerStatus,
  searchScannerSymbolsHandler,
  startScanner,
} from '../controllers/scannerController.js';
import { simulateBacktestPortfolio, simulatePortfolio } from '../controllers/portfolioController.js';
import { resetState, uploadFile } from '../controllers/uploadController.js';
import { AppError } from '../middleware/errorHandler.js';
import { validateBacktest } from '../middleware/validateBacktest.js';
import { uploadMiddleware } from '../middleware/uploadMiddleware.js';

const router = Router();

function handleUpload(req: Request, res: Response, next: NextFunction): void {
  uploadMiddleware.single('file')(req, res, (err) => {
    if (err) {
      next(new AppError(err.message, 'INVALID_FILE', 400));
      return;
    }
    void uploadFile(req, res, next);
  });
}

router.post('/upload', handleUpload);
router.post('/backtest', validateBacktest, startBacktest);
router.get('/status', getStatus);
router.get('/results', getResults);
router.get('/export/excel', exportExcel);
router.get('/export/csv', exportCsv);
router.post('/reset', resetState);

router.get('/ml/model', getModelInfo);
router.post('/ml/train', trainModel);
router.post('/ml/predict', predictJob);
router.post('/ml/analyze', trainAndPredict);

router.get('/scanner/options', getScannerOptionsHandler);
router.get('/scanner/symbols/search', searchScannerSymbolsHandler);
router.post('/scanner/run', startScanner);
router.get('/scanner/status', getScannerStatus);
router.get('/scanner/results', getScannerResults);
router.get('/scanner/export/csv', exportScannerCsv);
router.get('/scanner/export/excel', exportScannerExcel);

router.post('/portfolio/simulate', simulatePortfolio);
router.post('/portfolio/simulate-backtest', simulateBacktestPortfolio);

export default router;
