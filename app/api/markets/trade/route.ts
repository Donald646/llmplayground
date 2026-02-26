import { NextResponse } from "next/server";
import { evaluateSignal } from "@/lib/polymarket/risk";
import { loadPortfolio, executePaperTrade } from "@/lib/polymarket/portfolio";
import { DEFAULT_RISK_CONFIG, type TradingSignal } from "@/lib/polymarket/types";

export async function POST(req: Request) {
  const { signal } = (await req.json()) as { signal: TradingSignal };

  if (!signal?.marketId) {
    return NextResponse.json(
      { error: "signal is required" },
      { status: 400 },
    );
  }

  const portfolio = loadPortfolio();

  const decision = evaluateSignal(signal, portfolio, DEFAULT_RISK_CONFIG);

  if (!decision.approved) {
    return NextResponse.json({
      traded: false,
      reason: decision.reason,
      portfolio,
    });
  }

  const updated = executePaperTrade(signal, decision.size, portfolio);

  return NextResponse.json({
    traded: true,
    size: decision.size,
    portfolio: updated,
  });
}
