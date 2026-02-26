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
  try {
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

    if (!output?.guess) {
      return Response.json({ error: "Model produced no guess" }, { status: 500 });
    }

    const response: WordleTurnResponse = {
      guess: output.guess.toUpperCase().slice(0, 5),
      message: output.message ?? "",
    };

    return Response.json(response);
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
