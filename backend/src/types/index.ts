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

export interface PricePathPoint {
  date: string;
  pct: number;
}

export interface AthEventPoint {
  date: string;
  pct: number;
}

export interface BenchmarkSeries {
  label: string;
  startDate: string;
  points: PricePathPoint[];
}

export interface SymbolDateEntry {
  date: string;
  kept: boolean;
  monthsFromMin: number;
  monthsFromLastKept: number;
  reason: string;
}

export interface SymbolDuplicateNote {
  symbol: string;
  minDate: string;
  entries: SymbolDateEntry[];
  results?: Array<{
    minDate: string;
    result: string;
    buyDate: string | null;
    pctFromBuyPrice: number | null;
  }>;
}

export interface BacktestConfig {
  targetPercent: number;
  stoplossPercent: number;
  sameDayHitMode: SameDayHitMode;
  investmentAmount: number;
  nearBuyPlusPct: number;
  nearBuyMinusPct: number;
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
  latestClosePrice: number | null;
  pctFromBuyPrice: number | null;
  distToNearBand: number | null;
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
  newAthAfterFtt: boolean | null;
  lowHitBuyAfterFtt: boolean | null;
  lowHitSlAfterFtt: boolean | null;
  targetAfterPullbackHit: boolean | null;
  targetAfterPullbackDate: string | null;
  stoplossAfterPullbackHit: boolean | null;
  stoplossAfterPullbackDate: string | null;
  firstHitAfterPullback: 'TARGET' | 'STOPLOSS' | null;
  firstHitAfterPullbackDate: string | null;
  firstHitAfterPullbackDays: number | null;
  targetAfterRecovery: boolean | null;
  newAthAfterRecoveryTarget: boolean | null;
  newAthAfterFttDate: string | null;
  lowHitBuyAfterFttDate: string | null;
  targetAfterRecoveryDate: string | null;
  newAthAfterRecoveryTargetDate: string | null;
  pricePath: PricePathPoint[] | null;
  athEvents: AthEventPoint[] | null;
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
  benchmark: BenchmarkSeries | null;
  duplicateSymbolNotes: SymbolDuplicateNote[];
  errorMessage?: string;
}

export interface ApiError {
  code: string;
  message: string;
  fields?: Record<string, string>;
}

export interface ScannerSignal {
  symbol: string;
  company: string;
  signalDate: string;
  entryPrice: number;
  currentPrice: number;
  returnPct: number;
  return3mPct: number | null;
  return6mPct: number | null;
  return12mPct: number | null;
  maxGainPct: number | null;
  maxDrawdownPct: number | null;
}

export type ScannerPeriod = '6m' | '1y' | '3y' | '5y' | 'all';

export type ScannerUniverse =
  | 'nifty100'
  | 'nifty500'
  | 'all'
  | 'us100'
  | 'bitcoin20'
  | 'commodities'
  | 'custom';

export type ScannerSector =
  | 'all'
  | 'banking'
  | 'it'
  | 'pharma'
  | 'auto'
  | 'fmcg'
  | 'energy'
  | 'metal'
  | 'infra'
  | 'realty'
  | 'telecom'
  | 'chemicals';

export interface ScannerJobState {
  jobId: string;
  period: ScannerPeriod;
  universe: ScannerUniverse;
  sector: ScannerSector;
  customSymbols?: string[];
  status: JobStatus;
  progress: JobProgress;
  signals: ScannerSignal[];
  signalsFoundCount?: number;
  errorMessage?: string;
  startedAt: string;
  completedAt?: string;
}

export type PortfolioSimulationMode = 'compound' | 'withdraw_principal';

export interface PortfolioSimConfig {
  initialCapital: number;
  maxHoldings: number;
  targetPercent: number;
  stoplossPercent: number;
}

export type PortfolioEntryType = 'breakout' | 'pullback';

export type PortfolioExitReason = 'TARGET' | 'STOPLOSS';

export interface PortfolioClosedTrade {
  symbol: string;
  entryType: PortfolioEntryType;
  buyDate: string;
  sellDate: string;
  buyPrice: number;
  sellPrice: number;
  investmentAmount: number;
  quantity: number;
  profitLoss: number;
  returnPct: number;
  holdingDays: number;
  exitReason: PortfolioExitReason;
  principalReturned: number;
}

