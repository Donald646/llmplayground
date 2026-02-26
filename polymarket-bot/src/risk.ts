import type { TradingSignal, PortfolioState, RiskConfig } from "./types.js";
import type { Config } from "./config.js";
import { evaluateSignal as libEvaluateSignal } from "../../lib/polymarket/risk";
import { logger } from "./logger.js";

// Re-export the RiskDecision type from the lib
export type { RiskDecision } from "../../lib/polymarket/types";

export function evaluateSignal(
  signal: TradingSignal,
  portfolio: PortfolioState,
  config: Config,
): { approved: boolean; size: number; reason?: string } {
  // Extract RiskConfig fields from bot Config
  const riskConfig: RiskConfig = {
    maxPositionSize: config.maxPositionSize,
    maxTotalExposure: config.maxTotalExposure,
    minEdge: config.minEdge,
    minConfidence: config.minConfidence,
  };

  const decision = libEvaluateSignal(signal, portfolio, riskConfig);

  if (decision.approved) {
    // Kelly criterion values for logging (replicate bot-specific logging)
    const kellyFraction = signal.edge / (1 - signal.currentPrice);
    const adjustedFraction = kellyFraction * 0.5 * signal.confidence;
    const odds = (1 - signal.currentPrice) / signal.currentPrice;

    logger.info(`Risk approved: $${decision.size} (Kelly=${(kellyFraction * 100).toFixed(1)}%, adj=${(adjustedFraction * 100).toFixed(1)}%)`, {
      edge: signal.edge,
      confidence: signal.confidence,
      odds,
    });
  }

  return decision;
}
