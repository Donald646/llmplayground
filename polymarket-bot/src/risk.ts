import type { TradingSignal, PortfolioState } from "./types.js";
import type { Config } from "./config.js";
import { logger } from "./logger.js";

export interface RiskDecision {
  approved: boolean;
  size: number;
  reason?: string;
}

export function evaluateSignal(
  signal: TradingSignal,
  portfolio: PortfolioState,
  config: Config,
): RiskDecision {
  // Skip hold signals
  if (signal.recommendation === "hold") {
    return { approved: false, size: 0, reason: "Hold recommendation" };
  }

  // Minimum edge check
  if (signal.edge < config.minEdge) {
    return {
      approved: false,
      size: 0,
      reason: `Edge ${(signal.edge * 100).toFixed(1)}% below threshold ${(config.minEdge * 100).toFixed(1)}%`,
    };
  }

  // Minimum confidence check
  if (signal.confidence < config.minConfidence) {
    return {
      approved: false,
      size: 0,
      reason: `Confidence ${(signal.confidence * 100).toFixed(1)}% below threshold ${(config.minConfidence * 100).toFixed(1)}%`,
    };
  }

  // Check if already in this market
  const existingPosition = portfolio.positions.find(
    (p) => p.marketId === signal.marketId,
  );
  if (existingPosition) {
    return {
      approved: false,
      size: 0,
      reason: `Already have position in market ${signal.marketId}`,
    };
  }

  // Calculate total current exposure
  const totalExposure = portfolio.positions.reduce(
    (sum, p) => sum + p.size * p.entryPrice,
    0,
  );

  // Check total exposure limit
  const remainingExposure = config.maxTotalExposure - totalExposure;
  if (remainingExposure <= 0) {
    return {
      approved: false,
      size: 0,
      reason: `Total exposure limit reached ($${totalExposure.toFixed(2)} / $${config.maxTotalExposure})`,
    };
  }

  // Kelly criterion position sizing
  // f* = (p * b - q) / b where p = win prob, q = lose prob, b = odds
  // Simplified: f* = edge / (1 - currentPrice) for buying
  const odds = (1 - signal.currentPrice) / signal.currentPrice;
  const kellyFraction = signal.edge / (1 - signal.currentPrice);
  // Use half-Kelly for safety, scaled by confidence
  const adjustedFraction = kellyFraction * 0.5 * signal.confidence;

  // Size in dollars
  let size = adjustedFraction * config.maxTotalExposure;

  // Apply caps
  size = Math.min(size, config.maxPositionSize);
  size = Math.min(size, remainingExposure);
  size = Math.max(size, 1); // Minimum $1 trade

  // Round to 2 decimal places
  size = Math.round(size * 100) / 100;

  logger.info(`Risk approved: $${size} (Kelly=${(kellyFraction * 100).toFixed(1)}%, adj=${(adjustedFraction * 100).toFixed(1)}%)`, {
    edge: signal.edge,
    confidence: signal.confidence,
    odds,
  });

  return { approved: true, size };
}
