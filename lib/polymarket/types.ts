export interface Market {
  id: string;
  question: string;
  slug: string;
  outcomes: string[];
  outcomePrices: number[];
  volume: number;
  liquidity: number;
  endDate: string;
  clobTokenIds: string[];
  active: boolean;
  tags: string[];
  description: string;
}

export interface TradingSignal {
  marketId: string;
  question: string;
  outcome: string;
  tokenId: string;
  currentPrice: number;
  fairValue: number;
  edge: number;
  confidence: number;
  reasoning: string;
  recommendation: "buy" | "sell" | "hold";
  suggestedSize: number;
}

export interface PaperTrade {
  id: string;
  timestamp: string;
  marketId: string;
  question: string;
  outcome: string;
  side: "buy" | "sell";
  price: number;
  size: number;
  signal: TradingSignal;
}

export interface Position {
  marketId: string;
  question: string;
  outcome: string;
  tokenId: string;
  entryPrice: number;
  currentPrice: number;
  size: number;
  unrealizedPnL: number;
  entryTimestamp: string;
}

export interface PortfolioState {
  positions: Position[];
  trades: PaperTrade[];
  cashBalance: number;
}

export interface GammaEvent {
  id: string;
  slug: string;
  title: string;
  description: string;
  markets: GammaMarket[];
  volume: number;
  liquidity: number;
  endDate: string;
  active: boolean;
  closed: boolean;
  tags: Array<{ slug: string; label: string }>;
}

export interface GammaMarket {
  id: string;
  question: string;
  slug: string;
  outcomes: string;
  outcomePrices: string;
  volume: string;
  liquidity: string;
  endDate: string;
  clobTokenIds: string;
  active: boolean;
  closed: boolean;
  description: string;
}

export interface RiskDecision {
  approved: boolean;
  size: number;
  reason?: string;
}

export interface ScanConfig {
  scanLimit: number;
  minVolume: number;
}

export interface RiskConfig {
  maxPositionSize: number;
  maxTotalExposure: number;
  minEdge: number;
  minConfidence: number;
}
