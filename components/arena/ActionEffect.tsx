"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";

const GRID_SIZE = 10;

function gridToWorld(pos: { x: number; z: number }): THREE.Vector3 {
  return new THREE.Vector3(
    pos.x - GRID_SIZE / 2 + 0.5,
    0.7,
    pos.z - GRID_SIZE / 2 + 0.5,
  );
}

// --- Projectile: energy ball that arcs from fighter to opponent ---

interface ProjectileProps {
  from: { x: number; z: number };
  to: { x: number; z: number };
  color: string;
  onComplete: () => void;
}

export function Projectile({ from, to, color, onComplete }: ProjectileProps) {
  const groupRef = useRef<THREE.Group>(null);
  const glowRef = useRef<THREE.Mesh>(null);
  const start = useRef(gridToWorld(from));
  const end = useRef(gridToWorld(to));
  const progress = useRef(0);
  const done = useRef(false);

  useFrame((_, delta) => {
    if (!groupRef.current || done.current) return;
    progress.current += delta * 2.5;

    if (progress.current >= 1) {
      done.current = true;
      onComplete();
      return;
    }

    const p = progress.current;
    groupRef.current.position.lerpVectors(start.current, end.current, p);
    groupRef.current.position.y += Math.sin(p * Math.PI) * 1.2;

    if (glowRef.current) {
      const pulse = 1 + Math.sin(p * Math.PI * 6) * 0.3;
      glowRef.current.scale.setScalar(pulse);
    }
  });

  return (
    <group ref={groupRef} position={start.current.toArray()}>
      <mesh>
        <sphereGeometry args={[0.12, 8, 8]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={3} />
      </mesh>
      <mesh ref={glowRef}>
        <sphereGeometry args={[0.25, 8, 8]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1} transparent opacity={0.3} />
      </mesh>
      <pointLight color={color} intensity={2} distance={3} />
    </group>
  );
}

// --- ImpactFlash: explosion ring + sphere ---

interface ImpactFlashProps {
  position: { x: number; z: number };
  color?: string;
  onComplete: () => void;
}

export function ImpactFlash({ position, color = "#ffaa00", onComplete }: ImpactFlashProps) {
  const sphereRef = useRef<THREE.Mesh>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  const timer = useRef(0);
  const worldPos = useRef(gridToWorld(position));
  const done = useRef(false);

  useFrame((_, delta) => {
    if (done.current) return;
    timer.current += delta;
    const t = timer.current;
    if (t >= 0.5) { done.current = true; onComplete(); return; }
    const progress = t / 0.5;
    if (sphereRef.current) {
      sphereRef.current.scale.setScalar(progress * 3);
      (sphereRef.current.material as THREE.MeshStandardMaterial).opacity = 1 - progress;
    }
    if (ringRef.current) {
      ringRef.current.scale.set(progress * 5, progress * 5, 1);
      (ringRef.current.material as THREE.MeshStandardMaterial).opacity = (1 - progress) * 0.8;
    }
  });

  return (
    <group position={worldPos.current.toArray()}>
      <mesh ref={sphereRef}>
        <sphereGeometry args={[0.2, 12, 12]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={4} transparent opacity={1} />
      </mesh>
      <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.8, 1, 24]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={2} transparent opacity={0.8} side={THREE.DoubleSide} />
      </mesh>
      <pointLight color={color} intensity={4} distance={4} decay={2} />
    </group>
  );
}

// --- SlashEffect: arc sweep for melee attacks ---

interface SlashEffectProps {
  position: { x: number; z: number };
  color: string;
  onComplete: () => void;
}

export function SlashEffect({ position, color, onComplete }: SlashEffectProps) {
  const ref = useRef<THREE.Mesh>(null);
  const timer = useRef(0);
  const worldPos = useRef(gridToWorld(position));
  const done = useRef(false);

  useFrame((_, delta) => {
    if (!ref.current || done.current) return;
    timer.current += delta;
    const t = timer.current;
    if (t >= 0.4) { done.current = true; onComplete(); return; }
    const progress = t / 0.4;
    ref.current.rotation.z = -Math.PI * 0.3 + progress * Math.PI * 0.6;
    const scale = progress < 0.5 ? progress * 2 : 1;
    ref.current.scale.set(scale * 1.5, scale * 0.3, 1);
    (ref.current.material as THREE.MeshStandardMaterial).opacity = progress < 0.3 ? 1 : 1 - (progress - 0.3) / 0.7;
  });

  return (
    <mesh ref={ref} position={[worldPos.current.x, worldPos.current.y + 0.3, worldPos.current.z]}>
      <planeGeometry args={[1.2, 0.6]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={3} transparent opacity={1} side={THREE.DoubleSide} depthWrite={false} />
    </mesh>
  );
}

// --- ShieldEffect: protective bubble ---

interface ShieldEffectProps {
  position: { x: number; z: number };
  color: string;
  onComplete: () => void;
}

export function ShieldEffect({ position, color, onComplete }: ShieldEffectProps) {
  const ref = useRef<THREE.Mesh>(null);
  const timer = useRef(0);
  const worldPos = useRef(gridToWorld(position));
  const done = useRef(false);

  useFrame((_, delta) => {
    if (!ref.current || done.current) return;
    timer.current += delta;
    const t = timer.current;
    if (t >= 1.0) { done.current = true; onComplete(); return; }
    const progress = t / 1.0;
    const scale = progress < 0.2 ? (progress / 0.2) * 0.8 : 0.8;
    ref.current.scale.setScalar(scale);
    const pulse = 0.3 + Math.sin(t * 10) * 0.15;
    const fadeOut = progress > 0.7 ? 1 - (progress - 0.7) / 0.3 : 1;
    (ref.current.material as THREE.MeshStandardMaterial).opacity = pulse * fadeOut;
    ref.current.rotation.y += delta * 2;
  });

  return (
    <mesh ref={ref} position={worldPos.current.toArray()}>
      <icosahedronGeometry args={[1, 1]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1} transparent opacity={0.3} wireframe side={THREE.DoubleSide} />
    </mesh>
  );
}

// --- DustPuff: particles when moving ---

interface DustPuffProps {
  position: { x: number; z: number };
  onComplete: () => void;
}

const DUST_COUNT = 6;

export function DustPuff({ position, onComplete }: DustPuffProps) {
  const groupRef = useRef<THREE.Group>(null);
  const timer = useRef(0);
  const worldPos = useRef(gridToWorld(position));
  const done = useRef(false);
  const velocities = useRef(
    Array.from({ length: DUST_COUNT }, () => ({
      x: (Math.random() - 0.5) * 2,
      y: Math.random() * 1.5 + 0.5,
      z: (Math.random() - 0.5) * 2,
    })),
  );

  useFrame((_, delta) => {
    if (!groupRef.current || done.current) return;
    timer.current += delta;
    const t = timer.current;
    if (t >= 0.6) { done.current = true; onComplete(); return; }
    const progress = t / 0.6;
    const children = groupRef.current.children as THREE.Mesh[];
    children.forEach((child, i) => {
      const v = velocities.current[i];
      child.position.set(v.x * t, v.y * t - t * t * 2, v.z * t);
      child.scale.setScalar((1 - progress) * 0.5);
      (child.material as THREE.MeshStandardMaterial).opacity = 1 - progress;
    });
  });

  return (
    <group ref={groupRef} position={worldPos.current.toArray()}>
      {Array.from({ length: DUST_COUNT }, (_, i) => (
        <mesh key={i}>
          <sphereGeometry args={[0.08, 6, 6]} />
          <meshStandardMaterial color="#8b7355" transparent opacity={1} />
        </mesh>
      ))}
    </group>
  );
}

// --- DamageNumber: floating damage text ---

interface DamageNumberProps {
  position: { x: number; z: number };
  damage: number;
  isCrit?: boolean;
  onComplete: () => void;
}

export function DamageNumber({ position, damage, isCrit, onComplete }: DamageNumberProps) {
  const timer = useRef(0);
  const done = useRef(false);
  const worldPos = useRef(gridToWorld(position));
  const offsetY = useRef(0);
  const opacity = useRef(1);

  useFrame((_, delta) => {
    if (done.current) return;
    timer.current += delta;
    const t = timer.current;
    if (t >= 1.0) { done.current = true; onComplete(); return; }
    offsetY.current = t * 1.5;
    opacity.current = t > 0.6 ? 1 - (t - 0.6) / 0.4 : 1;
  });

  if (damage <= 0) return null;

  return (
    <group position={worldPos.current.toArray()}>
      <Html position={[0, 1.5 + offsetY.current, 0]} center distanceFactor={8}>
        <span
          className="pointer-events-none select-none font-bold drop-shadow-lg"
          style={{
            color: isCrit ? "#fbbf24" : "#ef4444",
            fontSize: isCrit ? "18px" : "14px",
            opacity: opacity.current,
            textShadow: isCrit ? "0 0 12px rgba(251,191,36,0.9)" : "0 0 8px rgba(239,68,68,0.8)",
          }}
        >
          {isCrit ? "CRIT " : ""}-{damage}
        </span>
      </Html>
    </group>
  );
}

// --- HealEffect: green particles rising ---

interface HealEffectProps {
  position: { x: number; z: number };
  onComplete: () => void;
}

const HEAL_PARTICLE_COUNT = 8;

export function HealEffect({ position, onComplete }: HealEffectProps) {
  const groupRef = useRef<THREE.Group>(null);
  const timer = useRef(0);
  const worldPos = useRef(gridToWorld(position));
  const done = useRef(false);
  const offsets = useRef(
    Array.from({ length: HEAL_PARTICLE_COUNT }, () => ({
      x: (Math.random() - 0.5) * 0.6,
      z: (Math.random() - 0.5) * 0.6,
      speed: 0.8 + Math.random() * 0.8,
      phase: Math.random() * Math.PI * 2,
    })),
  );

  useFrame((_, delta) => {
    if (!groupRef.current || done.current) return;
    timer.current += delta;
    const t = timer.current;
    if (t >= 1.2) { done.current = true; onComplete(); return; }
    const progress = t / 1.2;
    const children = groupRef.current.children as THREE.Mesh[];
    children.forEach((child, i) => {
      const o = offsets.current[i];
      child.position.set(
        o.x + Math.sin(t * 3 + o.phase) * 0.1,
        t * o.speed,
        o.z + Math.cos(t * 3 + o.phase) * 0.1,
      );
      child.scale.setScalar((1 - progress) * 0.3);
      (child.material as THREE.MeshStandardMaterial).opacity = 1 - progress;
    });
  });

  return (
    <group ref={groupRef} position={worldPos.current.toArray()}>
      {Array.from({ length: HEAL_PARTICLE_COUNT }, (_, i) => (
        <mesh key={i}>
          <sphereGeometry args={[0.06, 6, 6]} />
          <meshStandardMaterial color="#22c55e" emissive="#22c55e" emissiveIntensity={2} transparent opacity={1} />
        </mesh>
      ))}
    </group>
  );
}

// --- ChargeEffect: energy ring around fighter ---

interface ChargeEffectProps {
  position: { x: number; z: number };
  color: string;
  onComplete: () => void;
}

export function ChargeEffect({ position, color, onComplete }: ChargeEffectProps) {
  const ref = useRef<THREE.Mesh>(null);
  const timer = useRef(0);
  const worldPos = useRef(gridToWorld(position));
  const done = useRef(false);

  useFrame((_, delta) => {
    if (!ref.current || done.current) return;
    timer.current += delta;
    const t = timer.current;
    if (t >= 1.0) { done.current = true; onComplete(); return; }
    const progress = t / 1.0;

    // Rings rise and pulse
    ref.current.position.y = worldPos.current.y + t * 0.5;
    ref.current.rotation.x = Math.PI / 2;
    const scale = 0.5 + Math.sin(t * 8) * 0.2;
    ref.current.scale.setScalar(scale);
    (ref.current.material as THREE.MeshStandardMaterial).opacity = 1 - progress;
  });

  return (
    <mesh ref={ref} position={worldPos.current.toArray()}>
      <torusGeometry args={[0.5, 0.05, 8, 24]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={3} transparent opacity={1} side={THREE.DoubleSide} />
    </mesh>
  );
}

// --- DashTrail: speed lines ---

interface DashTrailProps {
  position: { x: number; z: number };
  color: string;
  onComplete: () => void;
}

export function DashTrail({ position, color, onComplete }: DashTrailProps) {
  const groupRef = useRef<THREE.Group>(null);
  const timer = useRef(0);
  const worldPos = useRef(gridToWorld(position));
  const done = useRef(false);

  useFrame((_, delta) => {
    if (!groupRef.current || done.current) return;
    timer.current += delta;
    if (timer.current >= 0.5) { done.current = true; onComplete(); return; }
    const progress = timer.current / 0.5;
    const children = groupRef.current.children as THREE.Mesh[];
    children.forEach((child) => {
      (child.material as THREE.MeshStandardMaterial).opacity = (1 - progress) * 0.6;
    });
  });

  return (
    <group ref={groupRef} position={worldPos.current.toArray()}>
      {[-0.2, 0, 0.2].map((offset, i) => (
        <mesh key={i} position={[offset, 0.3 + i * 0.15, 0]} rotation={[0, 0, Math.PI / 2]}>
          <planeGeometry args={[0.8, 0.05]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={2} transparent opacity={0.6} side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
}

// --- CounterSlash: red counter-attack arc ---

interface CounterSlashProps {
  position: { x: number; z: number };
  onComplete: () => void;
}

export function CounterSlash({ position, onComplete }: CounterSlashProps) {
  const ref = useRef<THREE.Mesh>(null);
  const timer = useRef(0);
  const worldPos = useRef(gridToWorld(position));
  const done = useRef(false);

  useFrame((_, delta) => {
    if (!ref.current || done.current) return;
    timer.current += delta;
    const t = timer.current;
    if (t >= 0.35) { done.current = true; onComplete(); return; }
    const progress = t / 0.35;
    ref.current.rotation.z = Math.PI * 0.3 - progress * Math.PI * 0.6;
    const scale = progress < 0.4 ? progress * 2.5 : 1;
    ref.current.scale.set(scale * 1.2, scale * 0.25, 1);
    (ref.current.material as THREE.MeshStandardMaterial).opacity = 1 - progress;
  });

  return (
    <mesh ref={ref} position={[worldPos.current.x, worldPos.current.y + 0.5, worldPos.current.z]}>
      <planeGeometry args={[1.0, 0.5]} />
      <meshStandardMaterial color="#ff2222" emissive="#ff2222" emissiveIntensity={4} transparent opacity={1} side={THREE.DoubleSide} depthWrite={false} />
    </mesh>
  );
}
