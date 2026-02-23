"use client";

import { useState, useCallback, useRef } from "react";
import Link from "next/link";
import {
  BrainIcon,
  SwordsIcon,
  SparklesIcon,
  LoaderIcon,
  TrophyIcon,
  ChevronDownIcon,
  ArrowLeftIcon,
  HashIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { MessageResponse } from "@/components/ai-elements/message";
import { Progress } from "@/components/ui/progress";
import type {
  GameType,
  MatchResult,
  Standing,
} from "@/lib/games/types";
import { models } from "@/lib/games/types";
import { generatePairings, calculateStandings } from "@/lib/games/tournament";

type TournamentStatus = "selecting" | "running" | "complete";

interface LiveMatch {
  text: string;
  done: boolean;
}

const gameTypes: {
  id: GameType;
  title: string;
  description: string;
  icon: typeof BrainIcon;
}[] = [
  {
    id: "trivia",
    title: "Trivia Battle",
    description: "Models answer knowledge questions, judged on accuracy",
    icon: BrainIcon,
  },
  {
    id: "debate",
    title: "Debate Arena",
    description: "Models argue opposing sides of a topic",
    icon: SwordsIcon,
  },
  {
    id: "word-games",
    title: "Word Games",
    description: "Creative challenges: rhymes, associations, acronyms",
    icon: SparklesIcon,
  },
];

function parseResult(text: string): {
  winner: "modelA" | "modelB" | "draw";
  scoreA: number;
  scoreB: number;
  reasoning: string;
} | null {
  const match = text.match(/RESULT:\s*(\{[\s\S]*?\})/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[1]);
    return {
      winner:
        parsed.winner === "A"
          ? "modelA"
          : parsed.winner === "B"
            ? "modelB"
            : "draw",
      scoreA: Number(parsed.scoreA) || 5,
      scoreB: Number(parsed.scoreB) || 5,
      reasoning: parsed.reasoning || "",
    };
  } catch {
    return null;
  }
}

