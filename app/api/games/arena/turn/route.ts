import { generateText, Output } from "ai";
import { gateway } from "@ai-sdk/gateway";
import { NextResponse } from "next/server";
import {
  actionSchema,
  applyRound,
  buildPrompt,
  FIGHTER_SYSTEM_PROMPT,
  type GameState,
} from "@/lib/games/arena";

export const maxDuration = 30;

export async function POST(req: Request) {
  const { gameState, modelA, modelB } = (await req.json()) as {
    gameState: GameState;
    modelA: string;
    modelB: string;
  };

  try {
    const [responseA, responseB] = await Promise.all([
      generateText({
        model: gateway(modelA),
        system: FIGHTER_SYSTEM_PROMPT,
        prompt: buildPrompt(gameState, "a"),
        output: Output.object({ schema: actionSchema }),
      }),
      generateText({
        model: gateway(modelB),
        system: FIGHTER_SYSTEM_PROMPT,
        prompt: buildPrompt(gameState, "b"),
        output: Output.object({ schema: actionSchema }),
      }),
    ]);

    const actionA = responseA.output!;
    const actionB = responseB.output!;
    const { state: newState, result } = applyRound(gameState, actionA, actionB);

    return NextResponse.json({ state: newState, result });
  } catch (err) {
    return NextResponse.json(
      { error: String(err) },
      { status: 500 },
    );
  }
}
