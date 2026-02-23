import type { TradingSignal, PaperTrade, PortfolioState } from "./types.js";
import type { Config } from "./config.js";
import { addTrade, savePortfolio } from "./portfolio.js";
import { logger } from "./logger.js";

let tradeCounter = 0;

function generateTradeId(): string {
  return `paper_${Date.now()}_${++tradeCounter}`;
}

export function executePaperTrade(
  signal: TradingSignal,
  size: number,
  portfolio: PortfolioState,
): PortfolioState {
  const trade: PaperTrade = {
    id: generateTradeId(),
    timestamp: new Date().toISOString(),
    marketId: signal.marketId,
    question: signal.question,
    outcome: signal.outcome,
    side: "buy",
    price: signal.currentPrice,
    size,
    signal,
  };

  logger.trade(
    `PAPER BUY ${size} shares of "${signal.outcome}" @ $${signal.currentPrice.toFixed(3)}`,
    {
      market: signal.question.slice(0, 60),
      edge: `${(signal.edge * 100).toFixed(1)}%`,
      confidence: `${(signal.confidence * 100).toFixed(1)}%`,
      cost: `$${(signal.currentPrice * size).toFixed(2)}`,
    },
  );

  const updated = addTrade(portfolio, trade);
  savePortfolio(updated);
  return updated;
}

export async function executeLiveTrade(
  signal: TradingSignal,
  size: number,
  config: Config,
): Promise<string> {
  if (!config.polymarketPrivateKey) {
    throw new Error("POLYMARKET_PRIVATE_KEY required for live trading");
  }

  // Dynamic import to avoid requiring the dependency when paper trading
  const { ClobClient } = await import("@polymarket/clob-client");
  const { Wallet } = await import("ethers");

  const signer = new Wallet(config.polymarketPrivateKey);
  const client = new ClobClient(
    "https://clob.polymarket.com",
    137,
    signer,
    undefined,
    config.polymarketSignatureType,
    config.polymarketFunderAddress,
  );

  // Derive API credentials
  const creds = await client.createOrDeriveApiKey();
  client.setCreds(creds);

  // Place a limit order slightly above current price for better fill
  const limitPrice = Math.min(signal.currentPrice + 0.005, 0.99);

  const response = await client.createAndPostOrder(
    {
      tokenID: signal.tokenId,
      price: limitPrice,
      side: "BUY" as any,
      size,
    },
    { tickSize: "0.01", negRisk: false },
    "GTC" as any,
  );

  logger.trade(
    `LIVE BUY ${size} shares of "${signal.outcome}" @ $${limitPrice.toFixed(3)}`,
    {
      orderId: response?.orderID,
      market: signal.question.slice(0, 60),
    },
  );

  return response?.orderID ?? "unknown";
}

export async function executeTrade(
  signal: TradingSignal,
  size: number,
  portfolio: PortfolioState,
  config: Config,
): Promise<PortfolioState> {
  if (config.tradingMode === "live") {
    await executeLiveTrade(signal, size, config);
    // For live mode, we still track in portfolio for our records
    return executePaperTrade(signal, size, portfolio);
  }
  return executePaperTrade(signal, size, portfolio);
}
