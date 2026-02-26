import { generateText, Output } from "ai";
import { gateway } from "@ai-sdk/gateway";
import { z } from "zod";
import type { SharedTurnRequest, SharedTurnResponse } from "@/lib/games/wordle-types";
import { formatChatForPrompt } from "@/lib/games/wordle";
import {
  getSharedWordleSystemPrompt,
  formatSharedBoardForPrompt,
  buildSharedTurnPrompt,
} from "@/lib/games/wordle-shared-prompts";

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
    const body: SharedTurnRequest = await req.json();

    const systemPrompt = getSharedWordleSystemPrompt(
      body.modelName,
      body.opponentModelName
    );

    const prompt = buildSharedTurnPrompt(
      formatSharedBoardForPrompt(body.board),
      formatChatForPrompt(body.chatHistory),
      body.round,
      body.totalRounds
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

    const response: SharedTurnResponse = {
      guess: output.guess.toUpperCase().slice(0, 5),
      message: output.message ?? "",
    };

    return Response.json(response);
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
