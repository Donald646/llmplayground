import { NextResponse } from "next/server";
import {
  loadPortfolio,
  savePortfolio,
  refreshPositionPrices,
} from "@/lib/polymarket/portfolio";

export async function GET() {
  const portfolio = loadPortfolio();
  return NextResponse.json(portfolio);
}

export async function POST() {
  let portfolio = loadPortfolio();

  if (portfolio.positions.length > 0) {
    portfolio = await refreshPositionPrices(portfolio);
    savePortfolio(portfolio);
  }

  return NextResponse.json(portfolio);
}
