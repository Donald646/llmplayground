export type TileFeedback = "correct" | "present" | "absent";

export interface WordleGuess {
  word: string;
  feedback: TileFeedback[];
}

export interface BoardState {
  modelId: string;
  modelName: string;
  guesses: WordleGuess[];
  solved: boolean;
  solvedAtRound?: number;
  elapsed?: number;
}

export interface ChatMessage {
  modelId: string;
  modelName: string;
  text: string;
  round: number;
}

export interface WordleTurnRequest {
  modelId: string;
  myBoard: WordleGuess[];
  opponentBoard: WordleGuess[];
  chatHistory: ChatMessage[];
  round: number;
  myModelName: string;
  opponentModelName: string;
  spectator?: boolean;
}

export interface WordleTurnResponse {
  guess: string;
  message: string;
}
