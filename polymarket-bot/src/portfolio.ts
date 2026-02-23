import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import type { PortfolioState, Position, PaperTrade } from "./types.js";
import { fetchMidpoint } from "./api.js";
import { logger } from "./logger.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", "data");
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
    return { ...DEFAULT_PORTFOLIO };
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

  // Add trade to history
  portfolio.trades.push(trade);

  // Update cash
  if (trade.side === "buy") {
    portfolio.cashBalance -= cost;
  } else {
    portfolio.cashBalance += cost;
  }

  // Add or update position
  const existing = portfolio.positions.findIndex(
    (p) => p.marketId === trade.marketId && p.outcome === trade.outcome,
  );

  if (existing >= 0 && trade.side === "sell") {
    // Close position
    portfolio.positions.splice(existing, 1);
  } else if (trade.side === "buy") {
    portfolio.positions.push({
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

  return portfolio;
}

export async function refreshPositionPrices(
  portfolio: PortfolioState,
): Promise<PortfolioState> {
  for (const position of portfolio.positions) {
    try {
      const mid = await fetchMidpoint(position.tokenId);
      position.currentPrice = mid;
      position.unrealizedPnL = (mid - position.entryPrice) * position.size;
    } catch (err) {
      logger.warn(`Failed to refresh price for ${position.marketId}: ${err}`);
    }
  }
  return portfolio;
}

export function getPortfolioSummary(portfolio: PortfolioState): string {
  const totalUnrealized = portfolio.positions.reduce(
    (sum, p) => sum + p.unrealizedPnL,
    0,
  );
  const totalInvested = portfolio.positions.reduce(
    (sum, p) => sum + p.entryPrice * p.size,
    0,
  );
  const totalValue = portfolio.cashBalance + totalInvested + totalUnrealized;

  const lines = [
    "=== Portfolio Summary ===",
    `Cash: $${portfolio.cashBalance.toFixed(2)}`,
    `Invested: $${totalInvested.toFixed(2)}`,
    `Unrealized P&L: $${totalUnrealized >= 0 ? "+" : ""}${totalUnrealized.toFixed(2)}`,
    `Total Value: $${totalValue.toFixed(2)}`,
    `Open Positions: ${portfolio.positions.length}`,
    `Total Trades: ${portfolio.trades.length}`,
  ];

  if (portfolio.positions.length > 0) {
    lines.push("", "--- Open Positions ---");
    for (const pos of portfolio.positions) {
      const pnl = pos.unrealizedPnL;
      const pnlStr = `${pnl >= 0 ? "+" : ""}$${pnl.toFixed(2)}`;
      lines.push(
        `  ${pos.question.slice(0, 50)}...`,
        `    ${pos.outcome} | Entry: $${pos.entryPrice.toFixed(3)} | Now: $${pos.currentPrice.toFixed(3)} | Size: ${pos.size} | P&L: ${pnlStr}`,
      );
    }
  }

  return lines.join("\n");
}
