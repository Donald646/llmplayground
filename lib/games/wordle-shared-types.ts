import type { TileFeedback, WordleGuess, ChatMessage } from "./wordle-types";

export type { TileFeedback, WordleGuess, ChatMessage };

export interface SharedGuess extends WordleGuess {
  modelId: string;
  modelName: string;
}

export interface SharedBoardState {
  guesses: SharedGuess[];
  solved: boolean;
  solvedBy?: string;
}

export interface SharedTurnRequest {
  modelId: string;
  modelName: string;
  opponentModelName: string;
  board: SharedGuess[];
  chatHistory: ChatMessage[];
  round: number;
  totalRounds: number;
}

export interface SharedTurnResponse {
  guess: string;
  message: string;
}
