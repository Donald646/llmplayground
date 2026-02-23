import { loadConfig } from "./config.js";
import { scanMarkets } from "./scanner.js";
import { analyzeMarket, analyzeMarkets } from "./analyst.js";
import { evaluateSignal } from "./risk.js";
import { executeTrade } from "./trader.js";
import {
  loadPortfolio,
  savePortfolio,
  refreshPositionPrices,
  getPortfolioSummary,
} from "./portfolio.js";
import { fetchEventBySlug } from "./api.js";
import { logger } from "./logger.js";
import type { Market, GammaEvent } from "./types.js";

function parseGammaMarketFromEvent(event: GammaEvent): Market[] {
  const markets: Market[] = [];
  if (!event.markets) return markets;

  for (const gm of event.markets) {
    try {
      const outcomes = JSON.parse(gm.outcomes) as string[];
      const outcomePrices = JSON.parse(gm.outcomePrices) as string[];
      const clobTokenIds = JSON.parse(gm.clobTokenIds) as string[];
      if (outcomes.length !== 2 || clobTokenIds.length !== 2) continue;

      markets.push({
        id: gm.id,
        question: gm.question,
        slug: gm.slug,
        outcomes,
        outcomePrices: outcomePrices.map(Number),
        volume: Number(gm.volume),
        liquidity: Number(gm.liquidity),
        endDate: gm.endDate,
        clobTokenIds,
        active: gm.active,
        tags: event.tags?.map((t) => t.label) ?? [],
        description: gm.description || event.description || "",
      });
    } catch {
      // skip unparseable markets
    }
  }
  return markets;
}

async function runScan() {
  const config = loadConfig();
  const markets = await scanMarkets(config);

  console.log(`\nFound ${markets.length} tradeable markets:\n`);
  for (const m of markets) {
    const yesPrice = m.outcomePrices[0];
    console.log(
      `  ${m.question.slice(0, 70).padEnd(72)} Yes: ${(yesPrice * 100).toFixed(1).padStart(5)}%  Vol: $${(m.volume / 1000).toFixed(0)}k`,
    );
  }
}

async function runAnalyze(slug: string) {
  const config = loadConfig();

  logger.info(`Fetching event: ${slug}`);
  const event = await fetchEventBySlug(slug);
  const markets = parseGammaMarketFromEvent(event);

  if (markets.length === 0) {
    logger.error("No binary markets found for this event");
    return;
  }

  for (const market of markets) {
    const signal = await analyzeMarket(market, config);
    console.log(`\n=== Analysis: ${market.question} ===`);
    console.log(`Current Yes price: ${(market.outcomePrices[0] * 100).toFixed(1)}%`);
    console.log(`AI fair value: ${(signal.fairValue * 100).toFixed(1)}%`);
    console.log(`Edge: ${(signal.edge * 100).toFixed(1)}%`);
    console.log(`Confidence: ${(signal.confidence * 100).toFixed(1)}%`);
    console.log(`Recommendation: ${signal.recommendation}`);
    console.log(`Reasoning: ${signal.reasoning}`);
  }
}

async function runCycle() {
  const config = loadConfig();
  let portfolio = loadPortfolio();

  // 1. Scan markets
  const markets = await scanMarkets(config);
  if (markets.length === 0) {
    logger.warn("No tradeable markets found");
    return;
  }

  // 2. Analyze markets with AI
  const signals = await analyzeMarkets(markets, config);

  // 3. Evaluate signals and execute trades
  let tradesExecuted = 0;
  for (const signal of signals) {
    const decision = evaluateSignal(signal, portfolio, config);
    if (decision.approved) {
      signal.suggestedSize = decision.size;
      portfolio = await executeTrade(signal, decision.size, portfolio, config);
      tradesExecuted++;
    }
  }

  // 4. Refresh position prices
  if (portfolio.positions.length > 0) {
    portfolio = await refreshPositionPrices(portfolio);
    savePortfolio(portfolio);
  }

  // 5. Print summary
  console.log(`\n${getPortfolioSummary(portfolio)}`);
  logger.info(
    `Cycle complete: ${markets.length} markets scanned, ${signals.length} analyzed, ${tradesExecuted} trades executed`,
  );
}

async function runLoop() {
  const config = loadConfig();
  logger.info(`Starting bot in ${config.tradingMode.toUpperCase()} mode`);
  logger.info(`AI: ${config.aiProvider}/${config.aiModel}`);
  logger.info(`Scan interval: ${config.scanIntervalMinutes} minutes`);

  while (true) {
    try {
      await runCycle();
    } catch (err) {
      logger.error(`Cycle failed: ${err}`);
    }

    logger.info(
      `Next scan in ${config.scanIntervalMinutes} minutes...`,
    );
    await new Promise((resolve) =>
      setTimeout(resolve, config.scanIntervalMinutes * 60 * 1000),
    );
  }
}

async function showPortfolio() {
  let portfolio = loadPortfolio();

  if (portfolio.positions.length > 0) {
    logger.info("Refreshing position prices...");
    portfolio = await refreshPositionPrices(portfolio);
    savePortfolio(portfolio);
  }

  console.log(`\n${getPortfolioSummary(portfolio)}`);

  if (portfolio.trades.length > 0) {
    console.log("\n--- Recent Trades ---");
    const recent = portfolio.trades.slice(-10);
    for (const t of recent) {
      console.log(
        `  ${t.timestamp.slice(0, 19)} | ${t.side.toUpperCase()} ${t.size} "${t.outcome}" @ $${t.price.toFixed(3)} | ${t.question.slice(0, 40)}...`,
      );
    }
  }
}

// CLI
const command = process.argv[2];
const arg = process.argv[3];

switch (command) {
  case "scan":
    runScan().catch(console.error);
    break;
  case "analyze":
    if (!arg) {
      console.error("Usage: tsx src/index.ts analyze <event-slug>");
      console.error('Example: tsx src/index.ts analyze "will-bitcoin-hit-100k"');
      process.exit(1);
    }
    runAnalyze(arg).catch(console.error);
    break;
  case "run":
    runLoop().catch(console.error);
    break;
  case "portfolio":
    showPortfolio().catch(console.error);
    break;
  default:
    console.log(`Polymarket AI Trading Bot

Usage:
  tsx src/index.ts scan              Scan and list tradeable markets
  tsx src/index.ts analyze <slug>    Analyze a specific event
  tsx src/index.ts run               Start continuous trading loop
  tsx src/index.ts portfolio         Show portfolio and positions

Config via .env (see .env.example)`);
}
