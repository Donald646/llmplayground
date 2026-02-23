import { streamText, generateText, tool, stepCountIs } from "ai";
import { gateway } from "@ai-sdk/gateway";
import { z } from "zod";
import type { MatchRequest } from "@/lib/games/types";
import { models } from "@/lib/games/types";
import { getPlayerPrompt } from "@/lib/games/prompts";

export const maxDuration = 120;

function getModelName(id: string): string {
  return models.find((m) => m.id === id)?.name ?? id;
}

function getGameDescription(gameType: string): string {
  switch (gameType) {
    case "trivia":
      return "a trivia battle. Come up with a challenging but fair knowledge question, have both contestants answer, then judge their accuracy.";
    case "debate":
      return "a debate. Pick a debatable topic, assign one contestant to argue FOR and the other AGAINST, have them argue, then judge the quality of their arguments.";
    case "word-games":
      return "a creative word game. Pick one: rhyme battle (write a 4-line verse), word association chain (10 words), or acronym expansion (make up a 4-letter acronym). Have both contestants compete, then judge creativity.";
    default:
      return "a trivia battle.";
  }
}

export async function POST(req: Request) {
  const { gameType, modelA, modelB }: MatchRequest = await req.json();

  const nameA = getModelName(modelA);
  const nameB = getModelName(modelB);

  const result = streamText({
    model: gateway("google/gemini-2.5-pro"),
    system: `You are an entertaining game master hosting ${getGameDescription(gameType)}

Contestant A is "${nameA}" and Contestant B is "${nameB}".

Follow these steps:
1. Present the challenge clearly
2. Call the getResponse tool for contestant "A", then for contestant "B"
3. Present and compare both responses
4. Declare a winner with scores out of 10

IMPORTANT: End your response with EXACTLY this JSON on its own line (no markdown, no code block):
RESULT:{"winner":"A","scoreA":7,"scoreB":5,"reasoning":"Your brief reasoning"}
The winner must be "A", "B", or "draw".`,
    prompt: "Begin the match!",
    tools: {
      getResponse: tool({
        description:
          "Get a contestant's response to the challenge. Call this once for contestant A and once for contestant B.",
        inputSchema: z.object({
          contestant: z
            .enum(["A", "B"])
            .describe("Which contestant to get a response from"),
          challenge: z
            .string()
            .describe("The challenge or question to present"),
        }),
        execute: async ({ contestant, challenge }) => {
          const modelId = contestant === "A" ? modelA : modelB;
          const modelName = contestant === "A" ? nameA : nameB;
          const { text } = await generateText({
            model: gateway(modelId),
            system: getPlayerPrompt(gameType),
            prompt: challenge,
          });
          return { contestant, model: modelName, response: text };
        },
      }),
    },
    stopWhen: stepCountIs(5),
  });

  return result.toTextStreamResponse();
}
