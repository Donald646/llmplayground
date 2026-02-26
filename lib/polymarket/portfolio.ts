import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import type { PortfolioState, PaperTrade, TradingSignal } from "./types";
import { fetchMidpoint } from "./api";

const DATA_DIR = join(process.cwd(), "data");
const PORTFOLIO_FILE = join(DATA_DIR, "portfolio.json");

const DEFAULT_PORTFOLIO: PortfolioState = {
  positions: [],
  trades: [],
  cashBalance: 1000,
};

export function loadPortfolio(): PortfolioState {
  try {
    const raw = readFileSync(PORTFOLIO_FILE, "utf-8");
    return JSON.parse(raw) as PortfolioState;
  } catch {
    return { ...DEFAULT_PORTFOLIO, positions: [], trades: [] };
  }
}

export function savePortfolio(portfolio: PortfolioState): void {
  mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(PORTFOLIO_FILE, JSON.stringify(portfolio, null, 2));
}

export function addTrade(
  portfolio: PortfolioState,
  trade: PaperTrade,
): PortfolioState {
  const cost = trade.price * trade.size;

  const updated: PortfolioState = {
    ...portfolio,
    trades: [...portfolio.trades, trade],
    positions: [...portfolio.positions],
    cashBalance: trade.side === "buy"
      ? portfolio.cashBalance - cost
      : portfolio.cashBalance + cost,
  };

  const existing = updated.positions.findIndex(
    (p) => p.marketId === trade.marketId && p.outcome === trade.outcome,
  );

  if (existing >= 0 && trade.side === "sell") {
    updated.positions.splice(existing, 1);
  } else if (trade.side === "buy") {
    updated.positions.push({
      marketId: trade.marketId,
      question: trade.question,
      outcome: trade.outcome,
      tokenId: trade.signal.tokenId,
      entryPrice: trade.price,
      currentPrice: trade.price,
      size: trade.size,
      unrealizedPnL: 0,
      entryTimestamp: trade.timestamp,
    });
  }

  return updated;
}

let tradeCounter = 0;

export function executePaperTrade(
  signal: TradingSignal,
  size: number,
  portfolio: PortfolioState,
): PortfolioState {
  const trade: PaperTrade = {
    id: `paper_${Date.now()}_${++tradeCounter}`,
    timestamp: new Date().toISOString(),
    marketId: signal.marketId,
    question: signal.question,
    outcome: signal.outcome,
    side: "buy",
    price: signal.currentPrice,
    size,
    signal,
  };

  const updated = addTrade(portfolio, trade);
  savePortfolio(updated);
  return updated;
}

export async function refreshPositionPrices(
  portfolio: PortfolioState,
): Promise<PortfolioState> {
  const positions = portfolio.positions.map((pos) => ({ ...pos }));
  for (const position of positions) {
    try {
      const mid = await fetchMidpoint(position.tokenId);
      position.currentPrice = mid;
      position.unrealizedPnL = (mid - position.entryPrice) * position.size;
    } catch {
      // Keep existing price on error
    }
  }
  return { ...portfolio, positions };
}
