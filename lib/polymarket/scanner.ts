import type { Market, GammaEvent, GammaMarket, ScanConfig } from "./types";
import { fetchActiveEvents } from "./api";

function parseGammaMarket(gm: GammaMarket, event: GammaEvent): Market | null {
  try {
    const outcomes = JSON.parse(gm.outcomes) as string[];
    const outcomePrices = JSON.parse(gm.outcomePrices) as string[];
    const clobTokenIds = JSON.parse(gm.clobTokenIds) as string[];

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

function isMarketTradeable(market: Market, minVolume: number): boolean {
  if (!market.active) return false;
  if (market.volume < minVolume) return false;

  const endDate = new Date(market.endDate);
  const hoursUntilEnd = (endDate.getTime() - Date.now()) / (1000 * 60 * 60);
  if (hoursUntilEnd < 24) return false;

  const yesPrice = market.outcomePrices[0];
  if (yesPrice < 0.05 || yesPrice > 0.95) return false;

  return true;
}

export async function scanMarkets(config: ScanConfig): Promise<Market[]> {
  const events = await fetchActiveEvents(config.scanLimit);
  const markets: Market[] = [];

  for (const event of events) {
    if (!event.markets) continue;
    for (const gm of event.markets) {
      const market = parseGammaMarket(gm, event);
      if (market && isMarketTradeable(market, config.minVolume)) {
        markets.push(market);
      }
    }
  }

  markets.sort((a, b) => b.volume - a.volume);
  return markets;
}
