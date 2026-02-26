import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import type { PortfolioState, PaperTrade } from "./types.js";
import { addTrade as libAddTrade } from "../../lib/polymarket/portfolio";
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

// Bot-specific: uses __dirname-relative path (lib uses process.cwd())
export function loadPortfolio(): PortfolioState {
  try {
    const raw = readFileSync(PORTFOLIO_FILE, "utf-8");
    return JSON.parse(raw) as PortfolioState;
  } catch {
    return { ...DEFAULT_PORTFOLIO };
  }
}

// Bot-specific: uses __dirname-relative path (lib uses process.cwd())
export function savePortfolio(portfolio: PortfolioState): void {
  mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(PORTFOLIO_FILE, JSON.stringify(portfolio, null, 2));
}

// Delegate to shared lib implementation
export function addTrade(
  portfolio: PortfolioState,
  trade: PaperTrade,
): PortfolioState {
  return libAddTrade(portfolio, trade);
}

// Bot-specific: includes logging on errors (lib silently keeps existing price)
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

// Bot-specific: not in shared lib
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
