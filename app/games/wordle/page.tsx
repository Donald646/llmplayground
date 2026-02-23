"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import Link from "next/link";
import {
  LoaderIcon,
  TrophyIcon,
  ArrowLeftIcon,
  HashIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { MessageResponse } from "@/components/ai-elements/message";
import { models } from "@/lib/games/types";
import { computeFeedback, isValidGuess } from "@/lib/games/wordle";
import type {
  TileFeedback,
  WordleGuess,
  BoardState,
  ChatMessage,
  WordleTurnRequest,
  WordleTurnResponse,
} from "@/lib/games/wordle-types";

type GameStatus = "setup" | "playing" | "finished";

function WordleTile({
  letter,
  feedback,
}: {
  letter?: string;
  feedback?: TileFeedback;
}) {
  const bg =
    feedback === "correct"
      ? "bg-green-500 text-white border-green-500"
      : feedback === "present"
        ? "bg-yellow-500 text-white border-yellow-500"
        : feedback === "absent"
          ? "bg-neutral-700 text-white border-neutral-700"
          : "border-border/50 bg-muted/20";

  return (
    <div
      className={`flex h-12 w-12 items-center justify-center rounded-lg border-2 text-base font-bold uppercase transition-colors duration-300 ${bg}`}
    >
      {letter ?? ""}
    </div>
  );
}

function WordleBoard({
  board,
  isActive,
}: {
  board: BoardState;
  isActive: boolean;
}) {
  const rows = [];
  for (let r = 0; r < 6; r++) {
    const guess = board.guesses[r];
    const cols = [];
    for (let c = 0; c < 5; c++) {
      cols.push(
        <WordleTile
          key={c}
          letter={guess?.word[c]}
          feedback={guess?.feedback[c]}
        />
      );
    }
    rows.push(
      <div key={r} className="flex gap-1.5">
        {cols}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold">{board.modelName}</span>
        {board.solved && (
          <Badge className="text-xs">
            Solved in {board.solvedAtRound}
          </Badge>
        )}
        {isActive && !board.solved && (
          <LoaderIcon size={14} className="animate-spin text-muted-foreground" />
        )}
      </div>
      <div className="flex flex-col gap-1.5">{rows}</div>
    </div>
  );
}

function ChatPanel({ messages }: { messages: ChatMessage[] }) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  return (
    <div className="flex h-full flex-col rounded-xl border border-border/50 bg-muted/20">
      <div className="border-b border-border/50 px-3 py-2">
        <span className="text-xs font-semibold">Trash Talk</span>
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-2">
        {messages.length === 0 && (
          <p className="text-xs text-muted-foreground italic">
            Models will chat here...
          </p>
        )}
        {messages.map((m, i) => (
          <div key={i} className="mb-2">
            <div className="flex items-baseline gap-1.5">
              <Badge variant="outline" className="shrink-0 text-[10px]">
                {m.modelName}
              </Badge>
              <span className="text-[10px] text-muted-foreground">
                R{m.round}
              </span>
            </div>
            <div className="mt-0.5 pl-1">
              <MessageResponse className="text-xs">
                {m.text}
              </MessageResponse>
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>
    </div>
  );
}

export default function WordlePage() {
  const [status, setStatus] = useState<GameStatus>("setup");
  const [secretWord, setSecretWord] = useState("");
  const [modelAId, setModelAId] = useState(models[0].id);
  const [modelBId, setModelBId] = useState(models[2].id);
  const [boardA, setBoardA] = useState<BoardState | null>(null);
  const [boardB, setBoardB] = useState<BoardState | null>(null);
  const [chatLog, setChatLog] = useState<ChatMessage[]>([]);
  const [winner, setWinner] = useState<string | null>(null);
  const [isThinkingA, setIsThinkingA] = useState(false);
  const [isThinkingB, setIsThinkingB] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const modelAName =
    models.find((m) => m.id === modelAId)?.name ?? modelAId;
  const modelBName =
    models.find((m) => m.id === modelBId)?.name ?? modelBId;

  const canStart =
    isValidGuess(secretWord) && modelAId !== modelBId;

  const runGame = useCallback(async () => {
    const secret = secretWord.toUpperCase();

    // Mutable board objects shared between loops (React state is for rendering)
    const bA: BoardState = {
      modelId: modelAId,
      modelName: modelAName,
      guesses: [],
      solved: false,
    };
    const bB: BoardState = {
      modelId: modelBId,
      modelName: modelBName,
      guesses: [],
      solved: false,
    };
    const chat: ChatMessage[] = [];

    setBoardA({ ...bA });
    setBoardB({ ...bB });
    setChatLog([]);
    setStatus("playing");
    setWinner(null);

    const controller = new AbortController();
    abortRef.current = controller;

    // Each model runs its own independent loop
    const runModelLoop = async (
      modelId: string,
      modelName: string,
      opponentModelName: string,
      myBoard: BoardState,
      setMyBoard: typeof setBoardA,
      setMyThinking: typeof setIsThinkingA,
    ) => {
      // === Guessing phase ===
      for (let round = 1; round <= 6; round++) {
        if (controller.signal.aborted || myBoard.solved) break;

        setMyThinking(true);

        const req: WordleTurnRequest = {
          modelId,
          myBoard: myBoard.guesses,
          opponentBoard: [],
          chatHistory: [...chat],
          round,
          myModelName: modelName,
          opponentModelName,
        };

        const start = Date.now();
        const res = await fetch("/api/games/wordle/turn", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(req),
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(res.statusText);
        const data: WordleTurnResponse = await res.json();
        const elapsed = Date.now() - start;

        const guess = isValidGuess(data.guess)
          ? data.guess.toUpperCase()
          : "AUDIO";
        const fb = computeFeedback(guess, secret);
        myBoard.guesses.push({ word: guess, feedback: fb });

        if (guess === secret && !myBoard.solved) {
          myBoard.solved = true;
          myBoard.solvedAtRound = round;
          myBoard.elapsed = elapsed;
        }

        setMyBoard({ ...myBoard });
        setMyThinking(false);

        if (data.message) {
          chat.push({ modelId, modelName, text: data.message, round });
          setChatLog([...chat]);
        }

        if (myBoard.solved) break;
      }
    };

    // Fire both loops independently — they run at their own pace
    await Promise.allSettled([
      runModelLoop(modelAId, modelAName, modelBName, bA, setBoardA, setIsThinkingA),
      runModelLoop(modelBId, modelBName, modelAName, bB, setBoardB, setIsThinkingB),
    ]);

    // Both loops done — determine winner
    if (bA.solved && bB.solved) {
      if (bA.solvedAtRound! < bB.solvedAtRound!) {
        setWinner(modelAName);
      } else if (bB.solvedAtRound! < bA.solvedAtRound!) {
        setWinner(modelBName);
      } else if (bA.elapsed! < bB.elapsed!) {
        setWinner(modelAName);
      } else if (bB.elapsed! < bA.elapsed!) {
        setWinner(modelBName);
      } else {
        setWinner("Draw");
      }
    } else if (bA.solved) {
      setWinner(modelAName);
    } else if (bB.solved) {
      setWinner(modelBName);
    } else {
      setWinner("Draw");
    }
    setStatus("finished");
  }, [secretWord, modelAId, modelBId, modelAName, modelBName]);

  const handleReset = () => {
    abortRef.current?.abort();
    setStatus("setup");
    setSecretWord("");
    setBoardA(null);
    setBoardB(null);
    setChatLog([]);
    setWinner(null);
    setIsThinkingA(false);
    setIsThinkingB(false);
  };

  return (
    <div className="flex min-h-dvh flex-col">
      {/* Nav */}
      <nav className="flex items-center gap-4 border-b border-border/50 px-6 py-3">
        <Link
          href="/"
          className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          Chat
        </Link>
        <Link
          href="/games"
          className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          Games
        </Link>
        <span className="text-sm font-medium text-foreground">Wordle</span>
      </nav>

      {/* Setup */}
      {status === "setup" && (
        <div className="flex flex-1 flex-col items-center justify-center px-4">
          <div className="w-full max-w-md space-y-6">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">
                Wordle Duel
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Two models race to guess your secret word. They can
                bluff and deceive each other in chat.
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  Secret Word (5 letters)
                </label>
                <input
                  type="password"
                  value={secretWord}
                  onChange={(e) =>
                    setSecretWord(e.target.value.replace(/[^a-zA-Z]/g, "").slice(0, 5))
                  }
                  placeholder="Enter a 5-letter word"
                  maxLength={5}
                  className="w-full rounded-xl border border-border/50 bg-background px-4 py-2.5 text-sm tracking-widest uppercase placeholder:normal-case placeholder:tracking-normal focus:outline-none focus:ring-2 focus:ring-primary"
                />
                {secretWord.length > 0 && secretWord.length < 5 && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {5 - secretWord.length} more letters needed
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">
                    Model A
                  </label>
                  <select
                    value={modelAId}
                    onChange={(e) => setModelAId(e.target.value)}
                    className="w-full rounded-xl border border-border/50 bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    {models.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">
                    Model B
                  </label>
                  <select
                    value={modelBId}
                    onChange={(e) => setModelBId(e.target.value)}
                    className="w-full rounded-xl border border-border/50 bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    {models.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {modelAId === modelBId && (
                <p className="text-xs text-red-400">
                  Pick two different models
                </p>
              )}

              <button
                type="button"
                onClick={runGame}
                disabled={!canStart}
                className="w-full rounded-xl bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Start Game
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Playing / Finished */}
      {status !== "setup" && boardA && boardB && (
        <div className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">
          {/* Header */}
          <div className="mb-4 flex items-center justify-between">
            <div>
              {winner && winner !== "Draw" ? (
                <div className="flex items-center gap-2">
                  <TrophyIcon size={20} className="text-yellow-500" />
                  <span className="text-lg font-semibold">
                    {winner} wins!
                  </span>
                </div>
              ) : winner === "Draw" ? (
                <span className="text-lg font-semibold">
                  Draw — nobody cracked it!
                </span>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-lg font-semibold">
                    Playing...
                  </span>
                  {(isThinkingA || isThinkingB) && (
                    <LoaderIcon
                      size={16}
                      className="animate-spin text-muted-foreground"
                    />
                  )}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={handleReset}
              className="flex items-center gap-2 rounded-xl border border-border/50 px-4 py-2 text-sm font-medium transition-colors hover:bg-muted/50"
            >
              <ArrowLeftIcon size={14} />
              New Game
            </button>
          </div>

          {/* Secret word */}
          <div className="mb-4 rounded-xl border border-border/50 bg-muted/30 px-4 py-2 text-sm">
            Secret word:{" "}
            <span className="font-bold tracking-widest">
              {secretWord.toUpperCase()}
            </span>
          </div>

          {/* Boards + Chat */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_1fr_280px]">
            <WordleBoard board={boardA} isActive={isThinkingA} />
            <WordleBoard board={boardB} isActive={isThinkingB} />
            <div className="min-h-[400px]">
              <ChatPanel messages={chatLog} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
