"use client";

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { GRID_SIZE, type TileType, type PowerUp } from "@/lib/games/arena";

interface ArenaFloorProps {
  terrain?: TileType[][];
  powerUps?: PowerUp[];
}

function LavaTile({ x, z }: { x: number; z: number }) {
  const ref = useRef<THREE.MeshStandardMaterial>(null);

  useFrame(() => {
    if (!ref.current) return;
    const t = Date.now() * 0.002;
    ref.current.emissiveIntensity = 0.8 + Math.sin(t + x * 0.5 + z * 0.3) * 0.4;
  });

  return (
    <mesh
      position={[x - GRID_SIZE / 2 + 0.5, 0.01, z - GRID_SIZE / 2 + 0.5]}
      rotation={[-Math.PI / 2, 0, 0]}
      receiveShadow
    >
      <planeGeometry args={[0.95, 0.95]} />
      <meshStandardMaterial
        ref={ref}
        color="#cc3300"
        emissive="#ff4400"
        emissiveIntensity={0.8}
        roughness={0.6}
      />
    </mesh>
  );
}

function PowerUpTile({ x, z, type }: { x: number; z: number; type: string }) {
  const ref = useRef<THREE.Mesh>(null);

  const color = type === "heal" ? "#22c55e" : type === "damage" ? "#ef4444" : "#3b82f6";

  useFrame(() => {
    if (!ref.current) return;
    const t = Date.now() * 0.003;
    ref.current.position.y = 0.5 + Math.sin(t + x + z) * 0.15;
    ref.current.rotation.y += 0.02;
  });

  return (
    <mesh
      ref={ref}
      position={[x - GRID_SIZE / 2 + 0.5, 0.5, z - GRID_SIZE / 2 + 0.5]}
    >
      <octahedronGeometry args={[0.15, 0]} />
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={1.5}
        transparent
        opacity={0.9}
      />
    </mesh>
  );
}

export default function ArenaFloor({ terrain, powerUps }: ArenaFloorProps) {
  const tiles = useMemo(() => {
    const result = [];
    for (let x = 0; x < GRID_SIZE; x++) {
      for (let z = 0; z < GRID_SIZE; z++) {
        const tileType = terrain?.[z]?.[x] ?? "empty";

        if (tileType === "wall") {
          result.push(
            <mesh
              key={`${x}-${z}`}
              position={[x - GRID_SIZE / 2 + 0.5, 0.3, z - GRID_SIZE / 2 + 0.5]}
              castShadow
              receiveShadow
            >
              <boxGeometry args={[0.9, 0.6, 0.9]} />
              <meshStandardMaterial color="#555566" roughness={0.9} metalness={0.1} />
            </mesh>,
          );
        } else if (tileType === "lava") {
          result.push(<LavaTile key={`${x}-${z}`} x={x} z={z} />);
        } else {
          const isLight = (x + z) % 2 === 0;
          result.push(
            <mesh
              key={`${x}-${z}`}
              position={[x - GRID_SIZE / 2 + 0.5, 0, z - GRID_SIZE / 2 + 0.5]}
              rotation={[-Math.PI / 2, 0, 0]}
              receiveShadow
            >
              <planeGeometry args={[0.95, 0.95]} />
              <meshStandardMaterial
                color={isLight ? "#3a3a4a" : "#2d2d3d"}
                roughness={0.8}
              />
            </mesh>,
          );
        }
      }
    }
    return result;
  }, [terrain]);

  return (
    <group>
      {tiles}

      {/* Power-ups */}
      {powerUps?.map((pu) => (
        <PowerUpTile
          key={`pu-${pu.position.x}-${pu.position.z}`}
          x={pu.position.x}
          z={pu.position.z}
          type={pu.type}
        />
      ))}

      {/* Arena border */}
      <mesh position={[0, -0.01, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[GRID_SIZE + 0.5, GRID_SIZE + 0.5]} />
        <meshStandardMaterial color="#1a1a2a" roughness={0.9} />
      </mesh>
    </group>
  );
}
