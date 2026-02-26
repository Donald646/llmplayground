"use client";

import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { useState, useCallback, useRef, useEffect } from "react";
import ArenaFloor from "./Arena";
import Fighter from "./Fighter";
import {
  Projectile,
  ImpactFlash,
  SlashEffect,
  ShieldEffect,
  DustPuff,
  DamageNumber,
  HealEffect,
  ChargeEffect,
  DashTrail,
  CounterSlash,
} from "./ActionEffect";
import { FIGHTER_A_COLOR, FIGHTER_B_COLOR, type GameState, type RoundResult, type TurnResult } from "@/lib/games/arena";

interface SceneProps {
  gameState: GameState;
  lastRoundResult: RoundResult | null;
  animatingTurn: boolean;
  onAnimationDone: () => void;
}

type GridPos = { x: number; z: number };

type Effect =
  | { id: string; type: "projectile"; from: GridPos; to: GridPos; color: string }
  | { id: string; type: "impact"; position: GridPos; color: string }
  | { id: string; type: "slash"; position: GridPos; color: string }
  | { id: string; type: "shield"; position: GridPos; color: string }
  | { id: string; type: "dust"; position: GridPos }
  | { id: string; type: "damage"; position: GridPos; damage: number; isCrit: boolean }
  | { id: string; type: "heal"; position: GridPos }
  | { id: string; type: "charge"; position: GridPos; color: string }
  | { id: string; type: "dash"; position: GridPos; color: string }
  | { id: string; type: "counter"; position: GridPos };

let effectIdCounter = 0;
function nextId() {
  return `effect-${effectIdCounter++}`;
}

function spawnEffectsForAction(
  result: TurnResult,
  fighterPos: GridPos,
  opponentPos: GridPos,
  fighterColor: string,
  effects: Effect[],
) {
  switch (result.action.type) {
    case "move": {
      effects.push({ id: nextId(), type: "dust", position: fighterPos });
      break;
    }
    case "attack": {
      if (result.dodged) {
        effects.push({ id: nextId(), type: "slash", position: fighterPos, color: fighterColor });
      } else if (result.damage > 0) {
        effects.push({ id: nextId(), type: "slash", position: opponentPos, color: fighterColor });
        effects.push({ id: nextId(), type: "impact", position: opponentPos, color: result.isCrit ? "#fbbf24" : "#ffaa00" });
        effects.push({ id: nextId(), type: "damage", position: opponentPos, damage: result.damage, isCrit: result.isCrit });
        if (result.counterDamage > 0) {
          effects.push({ id: nextId(), type: "counter", position: fighterPos });
          effects.push({ id: nextId(), type: "damage", position: fighterPos, damage: result.counterDamage, isCrit: false });
        }
        if (result.knockback) {
          effects.push({ id: nextId(), type: "dust", position: opponentPos });
        }
      } else {
        effects.push({ id: nextId(), type: "slash", position: fighterPos, color: fighterColor });
      }
      break;
    }
    case "defend": {
      effects.push({ id: nextId(), type: "shield", position: fighterPos, color: fighterColor });
      break;
    }
    case "special": {
      if (result.dodged) {
        effects.push({ id: nextId(), type: "projectile", from: fighterPos, to: opponentPos, color: fighterColor });
      } else if (result.damage > 0) {
        effects.push({ id: nextId(), type: "projectile", from: fighterPos, to: opponentPos, color: fighterColor });
        effects.push({ id: nextId(), type: "damage", position: opponentPos, damage: result.damage, isCrit: result.isCrit });
      } else {
        effects.push({ id: nextId(), type: "impact", position: fighterPos, color: "#666666" });
      }
      break;
    }
    case "dash": {
      effects.push({ id: nextId(), type: "dash", position: fighterPos, color: fighterColor });
      effects.push({ id: nextId(), type: "dust", position: fighterPos });
      break;
    }
    case "heal": {
      effects.push({ id: nextId(), type: "heal", position: fighterPos });
      break;
    }
    case "charge": {
      effects.push({ id: nextId(), type: "charge", position: fighterPos, color: fighterColor });
      break;
    }
  }
}

