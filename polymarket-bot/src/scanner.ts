import type { Market } from "./types.js";
import type { Config } from "./config.js";
import { fetchActiveEvents } from "./api.js";
import { parseGammaMarket, isMarketTradeable as libIsMarketTradeable } from "../../lib/polymarket/scanner";
import { logger } from "./logger.js";

// Re-export for use in index.ts
export { parseGammaMarket };

function isMarketTradeable(market: Market, config: Config): boolean {
  return libIsMarketTradeable(market, config.minVolume);
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
