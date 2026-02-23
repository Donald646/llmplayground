import type { TradingSignal, PortfolioState, RiskDecision, RiskConfig } from "./types";

export function evaluateSignal(
  signal: TradingSignal,
  portfolio: PortfolioState,
  config: RiskConfig,
): RiskDecision {
  if (signal.recommendation === "hold") {
    return { approved: false, size: 0, reason: "Hold recommendation" };
  }

  if (signal.edge < config.minEdge) {
    return {
      approved: false,
      size: 0,
      reason: `Edge ${(signal.edge * 100).toFixed(1)}% below threshold ${(config.minEdge * 100).toFixed(1)}%`,
    };
  }

  if (signal.confidence < config.minConfidence) {
    return {
      approved: false,
      size: 0,
      reason: `Confidence ${(signal.confidence * 100).toFixed(1)}% below threshold ${(config.minConfidence * 100).toFixed(1)}%`,
    };
  }

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

  const totalExposure = portfolio.positions.reduce(
    (sum, p) => sum + p.size * p.entryPrice,
    0,
  );

  const remainingExposure = config.maxTotalExposure - totalExposure;
  if (remainingExposure <= 0) {
    return {
      approved: false,
      size: 0,
      reason: `Total exposure limit reached ($${totalExposure.toFixed(2)} / $${config.maxTotalExposure})`,
    };
  }

  const kellyFraction = signal.edge / (1 - signal.currentPrice);
  const adjustedFraction = kellyFraction * 0.5 * signal.confidence;

  let size = adjustedFraction * config.maxTotalExposure;
  size = Math.min(size, config.maxPositionSize);
  size = Math.min(size, remainingExposure);
  size = Math.max(size, 1);
  size = Math.round(size * 100) / 100;

  return { approved: true, size };
}
