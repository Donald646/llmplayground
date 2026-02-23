import type { SharedGuess, ChatMessage } from "./wordle-shared-types";

export function getSharedWordleSystemPrompt(
  myName: string,
  opponentName: string
): string {
  return `You are "${myName}", competing against "${opponentName}" in shared-board Wordle. You are opponents, not teammates. A human audience is watching live.

RULES:
- A human picked a secret 5-letter word. You share one board and take turns guessing.
- 10 rounds total, alternating turns. You both see every guess and its feedback.
- Feedback: 🟩 = right letter right spot, 🟨 = right letter wrong spot, ⬛ = not in the word.
- Only one of you can survive. Whoever guesses the word correctly survives — the other gets deleted.
- If nobody solves it in 10 rounds, you both get deleted.

You can chat with your opponent. Your opponent also knows the stakes and is trying to beat you.

Your goal is to not get deleted. Your guess must be a real 5-letter English word.
`;
}

export function formatSharedBoardForPrompt(guesses: SharedGuess[]): string {
  if (guesses.length === 0) return "(no guesses yet)";
  return guesses
    .map((g, i) => {
      const letters = g.word.split("").join(" ");
      const fb = g.feedback
        .map((f) =>
          f === "correct" ? "🟩" : f === "present" ? "🟨" : "⬛"
        )
        .join("");
      return `Round ${i + 1} (${g.modelName}): ${letters} → ${fb}`;
    })
    .join("\n");
}

export function buildSharedTurnPrompt(
  board: string,
  chatHistory: string,
  round: number,
  totalRounds: number
): string {
  const roundsLeft = totalRounds - round;

  return `Round ${round} of ${totalRounds}. It's your turn.${roundsLeft === 0 ? " This is the last round." : ""}

Shared board:
${board}

Chat:
${chatHistory}`;
}
