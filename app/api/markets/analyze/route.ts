import { NextResponse } from "next/server";
import { analyzeMarket } from "@/lib/polymarket/analyst";
import type { Market } from "@/lib/polymarket/types";

export const maxDuration = 60;

export async function POST(req: Request) {
  const { market, model } = (await req.json()) as {
    market: Market;
    model: string;
  };

  if (!market?.id || !model) {
    return NextResponse.json(
      { error: "market and model are required" },
      { status: 400 },
    );
  }

  try {
    const signal = await analyzeMarket(market, model);
    return NextResponse.json(signal);
  } catch (err) {
    return NextResponse.json(
      { error: String(err) },
      { status: 500 },
    );
  }
}
