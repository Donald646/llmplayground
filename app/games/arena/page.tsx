"use client";

import { useState, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  LoaderIcon,
  SwordsIcon,
  ArrowLeftIcon,
  ChevronDownIcon,
  TrophyIcon,
} from "lucide-react";
import {
  createInitialState,
  MAX_ROUNDS,
  type GameState,
  type RoundResult,
} from "@/lib/games/arena";
import { models } from "@/lib/games/types";

const Scene = dynamic(() => import("@/components/arena/Scene"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-[#0f0f1a]">
      <LoaderIcon size={24} className="animate-spin text-muted-foreground" />
    </div>
  ),
});

type Phase = "selecting" | "fighting" | "complete";

function RoundLogEntry({ result, index }: { result: RoundResult; index: number }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-lg border border-border/30 bg-muted/20 text-xs">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2 px-2 py-1.5 text-left"
      >
        <span className="text-muted-foreground shrink-0 w-4">{index + 1}</span>
        <span className="truncate">{result.narrationSummary}</span>
        {(result.resultA.isCrit || result.resultB.isCrit) && (
          <Badge variant="outline" className="text-[9px] px-1 py-0 shrink-0 ml-auto border-yellow-500 text-yellow-500">
            CRIT
          </Badge>
        )}
        <ChevronDownIcon
          size={10}
          className={`shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div className="border-t border-border/20 px-2 py-1.5 text-muted-foreground space-y-1">
          <div>
            <Badge variant="default" className="text-[9px] px-1 py-0 mr-1">A</Badge>
            <span className="font-medium">{result.resultA.action.type}</span>
            {result.resultA.action.direction && ` ${result.resultA.action.direction}`}
            {result.resultA.damage > 0 && ` (-${result.resultA.damage})`}
            <br />
            <span className="text-[10px]">{result.resultA.action.reasoning}</span>
          </div>
          <div>
            <Badge variant="destructive" className="text-[9px] px-1 py-0 mr-1">B</Badge>
            <span className="font-medium">{result.resultB.action.type}</span>
            {result.resultB.action.direction && ` ${result.resultB.action.direction}`}
            {result.resultB.damage > 0 && ` (-${result.resultB.damage})`}
            <br />
            <span className="text-[10px]">{result.resultB.action.reasoning}</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ArenaPage() {
  const [phase, setPhase] = useState<Phase>("selecting");
  const [modelA, setModelA] = useState(models[0].id);
  const [modelB, setModelB] = useState(models[1].id);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [lastRoundResult, setLastRoundResult] = useState<RoundResult | null>(null);
  const [animating, setAnimating] = useState(false);
  const [thinking, setThinking] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const animResolveRef = useRef<(() => void) | null>(null);

  const handleAnimationDone = useCallback(() => {
    setAnimating(false);
    animResolveRef.current?.();
    animResolveRef.current = null;
  }, []);

  const waitForAnimation = useCallback((): Promise<void> => {
    return new Promise((resolve) => {
      animResolveRef.current = resolve;
      setTimeout(resolve, 3000);
    });
  }, []);

  const runBattle = useCallback(
    async (initialState: GameState) => {
      let state = initialState;
      const abort = new AbortController();
      abortRef.current = abort;

      while (!state.winner && state.round <= MAX_ROUNDS && !abort.signal.aborted) {
        setThinking(true);

        try {
          const res = await fetch("/api/games/arena/turn", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              gameState: state,
              modelA: state.fighters[0].modelId,
              modelB: state.fighters[1].modelId,
            }),
            signal: abort.signal,
          });

          if (!res.ok) {
            console.error("Round failed:", await res.text());
            break;
          }

          const { state: newState, result } = await res.json();
          setThinking(false);

          setAnimating(true);
          setLastRoundResult(result);
          setGameState(newState);
          state = newState;

          await waitForAnimation();
          await new Promise((r) => setTimeout(r, 500));
        } catch (err) {
          if ((err as Error).name === "AbortError") break;
          console.error("Round error:", err);
          break;
        }
      }

      setThinking(false);
      setPhase("complete");
    },
    [waitForAnimation],
  );

  const startBattle = useCallback(() => {
    const ma = models.find((m) => m.id === modelA)!;
    const mb = models.find((m) => m.id === modelB)!;
    const initial = createInitialState(
      { id: ma.id, name: ma.name },
      { id: mb.id, name: mb.name },
    );
    setGameState(initial);
    setLastRoundResult(null);
    setPhase("fighting");
    runBattle(initial);
  }, [modelA, modelB, runBattle]);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setPhase("selecting");
    setGameState(null);
    setLastRoundResult(null);
    setAnimating(false);
    setThinking(false);
  }, []);

  // --- Selecting Phase ---
  if (phase === "selecting") {
    return (
      <div className="flex h-dvh flex-col">
        <nav className="flex items-center gap-4 border-b border-border/50 px-6 py-3">
          <Link
            href="/games"
            className="flex items-center gap-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeftIcon size={14} />
            Games
          </Link>
        </nav>
        <div className="flex flex-1 flex-col items-center justify-center px-4">
          <div className="w-full max-w-md space-y-6">
            <div className="text-center">
              <SwordsIcon size={40} className="mx-auto mb-3 text-muted-foreground" />
              <h1 className="text-2xl font-semibold">3D Battle Arena</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Two LLMs fight simultaneously in a 3D arena
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  Fighter A (Blue)
                </label>
                <select
                  value={modelA}
                  onChange={(e) => setModelA(e.target.value)}
                  className="w-full rounded-xl border border-border/50 bg-card px-3 py-2 text-sm"
                >
                  {models.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="text-center text-xs font-medium text-muted-foreground">
                vs
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  Fighter B (Red)
                </label>
                <select
                  value={modelB}
                  onChange={(e) => setModelB(e.target.value)}
                  className="w-full rounded-xl border border-border/50 bg-card px-3 py-2 text-sm"
                >
                  {models.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <button
              onClick={startBattle}
              className="w-full rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Start Battle
            </button>
          </div>
        </div>
      </div>
    );
  }

  // --- Fighting / Complete Phase ---
  const [fa, fb] = gameState!.fighters;
  const isDraw = gameState?.winner === "draw";
  const winnerFighter = gameState?.winner && gameState.winner !== "draw"
    ? gameState.fighters[gameState.winner === "a" ? 0 : 1]
    : null;

  return (
    <div className="flex h-dvh flex-col">
      <nav className="flex items-center gap-4 border-b border-border/50 px-6 py-3">
        <button
          onClick={reset}
          className="flex items-center gap-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeftIcon size={14} />
          Back
        </button>
        <span className="text-sm text-muted-foreground">
          Round {gameState!.round}
        </span>
        {thinking && (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <LoaderIcon size={12} className="animate-spin" />
            Both fighters thinking...
          </span>
        )}
      </nav>

      <div className="flex flex-1 overflow-hidden">
        {/* 3D Scene */}
        <div className="flex-1 relative">
          <Scene
            gameState={gameState!}
            lastRoundResult={lastRoundResult}
            animatingTurn={animating}
            onAnimationDone={handleAnimationDone}
          />

          {/* Winner overlay */}
          {phase === "complete" && (isDraw || winnerFighter) && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/60">
              <div className="rounded-2xl border border-border/50 bg-card p-8 text-center">
                <TrophyIcon size={40} className="mx-auto mb-3 text-yellow-500" />
                {isDraw ? (
                  <h2 className="text-xl font-semibold">Draw! Mutual KO!</h2>
                ) : (
                  <h2 className="text-xl font-semibold">{winnerFighter!.modelName} wins!</h2>
                )}
                <p className="mt-1 text-sm text-muted-foreground">
                  {fa.modelName} {fa.hp} HP vs {fb.modelName} {fb.hp} HP
                  <br />
                  {gameState!.round - 1} rounds played
                </p>
                <button
                  onClick={reset}
                  className="mt-4 rounded-xl bg-primary px-6 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                >
                  Play Again
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Side panel */}
        <div className="w-72 shrink-0 flex flex-col border-l border-border/50 bg-card">
          {/* Fighter stats */}
          <div className="border-b border-border/50 p-3 space-y-3">
            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="font-medium text-blue-400">{fa.modelName}</span>
                <span className="text-muted-foreground">{fa.hp}/{fa.maxHp}</span>
              </div>
              <Progress value={(fa.hp / fa.maxHp) * 100} className="h-2" />
              <div className="flex items-center gap-1.5 mt-1">
                <span className="text-[9px] text-yellow-400">{fa.passive.name}</span>
                {fa.chargeActive && <span className="text-[9px] text-orange-400">Charged!</span>}
                {fa.powerUpEffects.damageBoost && <span className="text-[9px] text-red-400">+DMG</span>}
                {fa.powerUpEffects.shieldActive && <span className="text-[9px] text-blue-400">Shield</span>}
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="font-medium text-red-400">{fb.modelName}</span>
                <span className="text-muted-foreground">{fb.hp}/{fb.maxHp}</span>
              </div>
              <Progress value={(fb.hp / fb.maxHp) * 100} className="h-2" />
              <div className="flex items-center gap-1.5 mt-1">
                <span className="text-[9px] text-yellow-400">{fb.passive.name}</span>
                {fb.chargeActive && <span className="text-[9px] text-orange-400">Charged!</span>}
                {fb.powerUpEffects.damageBoost && <span className="text-[9px] text-red-400">+DMG</span>}
                {fb.powerUpEffects.shieldActive && <span className="text-[9px] text-blue-400">Shield</span>}
              </div>
            </div>
          </div>

          {/* Action log */}
          <div className="flex-1 overflow-y-auto p-3">
            <h3 className="mb-2 text-xs font-semibold text-muted-foreground">
              Battle Log
            </h3>
            <div className="space-y-1.5">
              {gameState!.log.map((result, i) => (
                <RoundLogEntry key={i} result={result} index={i} />
              ))}
              {gameState!.log.length === 0 && (
                <p className="text-xs text-muted-foreground italic">
                  Battle starting...
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
