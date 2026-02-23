import type { Market, GammaEvent, GammaMarket } from "./types.js";
import type { Config } from "./config.js";
import { fetchActiveEvents } from "./api.js";
import { logger } from "./logger.js";

function parseGammaMarket(gm: GammaMarket, event: GammaEvent): Market | null {
  try {
    const outcomes = JSON.parse(gm.outcomes) as string[];
    const outcomePrices = JSON.parse(gm.outcomePrices) as string[];
    const clobTokenIds = JSON.parse(gm.clobTokenIds) as string[];

    // Only handle binary (Yes/No) markets
    if (outcomes.length !== 2) return null;
    if (!clobTokenIds || clobTokenIds.length !== 2) return null;

    return {
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
    };
  } catch {
    return null;
  }
}

function isMarketTradeable(market: Market, config: Config): boolean {
  // Must be active
  if (!market.active) return false;

  // Must have sufficient volume
  if (market.volume < config.minVolume) return false;

  // Must not be resolving within 24 hours
  const endDate = new Date(market.endDate);
  const hoursUntilEnd = (endDate.getTime() - Date.now()) / (1000 * 60 * 60);
  if (hoursUntilEnd < 24) return false;

  // Prices must be between 5% and 95% (avoid near-certain markets)
  const yesPrice = market.outcomePrices[0];
  if (yesPrice < 0.05 || yesPrice > 0.95) return false;

  return true;
}

export async function scanMarkets(config: Config): Promise<Market[]> {
  logger.info("Scanning active markets...");

  const events = await fetchActiveEvents(config.scanLimit);
  logger.info(`Fetched ${events.length} events`);

  const markets: Market[] = [];

  for (const event of events) {
    if (!event.markets) continue;
    for (const gm of event.markets) {
      const market = parseGammaMarket(gm, event);
      if (market && isMarketTradeable(market, config)) {
        markets.push(market);
      }
    }
  }

  // Sort by volume descending
  markets.sort((a, b) => b.volume - a.volume);

  logger.info(`Found ${markets.length} tradeable markets`);
  return markets;
}
