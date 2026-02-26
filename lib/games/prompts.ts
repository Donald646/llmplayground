import type { GameType } from "./types";

export function getTopicGeneratorPrompt(gameType: GameType): string {
  switch (gameType) {
    case "trivia":
      return `You are a trivia game host. Generate a single challenging but fair trivia question.
The question should be specific enough to have a clear best answer, but open enough that different approaches show varying quality of knowledge.
Categories: science, history, geography, technology, literature, nature. Pick one randomly.
Return ONLY the question, nothing else.`;

    case "debate":
      return `You are a debate moderator. Generate a debatable topic with reasonable arguments on both sides.
The topic should be interesting and thought-provoking but not offensive.

Format your response exactly like this:
TOPIC: [the debatable statement]
SIDE A: For
SIDE B: Against`;

    case "word-games":
      return `You are a word game host. Choose ONE of these challenges randomly:

1. RHYME BATTLE: Give a word and ask both contestants to write a creative 4-line rhyming verse using that word.
2. WORD ASSOCIATION: Give a starting word and ask contestants to create a chain of 10 word associations, where each word relates to the previous one.
3. ACRONYM GAME: Give a random made-up 4-5 letter acronym and ask contestants to create the most creative/funny expansion.

State clearly which challenge type you've chosen and the specific prompt.`;
    default: {
      const _exhaustive: never = gameType;
      throw new Error(`Unhandled game type: ${_exhaustive}`);
    }
  }
}

export function getPlayerPrompt(
  gameType: GameType,
  side?: string
): string {
  switch (gameType) {
    case "trivia":
      return `You are competing in a trivia battle. Answer the following question as accurately and thoroughly as possible. Be concise but demonstrate deep knowledge. You have one attempt.`;

    case "debate":
      return `You are participating in a debate. You must argue ${side || "your assigned side of"} the following topic. Make compelling, logical arguments with examples. Be persuasive but respectful. Structure your argument with 2-3 main points. Keep it under 200 words.`;

    case "word-games":
      return `You are competing in a creative word game. Complete the challenge with maximum creativity, cleverness, and flair. The more creative and surprising, the better.`;
    default: {
      const _exhaustive: never = gameType;
      throw new Error(`Unhandled game type: ${_exhaustive}`);
    }
  }
}

export function getJudgePrompt(gameType: GameType): string {
  const criteria: Record<GameType, string> = {
    trivia: `Evaluate each answer for:
1. Factual accuracy (most important)
2. Completeness
3. Clarity of explanation`,
    debate: `Evaluate each argument for:
1. Strength of argumentation and logic
2. Quality of evidence and examples
3. Persuasiveness and rhetoric
4. Structure and clarity
Note: Each side was assigned a position. Judge how well they argued their assigned side, not which side you agree with.`,
    "word-games": `Evaluate each response for:
1. Creativity and originality (most important)
2. Adherence to the challenge rules
3. Entertainment value and wit
4. Technical execution`,
  };

  return `You are an impartial judge. You will receive a challenge and two responses (Response A and Response B).

${criteria[gameType]}

You MUST respond with ONLY valid JSON in this exact format, no other text:
{"winner":"A","scoreA":7,"scoreB":5,"reasoning":"Brief explanation."}

The winner field must be "A", "B", or "draw". Scores are 0-10.
Be fair and impartial. You do not know which model generated which response.`;
}

export function formatJudgeInput(
  topic: string,
  responseA: string,
  responseB: string
): string {
  return `CHALLENGE:\n${topic}\n\nRESPONSE A:\n${responseA}\n\nRESPONSE B:\n${responseB}`;
}

export function parseJudgment(raw: string): {
  winner: "modelA" | "modelB" | "draw";
  reasoning: string;
  scoreA: number;
  scoreB: number;
} {
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return {
      winner: "draw",
      reasoning: "Judge failed to produce structured output.",
      scoreA: 5,
      scoreB: 5,
    };
  }
  try {
    const parsed = JSON.parse(jsonMatch[0]);
    return {
      winner:
        parsed.winner === "A"
          ? "modelA"
          : parsed.winner === "B"
            ? "modelB"
            : "draw",
      reasoning: parsed.reasoning || "No reasoning provided.",
      scoreA: Math.min(10, Math.max(0, Number(parsed.scoreA) || 5)),
      scoreB: Math.min(10, Math.max(0, Number(parsed.scoreB) || 5)),
    };
  } catch {
    return {
      winner: "draw",
      reasoning: "Judge output could not be parsed.",
      scoreA: 5,
      scoreB: 5,
    };
  }
}