export default function Scene({
  gameState,
  lastRoundResult,
  animatingTurn,
  onAnimationDone,
}: SceneProps) {
  const [effects, setEffects] = useState<Effect[]>([]);
  const [contextLost, setContextLost] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lastSpawnedResult = useRef<RoundResult | null>(null);
  const animCompletedRef = useRef({ a: false, b: false });

  const removeEffect = useCallback((id: string) => {
    setEffects((prev) => prev.filter((e) => e.id !== id));
  }, []);

  const handleFighterAnimDone = useCallback((fighterId: "a" | "b") => {
    animCompletedRef.current[fighterId] = true;
    if (animCompletedRef.current.a && animCompletedRef.current.b) {
      animCompletedRef.current = { a: false, b: false };
      onAnimationDone();
    }
  }, [onAnimationDone]);

  // Spawn effects when a new round result comes in
  useEffect(() => {
    if (!lastRoundResult || !animatingTurn) return;
    if (lastRoundResult === lastSpawnedResult.current) return;
    lastSpawnedResult.current = lastRoundResult;
    animCompletedRef.current = { a: false, b: false };

    const newEffects: Effect[] = [];

    // Spawn effects for Fighter A
    spawnEffectsForAction(
      lastRoundResult.resultA,
      gameState.fighters[0].position,
      gameState.fighters[1].position,
      FIGHTER_A_COLOR,
      newEffects,
    );

    // Spawn effects for Fighter B
    spawnEffectsForAction(
      lastRoundResult.resultB,
      gameState.fighters[1].position,
      gameState.fighters[0].position,
      FIGHTER_B_COLOR,
      newEffects,
    );

    if (newEffects.length > 0) {
      setEffects((prev) => [...prev, ...newEffects]);
    }
  }, [lastRoundResult, animatingTurn, gameState.fighters]);

  const [fa, fb] = gameState.fighters;

  const lastActionA = lastRoundResult && animatingTurn ? lastRoundResult.resultA.action : null;
  const lastActionB = lastRoundResult && animatingTurn ? lastRoundResult.resultB.action : null;

  if (contextLost) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-[#0f0f1a] text-white">
        <p className="text-sm text-muted-foreground">WebGL context lost</p>
        <button
          onClick={() => setContextLost(false)}
          className="rounded-lg bg-primary px-4 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <Canvas
      camera={{ position: [8, 8, 8], fov: 45 }}
      style={{ background: "#0f0f1a" }}
      gl={{ powerPreference: "low-power", antialias: false }}
      ref={canvasRef}
      onCreated={({ gl }) => {
        const canvas = gl.domElement;
        canvas.addEventListener("webglcontextlost", (e) => {
          e.preventDefault();
          setContextLost(true);
        });
      }}
    >
      <ambientLight intensity={0.4} />
      <directionalLight
        position={[5, 10, 5]}
        intensity={1}
        castShadow
        shadow-mapSize-width={512}
        shadow-mapSize-height={512}
      />
      <pointLight position={[-5, 5, -5]} intensity={0.3} color={FIGHTER_A_COLOR} />

      <ArenaFloor terrain={gameState.terrain} powerUps={gameState.powerUps} />

      <Fighter
        position={fa.position}
        opponentPosition={fb.position}
        hp={fa.hp}
        maxHp={fa.maxHp}
        name={fa.modelName}
        color={FIGHTER_A_COLOR}
        lastAction={lastActionA}
        isCurrentTurn={animatingTurn}
        onAnimationComplete={() => handleFighterAnimDone("a")}
        chargeActive={fa.chargeActive}
        passive={fa.passive.name}
      />

      <Fighter
        position={fb.position}
        opponentPosition={fa.position}
        hp={fb.hp}
        maxHp={fb.maxHp}
        name={fb.modelName}
        color={FIGHTER_B_COLOR}
        lastAction={lastActionB}
        isCurrentTurn={animatingTurn}
        onAnimationComplete={() => handleFighterAnimDone("b")}
        chargeActive={fb.chargeActive}
        passive={fb.passive.name}
      />

      {/* Action effects */}
      {effects.map((effect) => {
        switch (effect.type) {
          case "projectile":
            return <Projectile key={effect.id} from={effect.from} to={effect.to} color={effect.color} onComplete={() => removeEffect(effect.id)} />;
          case "impact":
            return <ImpactFlash key={effect.id} position={effect.position} color={effect.color} onComplete={() => removeEffect(effect.id)} />;
          case "slash":
            return <SlashEffect key={effect.id} position={effect.position} color={effect.color} onComplete={() => removeEffect(effect.id)} />;
          case "shield":
            return <ShieldEffect key={effect.id} position={effect.position} color={effect.color} onComplete={() => removeEffect(effect.id)} />;
          case "dust":
            return <DustPuff key={effect.id} position={effect.position} onComplete={() => removeEffect(effect.id)} />;
          case "damage":
            return <DamageNumber key={effect.id} position={effect.position} damage={effect.damage} isCrit={effect.isCrit} onComplete={() => removeEffect(effect.id)} />;
          case "heal":
            return <HealEffect key={effect.id} position={effect.position} onComplete={() => removeEffect(effect.id)} />;
          case "charge":
            return <ChargeEffect key={effect.id} position={effect.position} color={effect.color} onComplete={() => removeEffect(effect.id)} />;
          case "dash":
            return <DashTrail key={effect.id} position={effect.position} color={effect.color} onComplete={() => removeEffect(effect.id)} />;
          case "counter":
            return <CounterSlash key={effect.id} position={effect.position} onComplete={() => removeEffect(effect.id)} />;
        }
      })}

      <OrbitControls
        target={[0, 0, 0]}
        minPolarAngle={0.3}
        maxPolarAngle={Math.PI / 2.2}
        minDistance={5}
        maxDistance={15}
      />
      <fog attach="fog" args={["#0f0f1a", 12, 25]} />
    </Canvas>
  );
}
