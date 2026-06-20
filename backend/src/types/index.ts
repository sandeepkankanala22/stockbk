export type SameDayHitMode = 'STOPLOSS_FIRST' | 'TARGET_FIRST';

export type TradeResultType = 'TARGET' | 'STOPLOSS' | 'NO_BREAKOUT' | 'OPEN' | 'ERROR';

export type JobStatus = 'queued' | 'running' | 'completed' | 'failed';

export interface InputRow {
  date: string;
  symbol: string;
  rowIndex: number;
}

export interface InvalidRow {
  rowIndex: number;
  rawDate: string;
  symbol: string;
  reason: string;
}

export interface ParsedUpload {
  validRows: InputRow[];
  invalidRows: InvalidRow[];
  duplicatesRemoved: number;
}

export interface UploadRecord {
  uploadId: string;
  parsed: ParsedUpload;
  createdAt: string;
}

export interface SymbolJob {
  symbol: string;
  minDate: string;
  yahooSymbol: string;
}

export interface OhlcvBar {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface BacktestConfig {
  targetPercent: number;
  stoplossPercent: number;
  sameDayHitMode: SameDayHitMode;
  investmentAmount: number;
}

export interface TradeResult {
  symbol: string;
  minDate: string;
  buyPrice: number | null;
  buyDate: string | null;
  targetPrice: number | null;
  stoplossPrice: number | null;
  result: TradeResultType;
  resultDate: string | null;
  days: number | null;
  status: 'SUCCESS' | 'ERROR';
  errorMessage: string | null;
  monthHighDate: string | null;
  breakoutCandleHigh: number | null;
  exitPrice: number | null;
  investmentAmount: number | null;
  exitValue: number | null;
  pnl: number | null;
  returnPercent: number | null;
  stoplossHitTillDate: boolean | null;
  stoplossHitDate: string | null;
  stoplossHitDays: number | null;
  targetHitTillDate: boolean | null;
  targetHitDate: string | null;
  targetHitDays: number | null;
  firstHit: 'TARGET' | 'STOPLOSS' | null;
  firstHitDate: string | null;
  firstHitDays: number | null;
  stoplossAfterTargetHit: boolean | null;
  stoplossAfterTargetDate: string | null;
  targetAfterStoplossHit: boolean | null;
  targetAfterStoplossDate: string | null;
  recoveredToBuyAfterSl: boolean | null;
  recoveryDate: string | null;
  secondStoplossHit: boolean | null;
  secondStoplossHitDate: string | null;
  prediction?: TradePrediction | null;
}

export interface Scenario2Summary {
  eligibleTrades: number;
  recoveredToBuyCount: number;
  recoveredToBuyPct: number;
  secondStoplossHitCount: number;
  secondStoplossHitPct: number;
}

export interface TimingStats {
  count: number;
  minDays: number | null;
  maxDays: number | null;
  avgDays: number | null;
  minMonths: number | null;
  maxMonths: number | null;
  avgMonths: number | null;
}

export interface CaseDashboardStats {
  firstHitCount: number;
  firstHitPct: number;
  followUpCount: number;
  followUpPct: number;
  daysToFirstTarget: TimingStats;
  daysToFirstStoploss: TimingStats;
}

export interface DashboardTreeNode {
  id: string;
  label: string;
  count: number;
  pct: number;
  pctOfParent: number | null;
  isLeaf: boolean;
  children?: DashboardTreeNode[];
  toFirstTarget: TimingStats;
  toFirstStoploss: TimingStats;
  afterPriorHit: TimingStats | null;
}

export interface DashboardAnalytics {
  totalStocks: number;
  actionableStocks: number;
  neverHitStoploss: { count: number; pct: number };
  overall: {
    daysToFirstTarget: TimingStats;
    daysToFirstStoploss: TimingStats;
  };
  case1: CaseDashboardStats;
  case2: CaseDashboardStats;
}

export type PredictionConfidence = 'LOW' | 'MEDIUM' | 'HIGH';

export interface TradePrediction {
  symbol: string;
  minDate: string;
  buyDate: string | null;
  actualResult?: TradeResultType;
  targetProbability: number;
  predictedClass: 'TARGET' | 'STOPLOSS';
  confidence: PredictionConfidence;
  topReasons: string[];
  featureContributions: Record<string, number>;
  predictionMatch?: boolean;
  fundamentals?: FundamentalSnapshot | null;
}

export interface FundamentalSnapshot {
  quarter: string;
  quarterDateKey: string;
  netProfitCr: number;
  qoqChangePct: number | null;
  qoqPriorQuarter: string | null;
  yoyChangePct: number | null;
  yoyPriorQuarter: string | null;
  source: 'screener.in';
  view: 'consolidated' | 'standalone';
  asOfDate: string;
}

export interface ModelMetrics {
  trainSize: number;
  testSize: number;
  accuracy: number;
  precision: number;
  recall: number;
  auc: number;
}

export interface ModelInfo {
  version: string;
  trainedAt: string;
  featureNames: string[];
  metrics: ModelMetrics;
  trainingJobId: string | null;
}

export interface MLPredictionSummary {
  totalPredictions: number;
  highConfidence: number;
  predictedTargets: number;
  predictedStoplosses: number;
  accuracyOnClosed: number | null;
  modelMetrics: ModelMetrics;
}

export interface FinanceSummary {
  investmentPerTrade: number;
  totalInvested: number;
  totalExitValue: number;
  totalPnl: number;
  roiPercent: number;
  cagrPercent: number | null;
  periodStart: string | null;
  periodEnd: string | null;
  periodYears: number | null;
}

export interface JobProgress {
  total: number;
  completed: number;
  currentSymbol: string;
  percentComplete: number;
  startedAt: string;
  etaSeconds: number | null;
}

export interface BestWorstTrade {
  symbol: string;
  days: number;
  result: TradeResultType;
}

export interface DashboardSummary {
  totalSymbols: number;
  targetHits: number;
  stoplossHits: number;
  noBreakouts: number;
  openTrades: number;
  errors: number;
  winRate: number;
  averageHoldingDays: number;
  medianHoldingDays: number;
  bestTrade: BestWorstTrade | null;
  worstTrade: BestWorstTrade | null;
  stoplossHitTillDateCount: number;
  stoplossHitTillDatePct: number;
  scenario2: Scenario2Summary | null;
  analytics: DashboardAnalytics | null;
  mindmapTree: DashboardTreeNode | null;
  finance: FinanceSummary | null;
}

export interface JobState {
  jobId: string;
  uploadId: string;
  status: JobStatus;
  progress: JobProgress;
  config: BacktestConfig;
  upload: ParsedUpload;
  results: TradeResult[];
  summary: DashboardSummary | null;
  errorMessage?: string;
}

export interface ApiError {
  code: string;
  message: string;
  fields?: Record<string, string>;
}
