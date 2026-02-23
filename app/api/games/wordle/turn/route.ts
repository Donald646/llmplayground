import { generateText, Output } from "ai";
import { gateway } from "@ai-sdk/gateway";
import { z } from "zod";
import type { WordleTurnRequest, WordleTurnResponse } from "@/lib/games/wordle-types";
import { formatBoardForPrompt, formatChatForPrompt } from "@/lib/games/wordle";
import {
  getWordleSystemPrompt,
  buildTurnPrompt,
} from "@/lib/games/wordle-prompts";

export const maxDuration = 30;

const turnSchema = z.object({
  guess: z
    .string()
    .describe("Your 5-letter word guess. Must be a real English word."),
  message: z
    .string()
    .describe(
      "Optional chat message to your opponent. Empty string if you have nothing to say."
    ),
});

export async function POST(req: Request) {
  const body: WordleTurnRequest = await req.json();

  const systemPrompt = getWordleSystemPrompt(
    body.myModelName,
    body.opponentModelName
  );

  const prompt = buildTurnPrompt(
    formatBoardForPrompt(body.myBoard),
    formatChatForPrompt(body.chatHistory),
    body.round
  );

  const { output } = await generateText({
    model: gateway(body.modelId),
    system: systemPrompt,
    prompt,
    output: Output.object({ schema: turnSchema }),
  });

  const response: WordleTurnResponse = {
    guess: (output?.guess ?? "AUDIO").toUpperCase().slice(0, 5),
    message: output?.message ?? "",
  };

  return Response.json(response);
}
