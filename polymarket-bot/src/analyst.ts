import { generateText, Output } from "ai";
import { z } from "zod";
import type { Market, TradingSignal } from "./types.js";
import type { Config } from "./config.js";
import { getModel } from "./config.js";
import { logger } from "./logger.js";

const signalSchema = z.object({
  fairValue: z
    .number()
    .min(0)
    .max(1)
    .describe("Your estimated true probability of the Yes outcome (0.0 to 1.0)"),
  confidence: z
    .number()
    .min(0)
    .max(1)
    .describe("How confident you are in your estimate (0.0 to 1.0)"),
  reasoning: z
    .string()
    .describe("Brief explanation of your analysis and key factors"),
  recommendation: z
    .enum(["buy_yes", "buy_no", "hold"])
    .describe("Trading recommendation based on edge between fair value and market price"),
});

type SignalOutput = z.infer<typeof signalSchema>;

const ANALYST_SYSTEM_PROMPT = `You are a prediction market analyst. Your job is to estimate the true probability of events and identify mispriced markets.

Guidelines:
- Assess the TRUE probability of the "Yes" outcome based on available information
- Compare your estimate to the current market price
- Be well-calibrated: a 70% estimate should resolve Yes about 70% of the time
- Consider: base rates, recent news/trends, time to resolution, information quality
- Be skeptical of extreme probabilities - markets are usually somewhat efficient
- Only recommend trades when you see meaningful edge (>5% difference between fair value and market price)
- If unsure, default to "hold" - preserving capital is important

For buy_yes: you believe Yes is underpriced (your fair value > market price + edge threshold)
For buy_no: you believe No is underpriced (your fair value < market price - edge threshold)
For hold: insufficient edge or confidence to trade`;

function buildMarketPrompt(market: Market): string {
  const yesPrice = market.outcomePrices[0];
  const noPrice = market.outcomePrices[1];

  return `Analyze this prediction market:

Question: ${market.question}
${market.description ? `Description: ${market.description}\n` : ""}
Current prices:
  Yes: ${(yesPrice * 100).toFixed(1)}% ($${yesPrice.toFixed(3)})
  No: ${(noPrice * 100).toFixed(1)}% ($${noPrice.toFixed(3)})

Volume: $${market.volume.toLocaleString()}
Liquidity: $${market.liquidity.toLocaleString()}
Resolution date: ${market.endDate}
Tags: ${market.tags.join(", ") || "none"}

What is the true probability of "Yes"? Should we trade?`;
}

export async function analyzeMarket(
  market: Market,
  config: Config,
): Promise<TradingSignal> {
  const model = getModel(config);
  const yesPrice = market.outcomePrices[0];
  const noPrice = market.outcomePrices[1];

  logger.info(`Analyzing: ${market.question.slice(0, 80)}...`);

  const { output } = await generateText({
    model,
    system: ANALYST_SYSTEM_PROMPT,
    prompt: buildMarketPrompt(market),
    output: Output.object({ schema: signalSchema }),
  });

  const analysis = output as SignalOutput;

  // Determine which outcome to trade and calculate edge
  let outcome: string;
  let tokenId: string;
  let currentPrice: number;
  let edge: number;

  if (analysis.recommendation === "buy_yes") {
    outcome = "Yes";
    tokenId = market.clobTokenIds[0];
    currentPrice = yesPrice;
    edge = analysis.fairValue - yesPrice;
  } else if (analysis.recommendation === "buy_no") {
    outcome = "No";
    tokenId = market.clobTokenIds[1];
    currentPrice = noPrice;
    edge = (1 - analysis.fairValue) - noPrice;
  } else {
    outcome = "Yes";
    tokenId = market.clobTokenIds[0];
    currentPrice = yesPrice;
    edge = Math.abs(analysis.fairValue - yesPrice);
  }

  const signal: TradingSignal = {
    marketId: market.id,
    question: market.question,
    outcome,
    tokenId,
    currentPrice,
    fairValue: analysis.fairValue,
    edge,
    confidence: analysis.confidence,
    reasoning: analysis.reasoning,
    recommendation: analysis.recommendation === "hold" ? "hold" : "buy",
    suggestedSize: 0,
  };

  logger.signal(`${market.question.slice(0, 60)}`, {
    recommendation: analysis.recommendation,
    fairValue: analysis.fairValue,
    currentPrice,
    edge: Number(edge.toFixed(4)),
    confidence: analysis.confidence,
  });

  return signal;
}

export async function analyzeMarkets(
  markets: Market[],
  config: Config,
): Promise<TradingSignal[]> {
  const signals: TradingSignal[] = [];

  for (const market of markets) {
    try {
      const signal = await analyzeMarket(market, config);
      signals.push(signal);
    } catch (err) {
      logger.error(`Failed to analyze market ${market.id}: ${err}`);
    }
  }

  return signals;
}
