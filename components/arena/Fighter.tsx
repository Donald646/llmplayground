"use client";

import { useRef, useEffect, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import { GRID_SIZE, type Action } from "@/lib/games/arena";

function gridToWorld(pos: { x: number; z: number }): THREE.Vector3 {
  return new THREE.Vector3(
    pos.x - GRID_SIZE / 2 + 0.5,
    0.7,
    pos.z - GRID_SIZE / 2 + 0.5,
  );
}

type AnimState = "idle" | "moving" | "attacking" | "defending" | "special" | "dashing" | "healing" | "charging";

interface FighterProps {
  position: { x: number; z: number };
  opponentPosition: { x: number; z: number };
  hp: number;
  maxHp: number;
  name: string;
  color: string;
  lastAction: Action | null;
  isCurrentTurn: boolean;
  onAnimationComplete?: () => void;
  chargeActive?: boolean;
  passive?: string;
}

export default function Fighter({
  position,
  opponentPosition,
  hp,
  maxHp,
  name,
  color,
  lastAction,
  isCurrentTurn,
  onAnimationComplete,
  chargeActive,
  passive,
}: FighterProps) {
  const meshRef = useRef<THREE.Group>(null);
  const bodyRef = useRef<THREE.Mesh>(null);

  // All animation state as refs to avoid re-renders in useFrame
  const animState = useRef<AnimState>("idle");
  const animTimer = useRef(0);
  const targetPos = useRef(gridToWorld(position));
  const attackTarget = useRef(gridToWorld(opponentPosition));
  const homePos = useRef(gridToWorld(position));
  const onCompleteRef = useRef(onAnimationComplete);
  const animDoneRef = useRef(false);

  // Keep callback ref updated
  onCompleteRef.current = onAnimationComplete;

  // React to position/action changes
  useEffect(() => {
    const newTarget = gridToWorld(position);
    homePos.current = newTarget;
    targetPos.current = newTarget;

    if (lastAction) {
      animTimer.current = 0;
      animDoneRef.current = false;
      switch (lastAction.type) {
        case "move":
          animState.current = "moving";
          break;
        case "attack":
          attackTarget.current = gridToWorld(opponentPosition);
          animState.current = "attacking";
          break;
        case "defend":
          animState.current = "defending";
          break;
        case "special":
          attackTarget.current = gridToWorld(opponentPosition);
          animState.current = "special";
          break;
        case "dash":
          animState.current = "dashing";
          break;
        case "heal":
          animState.current = "healing";
          break;
        case "charge":
          animState.current = "charging";
          break;
      }
    }
  }, [position, lastAction, opponentPosition]);

  useFrame((_, delta) => {
    if (!meshRef.current || !bodyRef.current) return;
    const group = meshRef.current;
    const body = bodyRef.current;

    animTimer.current += delta;

    const finishAnim = () => {
      if (!animDoneRef.current) {
        animDoneRef.current = true;
        animState.current = "idle";
        body.scale.setScalar(1);
        onCompleteRef.current?.();
      }
    };

    switch (animState.current) {
      case "idle": {
        body.position.y = Math.sin(Date.now() * 0.003) * 0.05;
        body.scale.setScalar(1);
        group.position.lerp(targetPos.current, 0.1);
        break;
      }

      case "moving": {
        group.position.lerp(targetPos.current, 0.12);
        if (group.position.distanceTo(targetPos.current) < 0.05) {
          finishAnim();
        }
        break;
      }

      case "attacking": {
        const t = animTimer.current;
        if (t < 0.3) {
          const lungeTarget = homePos.current.clone().lerp(attackTarget.current, 0.6);
          group.position.lerp(lungeTarget, 0.15);
        } else if (t < 0.8) {
          group.position.lerp(homePos.current, 0.1);
        } else {
          group.position.lerp(homePos.current, 0.15);
          if (group.position.distanceTo(homePos.current) < 0.1) {
            finishAnim();
          }
        }
        break;
      }

      case "defending": {
        const t = animTimer.current;
        const scale = 1 + Math.sin(t * 8) * 0.1;
        body.scale.setScalar(scale);
        group.position.lerp(targetPos.current, 0.1);
        if (t > 0.8) {
          finishAnim();
        }
        break;
      }

      case "special": {
        const t = animTimer.current;
        if (t < 0.2) {
          body.scale.setScalar(1.3);
        } else if (t < 0.5) {
          body.scale.setScalar(1);
        } else {
          finishAnim();
        }
        break;
      }

      case "dashing": {
        group.position.lerp(targetPos.current, 0.2);
        if (group.position.distanceTo(targetPos.current) < 0.05) {
          finishAnim();
        }
        break;
      }

      case "healing": {
        const t = animTimer.current;
        body.position.y = Math.sin(t * 6) * 0.08;
        body.scale.setScalar(1 + Math.sin(t * 4) * 0.05);
        group.position.lerp(targetPos.current, 0.1);
        if (t > 0.8) finishAnim();
        break;
      }

      case "charging": {
        const t = animTimer.current;
        const pulse = 1 + Math.sin(t * 10) * 0.15;
        body.scale.setScalar(pulse);
        group.position.lerp(targetPos.current, 0.1);
        if (t > 0.8) finishAnim();
        break;
      }
    }
  });

  const hpPercent = (hp / maxHp) * 100;
  const hpColor = hpPercent > 50 ? "#22c55e" : hpPercent > 25 ? "#eab308" : "#ef4444";

  return (
    <group ref={meshRef} position={gridToWorld(position).toArray()}>
      <mesh ref={bodyRef} castShadow>
        <capsuleGeometry args={[0.25, 0.6, 8, 16]} />
        <meshStandardMaterial
          color={color}
          emissive={isCurrentTurn ? color : "#000000"}
          emissiveIntensity={isCurrentTurn ? 0.3 : 0}
          roughness={0.4}
          metalness={0.3}
        />
      </mesh>

      {/* Eyes */}
      <mesh position={[0.1, 0.2, 0.2]}>
        <sphereGeometry args={[0.05, 8, 8]} />
        <meshBasicMaterial color="white" />
      </mesh>
      <mesh position={[-0.1, 0.2, 0.2]}>
        <sphereGeometry args={[0.05, 8, 8]} />
        <meshBasicMaterial color="white" />
      </mesh>

      {/* Charge glow */}
      {chargeActive && (
        <mesh>
          <sphereGeometry args={[0.45, 12, 12]} />
          <meshStandardMaterial
            color={color}
            emissive={color}
            emissiveIntensity={2}
            transparent
            opacity={0.2}
          />
        </mesh>
      )}

      {/* HP Bar + Name */}
      <Html position={[0, 1.2, 0]} center distanceFactor={8}>
        <div className="flex flex-col items-center gap-0.5 pointer-events-none select-none">
          <span className="text-[10px] font-medium text-white whitespace-nowrap drop-shadow-lg">
            {name}
          </span>
          <div className="w-16 h-1.5 bg-gray-800/80 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{ width: `${hpPercent}%`, backgroundColor: hpColor }}
            />
          </div>
          <span className="text-[9px] text-white/70 drop-shadow">
            {hp}/{maxHp}
          </span>
          {passive && passive !== "None" && (
            <span className="text-[8px] text-yellow-300/80 drop-shadow">
              {passive}
            </span>
          )}
        </div>
      </Html>
    </group>
  );
}