export interface PortfolioOpenPosition {
  symbol: string;
  entryType: PortfolioEntryType;
  buyDate: string;
  buyPrice: number;
  quantity: number;
  investmentAmount: number;
  currentPrice: number;
  marketValue: number;
  unrealizedProfit: number;
  principalReturned: number;
  isRunner: boolean;
}

export interface PortfolioSimMetrics {
  mode: PortfolioSimulationMode;
  initialCapital: number;
  availableCash: number;
  portfolioValue: number;
  investedAmount: number;
  activeInvestedValue: number;
  runnerValue: number;
  idleCash: number;
  cashUtilizationPct: number;
  investmentPerStock: number;
  maxHoldings: number;
  activePositions: number;
  runnerPositions: number;
  openPositions: number;
  closedPositions: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  totalRealizedProfit: number;
  totalUnrealizedProfit: number;
  totalReturnPct: number;
  cagrPercent: number | null;
  maxDrawdownPct: number;
}

export type IgnoredBuyReason = 'insufficient_cash';

export interface PortfolioTimeSnapshot {
  date: string;
  portfolioValue: number;
  availableCash: number;
  investedAmount: number;
  activeInvestedValue: number;
  runnerValue: number;
  cashUtilizationPct: number;
  activePositions: number;
  runnerPositions: number;
  investmentPerStock: number;
  drawdownPct: number;
}

/** Month-over-month buy/exit/holding counts for portfolio simulation charts. */
export interface PortfolioMonthlyActivity {
  month: string;
  label: string;
  signalBuys: number;
  pullbackBuys: number;
  totalBuys: number;
  exits: number;
  holdings: number;
}

export interface PortfolioPerformanceSummary {
  initialCapital: number;
  finalPortfolioValue: number;
  totalReturnPct: number;
  cagrPercent: number | null;
  annualizedReturnPct: number | null;
  totalRealizedProfit: number;
  totalUnrealizedProfit: number;
  maxDrawdownPct: number;
  averageCashUtilizationPct: number;
  maxCashUtilizationPct: number;
  minCashUtilizationPct: number;
  highestPortfolioValue: number;
  largestWinningTrade: number;
  largestLosingTrade: number;
  averageHoldingDays: number;
  averageInvestmentPerStock: number;
  totalBuySignals: number;
  executedBuySignals: number;
  missedSignals: number;
}

export interface PortfolioTradeRecord {
  symbol: string;
  entryType: PortfolioEntryType;
  simulationMode: PortfolioSimulationMode;
  buyDate: string;
  buyPrice: number;
  investmentAmount: number;
  quantity: number;
  sellDate: string | null;
  sellPrice: number | null;
  principalReturned: number;
  runnerValue: number;
  realizedProfit: number;
  unrealizedProfit: number;
  returnPct: number | null;
  holdingDays: number | null;
  exitReason: PortfolioExitReason | 'OPEN' | 'RUNNER';
  isRunner: boolean;
}

export interface IgnoredBuySignal {
  symbol: string;
  entryType: PortfolioEntryType;
  entryDate: string;
  entryPrice: number;
  reason: IgnoredBuyReason;
  openPositionsAtSkip: number;
  availableCashAtSkip: number;
  requiredInvestment: number;
}

export interface PortfolioSimResult {
  metrics: PortfolioSimMetrics;
  closedTrades: PortfolioClosedTrade[];
  openPositions: PortfolioOpenPosition[];
  tradeHistory: PortfolioTradeRecord[];
  snapshots: PortfolioTimeSnapshot[];
  monthlyTimeline: PortfolioTimeSnapshot[];
  monthlyActivity: PortfolioMonthlyActivity[];
  performanceSummary: PortfolioPerformanceSummary;
  ignoredBuySignals: number;
  ignoredBuys: IgnoredBuySignal[];
  buysExecuted: number;
  totalBuySignals: number;
}

export interface PortfolioComparisonResponse {
  signalCount: number;
  simulationStart: string | null;
  simulationEnd: string | null;
  compound: PortfolioSimResult;
  withdrawPrincipal: PortfolioSimResult;
}

export interface BacktestPortfolioComparison {
  signalCount: number;
  pullbackEntryCount: number;
  combinedEntryCount: number;
  simulationStart: string | null;
  simulationEnd: string | null;
  config: PortfolioSimConfig;
  /** Case 1: breakout + pullback buys — complete exit on target or stop loss */
  case1: PortfolioSimResult;
  /** Case 2: breakout + pullback buys — withdraw principal at target */
  case2: PortfolioSimResult;
}
