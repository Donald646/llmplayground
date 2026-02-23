export type GameType = "trivia" | "debate" | "word-games";

export interface Model {
  id: string;
  name: string;
}

export const models: Model[] = [
  { id: "google/gemini-2.5-flash", name: "Gemini 2.5 Flash" },
  { id: "google/gemini-2.5-pro", name: "Gemini 2.5 Pro" },
  { id: "anthropic/claude-sonnet-4.5", name: "Claude Sonnet 4.5" },
  { id: "openai/gpt-4o", name: "GPT-4o" },
  { id: "xai/grok-4.1-fast-non-reasoning", name: "Grok 4.1 Fast" },
  { id: "meta-llama/llama-4-maverick", name: "Llama 4 Maverick" },
];

export interface MatchRequest {
  gameType: GameType;
  modelA: string;
  modelB: string;
}

export interface MatchResponse {
  gameType: GameType;
  topic: string;
  modelA: { id: string; name: string; response: string };
  modelB: { id: string; name: string; response: string };
  judgment: {
    winner: "modelA" | "modelB" | "draw";
    reasoning: string;
    scoreA: number;
    scoreB: number;
  };
}

export interface MatchPairing {
  modelA: Model;
  modelB: Model;
}

export interface MatchResult {
  pairing: MatchPairing;
  response: MatchResponse | null;
  status: "pending" | "running" | "complete" | "error";
  error?: string;
}

export interface Standing {
  model: Model;
  wins: number;
  losses: number;
  draws: number;
  points: number;
  totalScore: number;
  matchesPlayed: number;
}