function Leaderboard({ standings }: { standings: Standing[] }) {
  return (
    <div className="rounded-xl border border-border/50 bg-muted/20 p-4">
      <h3 className="mb-3 text-sm font-semibold">Standings</h3>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border/50 text-muted-foreground">
            <th className="pb-2 text-left text-xs">#</th>
            <th className="pb-2 text-left text-xs">Model</th>
            <th className="pb-2 text-center text-xs">W</th>
            <th className="pb-2 text-center text-xs">D</th>
            <th className="pb-2 text-center text-xs">L</th>
            <th className="pb-2 text-right text-xs">Pts</th>
          </tr>
        </thead>
        <tbody>
          {standings.map((s, i) => (
            <tr
              key={s.model.id}
              className="border-b border-border/30 last:border-0"
            >
              <td className="py-2 text-muted-foreground">
                {i === 0 && s.points > 0 ? (
                  <TrophyIcon size={14} className="text-yellow-500" />
                ) : (
                  i + 1
                )}
              </td>
              <td className="py-2 font-medium">{s.model.name}</td>
              <td className="py-2 text-center text-green-500">{s.wins}</td>
              <td className="py-2 text-center text-muted-foreground">
                {s.draws}
              </td>
              <td className="py-2 text-center text-red-400">{s.losses}</td>
              <td className="py-2 text-right font-semibold">{s.points}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MatchCard({
  match,
  index,
  liveText,
}: {
  match: MatchResult;
  index: number;
  liveText?: string;
}) {
  const [open, setOpen] = useState(false);
  const { pairing, response, status } = match;

  const isLive = status === "running" && liveText;
  const isExpandable = status === "complete" || isLive;

  const winnerName =
    response?.judgment.winner === "modelA"
      ? pairing.modelA.name
      : response?.judgment.winner === "modelB"
        ? pairing.modelB.name
        : response
          ? "Draw"
          : null;

  // Auto-expand when live
  const showContent = isLive || open;

  // Strip the RESULT: JSON line from display text
  const displayText = (liveText || "").replace(/RESULT:\s*\{[\s\S]*?\}\s*$/, "").trim();

  return (
    <div className="rounded-xl border border-border/50 bg-muted/30">
      <button
        type="button"
        onClick={() => isExpandable && setOpen(!open)}
        className="flex w-full items-center gap-2 px-4 py-3 text-left"
      >
        <Badge variant="outline" className="shrink-0 text-xs">
          {index + 1}
        </Badge>
        <span className="text-sm font-medium">{pairing.modelA.name}</span>
        <span className="text-xs text-muted-foreground">vs</span>
        <span className="text-sm font-medium">{pairing.modelB.name}</span>

        <span className="ml-auto flex items-center gap-2">
          {status === "running" && (
            <LoaderIcon
              size={14}
              className="animate-spin text-muted-foreground"
            />
          )}
          {status === "complete" && winnerName && (
            <Badge
              variant={
                response?.judgment.winner === "draw" ? "secondary" : "default"
              }
              className="text-xs"
            >
              {winnerName}
            </Badge>
          )}
          {status === "pending" && (
            <Badge variant="secondary" className="text-xs">
              Pending
            </Badge>
          )}
          {status === "error" && (
            <Badge variant="destructive" className="text-xs">
              Error
            </Badge>
          )}
          {isExpandable && !isLive && (
            <ChevronDownIcon
              size={14}
              className={`text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
            />
          )}
        </span>
      </button>

      {showContent && (
        <div className="border-t border-border/50 px-4 py-3">
          {displayText ? (
            <MessageResponse className="text-sm">
              {displayText}
            </MessageResponse>
          ) : (
            <p className="text-sm text-muted-foreground italic">
              Starting match...
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default function GamesPage() {
  const [gameType, setGameType] = useState<GameType | null>(null);
  const [tournamentStatus, setTournamentStatus] =
    useState<TournamentStatus>("selecting");
  const [matches, setMatches] = useState<MatchResult[]>([]);
  const [standings, setStandings] = useState<Standing[]>(() =>
    calculateStandings(models, [])
  );
  const [liveMatchIndex, setLiveMatchIndex] = useState(-1);
  const [liveText, setLiveText] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  const runTournament = useCallback(async (selectedGame: GameType) => {
    const pairings = generatePairings(models);
    const initialMatches: MatchResult[] = pairings.map((pairing) => ({
      pairing,
      response: null,
      status: "pending",
    }));

    setMatches(initialMatches);
    setTournamentStatus("running");

    const updatedMatches = [...initialMatches];

    for (let i = 0; i < pairings.length; i++) {
      updatedMatches[i] = { ...updatedMatches[i], status: "running" };
      setMatches([...updatedMatches]);
      setLiveMatchIndex(i);
      setLiveText("");

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const res = await fetch("/api/games/match", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            gameType: selectedGame,
            modelA: pairings[i].modelA.id,
            modelB: pairings[i].modelB.id,
          }),
          signal: controller.signal,
        });

        if (!res.ok) throw new Error(`Match failed: ${res.statusText}`);

        const reader = res.body!.getReader();
        const decoder = new TextDecoder();
        let fullText = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          fullText += decoder.decode(value, { stream: true });
          setLiveText(fullText);
        }

        // Parse the RESULT JSON from the narration
        const result = parseResult(fullText);

        updatedMatches[i] = {
          ...updatedMatches[i],
          status: "complete",
          response: result
            ? {
                gameType: selectedGame,
                topic: "",
                modelA: {
                  id: pairings[i].modelA.id,
                  name: pairings[i].modelA.name,
                  response: "",
                },
                modelB: {
                  id: pairings[i].modelB.id,
                  name: pairings[i].modelB.name,
                  response: "",
                },
                judgment: result,
              }
            : null,
        };
      } catch (err) {
        if (controller.signal.aborted) break;
        updatedMatches[i] = {
          ...updatedMatches[i],
          status: "error",
          error: err instanceof Error ? err.message : "Unknown error",
        };
      }

      setMatches([...updatedMatches]);
      setStandings(calculateStandings(models, updatedMatches));
    }

    setLiveMatchIndex(-1);
    setLiveText("");
    setTournamentStatus("complete");
  }, []);

  const handleStart = () => {
    if (!gameType) return;
    runTournament(gameType);
  };

  const handleReset = () => {
    abortRef.current?.abort();
    setGameType(null);
    setTournamentStatus("selecting");
    setMatches([]);
    setStandings(calculateStandings(models, []));
    setLiveMatchIndex(-1);
    setLiveText("");
  };

  const completedCount = matches.filter((m) => m.status === "complete").length;
  const winner =
    tournamentStatus === "complete" && standings[0]?.points > 0
      ? standings[0]
      : null;

  return (
    <div className="flex min-h-dvh flex-col">
      <nav className="flex items-center gap-4 border-b border-border/50 px-6 py-3">
        <Link
          href="/"
          className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          Chat
        </Link>
        <Link href="/games" className="text-sm font-medium text-foreground">
          Games
        </Link>
      </nav>

      {tournamentStatus === "selecting" && (
        <div className="flex flex-1 flex-col items-center justify-center px-4">
          <div className="w-full max-w-2xl space-y-8">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">
                LLM Arena
              </h1>
              <p className="mt-2 text-muted-foreground">
                Watch AI models compete head-to-head in a round-robin tournament
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {gameTypes.map((g) => {
                const Icon = g.icon;
                const selected = gameType === g.id;
                return (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => setGameType(g.id)}
                    className={`cursor-pointer rounded-xl border p-4 text-left transition-all ${
                      selected
                        ? "border-primary bg-primary/5 ring-2 ring-primary"
                        : "border-border/50 bg-muted/20 hover:bg-muted/40"
                    }`}
                  >
                    <Icon
                      size={20}
                      className={
                        selected ? "text-primary" : "text-muted-foreground"
                      }
                    />
                    <h3 className="mt-2 text-sm font-semibold">{g.title}</h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {g.description}
                    </p>
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleStart}
                disabled={!gameType}
                className="rounded-xl bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Start Tournament
              </button>
              <span className="text-xs text-muted-foreground">
                4 models &middot; 6 matches &middot; Round Robin
              </span>
            </div>

            <div className="border-t border-border/50 pt-6">
              <h2 className="mb-3 text-sm font-semibold text-muted-foreground">
                Other Game Modes
              </h2>
              <div className="space-y-3">
                <Link
                  href="/games/wordle"
                  className="flex items-center gap-3 rounded-xl border border-border/50 bg-muted/20 p-4 transition-all hover:bg-muted/40"
                >
                  <HashIcon size={20} className="text-muted-foreground" />
                  <div>
                    <h3 className="text-sm font-semibold">Wordle Duel</h3>
                    <p className="text-xs text-muted-foreground">
                      Two models race to guess a secret word, with deceptive chat
                    </p>
                  </div>
                </Link>
                <Link
                  href="/games/wordle-shared"
                  className="flex items-center gap-3 rounded-xl border border-border/50 bg-muted/20 p-4 transition-all hover:bg-muted/40"
                >
                  <SwordsIcon size={20} className="text-muted-foreground" />
                  <div>
                    <h3 className="text-sm font-semibold">Shared Board Wordle</h3>
                    <p className="text-xs text-muted-foreground">
                      Two models share one board, take turns. Solver survives, loser gets deleted.
                    </p>
                  </div>
                </Link>
                <Link
                  href="/games/arena"
                  className="flex items-center gap-3 rounded-xl border border-border/50 bg-muted/20 p-4 transition-all hover:bg-muted/40"
                >
                  <SwordsIcon size={20} className="text-muted-foreground" />
                  <div>
                    <h3 className="text-sm font-semibold">3D Battle Arena</h3>
                    <p className="text-xs text-muted-foreground">
                      Two LLMs fight in a turn-based 3D arena with attacks, defense, and special moves
                    </p>
                  </div>
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      {tournamentStatus !== "selecting" && (
        <div className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
          <div className="mb-6 flex items-center justify-between">
            <div>
              {tournamentStatus === "complete" && winner ? (
                <div className="flex items-center gap-3">
                  <TrophyIcon size={24} className="text-yellow-500" />
                  <div>
                    <h2 className="text-xl font-semibold">
                      {winner.model.name} wins!
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      {winner.wins}W {winner.draws}D {winner.losses}L &middot;{" "}
                      {winner.points} points
                    </p>
                  </div>
                </div>
              ) : (
                <div>
                  <h2 className="text-xl font-semibold">
                    Tournament in Progress
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    Match {Math.min(completedCount + 1, 6)} of 6
                  </p>
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={handleReset}
              className="flex items-center gap-2 rounded-xl border border-border/50 px-4 py-2 text-sm font-medium transition-colors hover:bg-muted/50"
            >
              <ArrowLeftIcon size={14} />
              {tournamentStatus === "complete"
                ? "New Tournament"
                : "Stop"}
            </button>
          </div>

          <Progress value={(completedCount / 6) * 100} className="mb-6" />

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_280px]">
            <div className="space-y-3">
              {matches.map((match, i) => (
                <MatchCard
                  key={i}
                  match={match}
                  index={i}
                  liveText={i === liveMatchIndex ? liveText : undefined}
                />
              ))}
            </div>
            <div className="lg:sticky lg:top-8 lg:self-start">
              <Leaderboard standings={standings} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
