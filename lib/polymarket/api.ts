import type { GammaEvent, GammaMarket } from "./types";

const GAMMA_BASE = "https://gamma-api.polymarket.com";
const CLOB_BASE = "https://clob.polymarket.com";

export async function gammaGet<T>(path: string, params?: Record<string, string>): Promise<T> {
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

export async function clobGet<T>(path: string, params?: Record<string, string>): Promise<T> {
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

export async function fetchMidpoint(tokenId: string): Promise<number> {
  const data = await clobGet<{ mid: string }>("/midpoint", {
    token_id: tokenId,
  });
  return Number(data.mid);
}
