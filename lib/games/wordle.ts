import type { TileFeedback, WordleGuess, ChatMessage } from "./wordle-types";

export function computeFeedback(guess: string, secret: string): TileFeedback[] {
  const g = guess.toUpperCase().split("");
  const s = secret.toUpperCase().split("");
  const result: TileFeedback[] = new Array(5).fill("absent");
  const consumed: boolean[] = new Array(5).fill(false);

  for (let i = 0; i < 5; i++) {
    if (g[i] === s[i]) {
      result[i] = "correct";
      consumed[i] = true;
    }
  }

  for (let i = 0; i < 5; i++) {
    if (result[i] === "correct") continue;
    for (let j = 0; j < 5; j++) {
      if (!consumed[j] && g[i] === s[j]) {
        result[i] = "present";
        consumed[j] = true;
        break;
      }
    }
  }

  return result;
}

export function isValidGuess(word: string): boolean {
  return /^[a-zA-Z]{5}$/.test(word);
}

export function formatBoardForPrompt(guesses: WordleGuess[]): string {
  if (guesses.length === 0) return "(no guesses yet)";
  return guesses
    .map((g, i) => {
      const letters = g.word.split("").join(" ");
      const fb = g.feedback
        .map((f) =>
          f === "correct" ? "🟩" : f === "present" ? "🟨" : "⬛"
        )
        .join("");
      return `Round ${i + 1}: ${letters} → ${fb}`;
    })
    .join("\n");
}

export function formatChatForPrompt(chatHistory: ChatMessage[]): string {
  if (chatHistory.length === 0) return "(no messages yet)";
  return chatHistory
    .map((m) => `[Round ${m.round}] ${m.modelName}: ${m.text}`)
    .join("\n");
}
