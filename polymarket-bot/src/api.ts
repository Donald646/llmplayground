import type { GammaEvent, GammaMarket } from "./types.js";
import { logger } from "./logger.js";

const GAMMA_BASE = "https://gamma-api.polymarket.com";
const CLOB_BASE = "https://clob.polymarket.com";

async function gammaGet<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(path, GAMMA_BASE);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
  }
  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`Gamma API error: ${res.status} ${res.statusText} for ${url}`);
  }
  return res.json() as Promise<T>;
}

async function clobGet<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(path, CLOB_BASE);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
  }
  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`CLOB API error: ${res.status} ${res.statusText} for ${url}`);
  }
  return res.json() as Promise<T>;
}

export async function fetchActiveEvents(limit = 20, offset = 0): Promise<GammaEvent[]> {
  logger.info(`Fetching active events (limit=${limit}, offset=${offset})`);
  return gammaGet<GammaEvent[]>("/events", {
    active: "true",
    closed: "false",
    limit: String(limit),
    offset: String(offset),
    order: "volume",
    ascending: "false",
  });
}

export async function fetchEventBySlug(slug: string): Promise<GammaEvent> {
  return gammaGet<GammaEvent>(`/events/slug/${slug}`);
}

export async function fetchMarketBySlug(slug: string): Promise<GammaMarket> {
  return gammaGet<GammaMarket>(`/markets/slug/${slug}`);
}

export async function fetchMarketById(id: string): Promise<GammaMarket> {
  return gammaGet<GammaMarket>(`/markets/${id}`);
}

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

export async function fetchMidpoint(tokenId: string): Promise<number> {
  const data = await clobGet<{ mid: string }>("/midpoint", {
    token_id: tokenId,
  });
  return Number(data.mid);
}

export async function fetchOrderBook(tokenId: string): Promise<ClobOrderBook> {
  return clobGet<ClobOrderBook>("/book", { token_id: tokenId });
}
