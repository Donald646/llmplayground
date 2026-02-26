import type { GammaEvent, GammaMarket } from "./types.js";
import {
  gammaGet,
  clobGet,
  fetchActiveEvents as libFetchActiveEvents,
  fetchEventBySlug,
  fetchMarketBySlug,
  fetchMidpoint,
} from "../../lib/polymarket/api";
import { logger } from "./logger.js";

// Re-export functions that are identical to the lib versions
export { fetchEventBySlug, fetchMarketBySlug, fetchMidpoint };

// Wrapper that adds logging
export async function fetchActiveEvents(limit = 20, offset = 0): Promise<GammaEvent[]> {
  logger.info(`Fetching active events (limit=${limit}, offset=${offset})`);
  return libFetchActiveEvents(limit, offset);
}

// Bot-specific: not in lib
export async function fetchMarketById(id: string): Promise<GammaMarket> {
  return gammaGet<GammaMarket>(`/markets/${id}`);
}

// Bot-specific interfaces and functions not in lib
export interface ClobPrice {
  price: string;
}

export interface ClobOrderBook {
  market: string;
  asset_id: string;
  bids: Array<{ price: string; size: string }>;
  asks: Array<{ price: string; size: string }>;
}

export async function fetchPrice(tokenId: string, side: "buy" | "sell"): Promise<number> {
  const data = await clobGet<ClobPrice>("/price", {
    token_id: tokenId,
    side: side.toUpperCase(),
  });
  return Number(data.price);
}

export async function fetchOrderBook(tokenId: string): Promise<ClobOrderBook> {
  return clobGet<ClobOrderBook>("/book", { token_id: tokenId });
}
