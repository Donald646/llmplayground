import "dotenv/config";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import type { LanguageModel } from "ai";

export interface Config {
  aiProvider: string;
  aiModel: string;
  tradingMode: "paper" | "live";
  maxPositionSize: number;
  maxTotalExposure: number;
  minEdge: number;
  minConfidence: number;
  minVolume: number;
  scanIntervalMinutes: number;
  scanLimit: number;
  polymarketPrivateKey?: string;
  polymarketFunderAddress?: string;
  polymarketSignatureType: number;
}

function env(key: string, fallback?: string): string {
  const val = process.env[key] ?? fallback;
  if (val === undefined) {
    throw new Error(`Missing required env var: ${key}`);
  }
  return val;
}

export function loadConfig(): Config {
  return {
    aiProvider: env("AI_PROVIDER", "anthropic"),
    aiModel: env("AI_MODEL", "claude-sonnet-4-20250514"),
    tradingMode: env("TRADING_MODE", "paper") as "paper" | "live",
    maxPositionSize: Number(env("MAX_POSITION_SIZE", "50")),
    maxTotalExposure: Number(env("MAX_TOTAL_EXPOSURE", "500")),
    minEdge: Number(env("MIN_EDGE", "0.05")),
    minConfidence: Number(env("MIN_CONFIDENCE", "0.6")),
    minVolume: Number(env("MIN_VOLUME", "10000")),
    scanIntervalMinutes: Number(env("SCAN_INTERVAL_MINUTES", "30")),
    scanLimit: Number(env("SCAN_LIMIT", "20")),
    polymarketPrivateKey: process.env.POLYMARKET_PRIVATE_KEY,
    polymarketFunderAddress: process.env.POLYMARKET_FUNDER_ADDRESS,
    polymarketSignatureType: Number(env("POLYMARKET_SIGNATURE_TYPE", "0")),
  };
}

const DEFAULT_MODELS: Record<string, string> = {
  anthropic: "claude-sonnet-4-20250514",
  openai: "gpt-4o",
  google: "gemini-2.5-flash",
};

export function getModel(config: Config): LanguageModel {
  const modelId = config.aiModel || DEFAULT_MODELS[config.aiProvider] || config.aiModel;

  switch (config.aiProvider) {
    case "anthropic": {
      const provider = createAnthropic();
      return provider(modelId);
    }
    case "openai": {
      const provider = createOpenAI();
      return provider(modelId);
    }
    case "google": {
      const provider = createGoogleGenerativeAI();
      return provider(modelId);
    }
    default:
      throw new Error(`Unknown AI provider: ${config.aiProvider}. Use: anthropic, openai, google`);
  }
}
