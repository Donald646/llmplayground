import { NextResponse } from "next/server";
import { scanMarkets } from "@/lib/polymarket/scanner";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const limit = Number(searchParams.get("limit") ?? "20");

  try {
    const markets = await scanMarkets({
      scanLimit: limit,
      minVolume: 10000,
    });
    return NextResponse.json(markets);
  } catch (err) {
    return NextResponse.json(
      { error: String(err) },
      { status: 500 },
    );
  }
}
