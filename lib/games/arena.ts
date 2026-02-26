import { z } from "zod";

// --- Types ---

export const actionSchema = z.object({
  type: z.enum(["move", "attack", "defend", "special", "dash", "heal", "charge"]).describe(
    "move: move 1 tile (2 with Speed passive). attack: melee 15-25 dmg (adjacent). defend: block 50% + counter 8 dmg if hit. special: ranged 10-20 dmg within 3 tiles, blocked by walls (3-turn cd). dash: move 2 tiles (3-turn cd). heal: restore 15 HP (2 uses). charge: skip turn, next attack 1.5x."
  ),
  direction: z
    .enum(["north", "south", "east", "west"])
    .optional()
    .describe("Direction for move/dash actions"),
  reasoning: z.string().describe("Brief tactical reasoning for this action"),
});

export type Action = z.infer<typeof actionSchema>;

export type TileType = "empty" | "wall" | "lava";

export type PowerUpType = "heal" | "damage" | "shield";

export interface PowerUp {
  position: { x: number; z: number };
  type: PowerUpType;
}

export interface PassiveAbility {
  name: string;
  description: string;
}

export interface FighterState {
  id: "a" | "b";
  modelId: string;
  modelName: string;
  hp: number;
  maxHp: number;
  position: { x: number; z: number };
  defending: boolean;
  specialCooldown: number;
  dashCooldown: number;
  healUses: number;
  chargeActive: boolean;
  consecutiveCount: number;
  lastActionType: string | null;
  powerUpEffects: {
    damageBoost: boolean;
    shieldActive: boolean;
  };
  passive: PassiveAbility;
  lastActions: Action[];
}

export interface TurnResult {
  fighter: "a" | "b";
  action: Action;
  damage: number;
  narration: string;
  isCrit: boolean;
  knockback: boolean;
  counterDamage: number;
  dodged: boolean;
}

export interface RoundResult {
  round: number;
  resultA: TurnResult;
  resultB: TurnResult;
  narrationSummary: string;
}

export interface GameState {
  fighters: [FighterState, FighterState];
  round: number;
  log: RoundResult[];
  winner: "a" | "b" | "draw" | null;
  terrain: TileType[][];
  powerUps: PowerUp[];
  shrinkLevel: number;
}

// --- Constants ---

export const GRID_SIZE = 10;
const ATTACK_MIN = 15;
const ATTACK_MAX = 25;
const SPECIAL_MIN = 10;
const SPECIAL_MAX = 20;
const SPECIAL_RANGE = 3;
const SPECIAL_COOLDOWN = 3;
const DASH_COOLDOWN = 3;
const HEAL_AMOUNT = 15;
const MAX_HEAL_USES = 2;
const CHARGE_MULTIPLIER = 1.5;
const CRIT_CHANCE = 0.15;
const CRIT_MULTIPLIER = 2;
const COUNTER_DAMAGE = 8;
const COMBO_DECAY_THRESHOLD = 3;
const COMBO_DECAY_FACTOR = 0.7;
const LAVA_DAMAGE = 10;
const WALL_KNOCKBACK_DAMAGE = 5;
const SHRINK_INTERVAL = 10;
const POWERUP_SPAWN_INTERVAL = 4;
export const MAX_ROUNDS = 25;

export const FIGHTER_A_COLOR = "#4488ff";
export const FIGHTER_B_COLOR = "#ff4444";

// --- Passive Names ---

const PASSIVE = {
  SPEED: "Speed",
  FORTIFIED: "Fortified",
  REGENERATION: "Regeneration",
  EVASION: "Evasion",
  BERSERKER: "Berserker",
  UNPREDICTABLE: "Unpredictable",
} as const;

// --- Model Passives ---

export const MODEL_PASSIVES: Record<string, PassiveAbility> = {
  "google/gemini-2.5-flash": { name: "Speed", description: "Regular move goes 2 tiles" },
  "google/gemini-2.5-pro": { name: "Fortified", description: "Takes 10% less damage" },
  "anthropic/claude-sonnet-4.5": { name: "Regeneration", description: "Recover 3 HP per turn" },
  "openai/gpt-4o": { name: "Evasion", description: "15% dodge chance" },
  "xai/grok-4.1-fast-non-reasoning": { name: "Berserker", description: "Crits deal 3x instead of 2x" },
  "meta-llama/llama-4-maverick": { name: "Unpredictable", description: "20% chance for +10 bonus damage" },
};

const DEFAULT_PASSIVE: PassiveAbility = { name: "None", description: "No passive ability" };

export function getPassive(modelId: string): PassiveAbility {
  return MODEL_PASSIVES[modelId] ?? DEFAULT_PASSIVE;
}

// --- Helpers ---

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function distance(a: { x: number; z: number }, b: { x: number; z: number }): number {
  return Math.abs(a.x - b.x) + Math.abs(a.z - b.z);
}

function isAdjacent(a: { x: number; z: number }, b: { x: number; z: number }): boolean {
  return distance(a, b) === 1;
}

function isInRange(a: { x: number; z: number }, b: { x: number; z: number }, range: number): boolean {
  return distance(a, b) <= range;
}

function clampToGrid(val: number): number {
  return Math.max(0, Math.min(GRID_SIZE - 1, val));
}

function moveInDirection(pos: { x: number; z: number }, dir: string, steps: number = 1): { x: number; z: number } {
  const newPos = { ...pos };
  for (let i = 0; i < steps; i++) {
    switch (dir) {
      case "north": newPos.z = clampToGrid(newPos.z - 1); break;
      case "south": newPos.z = clampToGrid(newPos.z + 1); break;
      case "east": newPos.x = clampToGrid(newPos.x + 1); break;
      case "west": newPos.x = clampToGrid(newPos.x - 1); break;
    }
  }
  return newPos;
}

function isWall(terrain: TileType[][], pos: { x: number; z: number }): boolean {
  return terrain[pos.z]?.[pos.x] === "wall";
}

function isLava(terrain: TileType[][], pos: { x: number; z: number }): boolean {
  return terrain[pos.z]?.[pos.x] === "lava";
}

function hasLineOfSight(terrain: TileType[][], from: { x: number; z: number }, to: { x: number; z: number }): boolean {
  const dx = Math.sign(to.x - from.x);
  const dz = Math.sign(to.z - from.z);
  let cx = from.x;
  let cz = from.z;

  while (cx !== to.x) {
    cx += dx;
    if (cx === to.x && cz === to.z) break;
    if (isWall(terrain, { x: cx, z: cz })) return false;
  }
  while (cz !== to.z) {
    cz += dz;
    if (cx === to.x && cz === to.z) break;
    if (isWall(terrain, { x: cx, z: cz })) return false;
  }
  return true;
}

function getKnockbackDir(attacker: { x: number; z: number }, defender: { x: number; z: number }): string {
  const dx = defender.x - attacker.x;
  const dz = defender.z - attacker.z;
  if (Math.abs(dx) >= Math.abs(dz)) {
    return dx >= 0 ? "east" : "west";
  }
  return dz >= 0 ? "south" : "north";
}

// --- Terrain Generation ---

function generateTerrain(): TileType[][] {
  const terrain: TileType[][] = Array.from({ length: GRID_SIZE }, () =>
    Array.from({ length: GRID_SIZE }, () => "empty" as TileType),
  );

  const wallCount = randInt(5, 8);
  let placed = 0;
  while (placed < wallCount) {
    const x = randInt(0, GRID_SIZE - 1);
    const z = randInt(0, GRID_SIZE - 1);
    if (x >= 1 && x <= 3 && z >= 4 && z <= 6) continue;
    if (x >= 6 && x <= 8 && z >= 4 && z <= 6) continue;
    if (terrain[z][x] === "empty") {
      terrain[z][x] = "wall";
      placed++;
    }
  }

  const lavaCount = randInt(2, 3);
  placed = 0;
  while (placed < lavaCount) {
    const x = randInt(0, GRID_SIZE - 1);
    const z = randInt(0, GRID_SIZE - 1);
    if (x >= 1 && x <= 3 && z >= 4 && z <= 6) continue;
    if (x >= 6 && x <= 8 && z >= 4 && z <= 6) continue;
    if (terrain[z][x] === "empty") {
      terrain[z][x] = "lava";
      placed++;
    }
  }

  return terrain;
}

function shrinkArena(terrain: TileType[][], level: number): TileType[][] {
  const newTerrain = terrain.map((row) => [...row]);
  for (let i = 0; i < level; i++) {
    for (let x = 0; x < GRID_SIZE; x++) {
      for (let z = 0; z < GRID_SIZE; z++) {
        if (x === i || x === GRID_SIZE - 1 - i || z === i || z === GRID_SIZE - 1 - i) {
          if (newTerrain[z][x] !== "wall") {
            newTerrain[z][x] = "lava";
          }
        }
      }
    }
  }
  return newTerrain;
}

// --- Power-Up Spawning ---

function spawnPowerUp(terrain: TileType[][], fighters: [FighterState, FighterState], existingPowerUps: PowerUp[]): PowerUp | null {
  const types: PowerUpType[] = ["heal", "damage", "shield"];
  let attempts = 0;
  while (attempts < 30) {
    const x = randInt(1, GRID_SIZE - 2);
    const z = randInt(1, GRID_SIZE - 2);
    if (terrain[z][x] !== "empty") { attempts++; continue; }
    if (fighters.some((f) => f.position.x === x && f.position.z === z)) { attempts++; continue; }
    if (existingPowerUps.some((p) => p.position.x === x && p.position.z === z)) { attempts++; continue; }
    return { position: { x, z }, type: types[randInt(0, types.length - 1)] };
  }
  return null;
}

// --- Damage Helpers ---

type Pos = { x: number; z: number };

interface DamageCalcResult {
  damage: number;
  isCrit: boolean;
}

function computeAttackDamage(
  baseDmg: number,
  attacker: FighterState,
  comboMultiplier: number,
): DamageCalcResult {
  let d = baseDmg;
  let isCrit = false;

  d = Math.floor(d * comboMultiplier);

  if (attacker.chargeActive) {
    d = Math.floor(d * CHARGE_MULTIPLIER);
  }

  if (attacker.powerUpEffects.damageBoost) {
    d += 10;
  }

  if (Math.random() < CRIT_CHANCE) {
    const critMult = attacker.passive.name === PASSIVE.BERSERKER ? 3 : CRIT_MULTIPLIER;
    d = Math.floor(d * critMult);
    isCrit = true;
  }

  if (attacker.passive.name === PASSIVE.UNPREDICTABLE && Math.random() < 0.2) {
    d += 10;
  }

  return { damage: d, isCrit };
}

interface DefenseResult {
  finalDamage: number;
  dodged: boolean;
}

function applyDefenses(
  damage: number,
  defender: FighterState,
): DefenseResult {
  let d = damage;

  if (defender.passive.name === PASSIVE.EVASION && Math.random() < 0.15) {
    return { finalDamage: 0, dodged: true };
  }

  if (defender.powerUpEffects.shieldActive) {
    d = Math.floor(d * 0.5);
  }

  if (defender.defending) {
    d = Math.floor(d * 0.5);
  }

  if (defender.passive.name === PASSIVE.FORTIFIED) {
    d = Math.floor(d * 0.9);
  }

  return { finalDamage: d, dodged: false };
}

// --- Game State ---

export function createInitialState(
  modelA: { id: string; name: string },
  modelB: { id: string; name: string },
): GameState {
  return {
    fighters: [
      {
        id: "a",
        modelId: modelA.id,
        modelName: modelA.name,
        hp: 100,
        maxHp: 100,
        position: { x: 2, z: 5 },
        defending: false,
        specialCooldown: 0,
        dashCooldown: 0,
        healUses: MAX_HEAL_USES,
        chargeActive: false,
        consecutiveCount: 0,
        lastActionType: null,
        powerUpEffects: { damageBoost: false, shieldActive: false },
        passive: getPassive(modelA.id),
        lastActions: [],
      },
      {
        id: "b",
        modelId: modelB.id,
        modelName: modelB.name,
        hp: 100,
        maxHp: 100,
        position: { x: 7, z: 5 },
        defending: false,
        specialCooldown: 0,
        dashCooldown: 0,
        healUses: MAX_HEAL_USES,
        chargeActive: false,
        consecutiveCount: 0,
        lastActionType: null,
        powerUpEffects: { damageBoost: false, shieldActive: false },
        passive: getPassive(modelB.id),
        lastActions: [],
      },
    ],
    round: 1,
    log: [],
    winner: null,
    terrain: generateTerrain(),
    powerUps: [],
    shrinkLevel: 0,
  };
}

// --- Simultaneous Round Resolution ---

function resolveMovement(
  fighter: FighterState,
  action: Action,
  terrain: TileType[][],
  opponentOrigPos: Pos,
): Pos {
  const type = action.type;
  if (type !== "move" && type !== "dash") return { ...fighter.position };

  if (type === "dash" && fighter.dashCooldown > 0) return { ...fighter.position };

  const dir = action.direction ?? "north";
  const steps = type === "move" && fighter.passive.name === PASSIVE.SPEED ? 2 : type === "dash" ? 2 : 1;
  const pos = { ...fighter.position };

  for (let s = 0; s < steps; s++) {
    const next = moveInDirection(pos, dir, 1);
    if (next.x === pos.x && next.z === pos.z) break;
    if (isWall(terrain, next)) break;
    if (next.x === opponentOrigPos.x && next.z === opponentOrigPos.z) break;
    pos.x = next.x;
    pos.z = next.z;
  }

  return pos;
}

function pickupPowerUp(
  fighter: FighterState,
  powerUps: PowerUp[],
): { pickupMsg: string; pickedIndex: number } {
  const idx = powerUps.findIndex(
    (p) => p.position.x === fighter.position.x && p.position.z === fighter.position.z,
  );
  if (idx === -1) return { pickupMsg: "", pickedIndex: -1 };

  const pu = powerUps[idx];
  let pickupMsg = "";
  switch (pu.type) {
    case "heal":
      fighter.hp = Math.min(fighter.maxHp, fighter.hp + 25);
      pickupMsg = " Picked up heal (+25 HP)!";
      break;
    case "damage":
      fighter.powerUpEffects.damageBoost = true;
      pickupMsg = " Picked up damage boost!";
      break;
    case "shield":
      fighter.powerUpEffects.shieldActive = true;
      pickupMsg = " Picked up shield!";
      break;
  }
  return { pickupMsg, pickedIndex: idx };
}

function resolveAttack(
  attacker: FighterState,
  defender: FighterState,
  action: Action,
  terrain: TileType[][],
  comboMultiplier: number,
): { damage: number; narration: string; isCrit: boolean; knockback: boolean; counterDamage: number; dodged: boolean } {
  let damage = 0;
  let narration = "";
  let isCrit = false;
  let knockback = false;
  let counterDamage = 0;
  let dodged = false;

  if (action.type === "attack") {
    if (isAdjacent(attacker.position, defender.position)) {
      const baseDmg = randInt(ATTACK_MIN, ATTACK_MAX);
      const calc = computeAttackDamage(baseDmg, attacker, comboMultiplier);
      damage = calc.damage;
      isCrit = calc.isCrit;

      // Consume charge/damage boost
      attacker.chargeActive = false;
      attacker.powerUpEffects.damageBoost = false;

      const def = applyDefenses(damage, defender);
      dodged = def.dodged;

      if (dodged) {
        narration = `${attacker.modelName} attacks but ${defender.modelName} dodges (Evasion)!`;
        damage = 0;
      } else {
        damage = def.finalDamage;
        defender.hp = Math.max(0, defender.hp - damage);

        // Consume shield after use
        if (defender.powerUpEffects.shieldActive) defender.powerUpEffects.shieldActive = false;

        narration = `${attacker.modelName} attacks for ${damage} damage${isCrit ? " (CRITICAL!)" : ""}${defender.defending ? " (partially blocked)" : ""}!`;

        if (defender.defending && !dodged) {
          counterDamage = COUNTER_DAMAGE;
          attacker.hp = Math.max(0, attacker.hp - counterDamage);
          narration += ` ${defender.modelName} counters for ${counterDamage}!`;
        }

        // Knockback
        const kbDir = getKnockbackDir(attacker.position, defender.position);
        const kbPos = moveInDirection(defender.position, kbDir, 1);
        if (kbPos.x !== defender.position.x || kbPos.z !== defender.position.z) {
          if (isWall(terrain, kbPos)) {
            defender.hp = Math.max(0, defender.hp - WALL_KNOCKBACK_DAMAGE);
            narration += ` Knocked into wall (+${WALL_KNOCKBACK_DAMAGE})!`;
            knockback = true;
          } else if (kbPos.x === attacker.position.x && kbPos.z === attacker.position.z) {
            // Can't knockback into attacker
          } else {
            defender.position = kbPos;
            knockback = true;
            narration += " Knocked back!";
            if (isLava(terrain, kbPos)) {
              defender.hp = Math.max(0, defender.hp - LAVA_DAMAGE);
              narration += ` Into lava for ${LAVA_DAMAGE} damage!`;
            }
          }
        }
      }
    } else {
      narration = `${attacker.modelName} swings but misses — too far away!`;
    }
  } else if (action.type === "special") {
    if (attacker.specialCooldown > 0) {
      narration = `${attacker.modelName} tries to use special but it's on cooldown (${attacker.specialCooldown} rounds)!`;
    } else if (!isInRange(attacker.position, defender.position, SPECIAL_RANGE)) {
      narration = `${attacker.modelName} fires a special but the opponent is out of range!`;
      attacker.specialCooldown = SPECIAL_COOLDOWN;
    } else if (!hasLineOfSight(terrain, attacker.position, defender.position)) {
      narration = `${attacker.modelName} fires a special but a wall blocks the shot!`;
      attacker.specialCooldown = SPECIAL_COOLDOWN;
    } else {
      const baseDmg = randInt(SPECIAL_MIN, SPECIAL_MAX);
      const calc = computeAttackDamage(baseDmg, attacker, comboMultiplier);
      damage = calc.damage;
      isCrit = calc.isCrit;

      attacker.chargeActive = false;
      attacker.powerUpEffects.damageBoost = false;

      const def = applyDefenses(damage, defender);
      dodged = def.dodged;

      if (dodged) {
        narration = `${attacker.modelName} fires a special but ${defender.modelName} dodges (Evasion)!`;
        damage = 0;
      } else {
        damage = def.finalDamage;
        defender.hp = Math.max(0, defender.hp - damage);
        if (defender.powerUpEffects.shieldActive) defender.powerUpEffects.shieldActive = false;
        narration = `${attacker.modelName} fires a ranged special for ${damage} damage${isCrit ? " (CRITICAL!)" : ""}${defender.defending ? " (partially blocked)" : ""}!`;
      }
      attacker.specialCooldown = SPECIAL_COOLDOWN;
    }
  }

  return { damage, narration, isCrit, knockback, counterDamage, dodged };
}

export function applyRound(
  state: GameState,
  actionA: Action,
  actionB: Action,
): { state: GameState; result: RoundResult } {
  const s: GameState = JSON.parse(JSON.stringify(state));
  const fA = s.fighters[0];
  const fB = s.fighters[1];

  // --- Phase 0: Pre-round bookkeeping ---
  for (const f of s.fighters) {
    f.defending = false;
    if (f.specialCooldown > 0) f.specialCooldown--;
    if (f.dashCooldown > 0) f.dashCooldown--;
    if (f.passive.name === PASSIVE.REGENERATION && f.hp < f.maxHp) {
      f.hp = Math.min(f.maxHp, f.hp + 3);
    }
  }

  // Track combo decay for each fighter
  function getComboMultiplier(fighter: FighterState, action: Action): number {
    if (fighter.lastActionType === action.type) {
      fighter.consecutiveCount++;
    } else {
      fighter.consecutiveCount = 1;
      fighter.lastActionType = action.type;
    }
    return fighter.consecutiveCount >= COMBO_DECAY_THRESHOLD ? COMBO_DECAY_FACTOR : 1;
  }

  const comboA = getComboMultiplier(fA, actionA);
  const comboB = getComboMultiplier(fB, actionB);

  // --- Phase 1: Stances (defend, charge, heal) ---
  let narrA = "";
  let narrB = "";

  // Defend
  if (actionA.type === "defend") {
    fA.defending = true;
    narrA = `${fA.modelName} takes a defensive stance (counter-attack ready).`;
  }
  if (actionB.type === "defend") {
    fB.defending = true;
    narrB = `${fB.modelName} takes a defensive stance (counter-attack ready).`;
  }

  // Charge
  if (actionA.type === "charge") {
    fA.chargeActive = true;
    narrA = `${fA.modelName} charges up — next attack will deal 1.5x damage!`;
  }
  if (actionB.type === "charge") {
    fB.chargeActive = true;
    narrB = `${fB.modelName} charges up — next attack will deal 1.5x damage!`;
  }

  // Heal
  if (actionA.type === "heal") {
    if (fA.healUses <= 0) {
      narrA = `${fA.modelName} tries to heal but has no uses left!`;
    } else {
      fA.healUses--;
      const healAmt = Math.min(HEAL_AMOUNT, fA.maxHp - fA.hp);
      fA.hp += healAmt;
      narrA = `${fA.modelName} heals for ${healAmt} HP! (${fA.healUses} uses left)`;
    }
  }
  if (actionB.type === "heal") {
    if (fB.healUses <= 0) {
      narrB = `${fB.modelName} tries to heal but has no uses left!`;
    } else {
      fB.healUses--;
      const healAmt = Math.min(HEAL_AMOUNT, fB.maxHp - fB.hp);
      fB.hp += healAmt;
      narrB = `${fB.modelName} heals for ${healAmt} HP! (${fB.healUses} uses left)`;
    }
  }

  // --- Phase 2: Movement ---
  const origPosA: Pos = { ...fA.position };
  const origPosB: Pos = { ...fB.position };

  const isMovingA = actionA.type === "move" || actionA.type === "dash";
  const isMovingB = actionB.type === "move" || actionB.type === "dash";

  let destA = isMovingA ? resolveMovement(fA, actionA, s.terrain, origPosB) : { ...origPosA };
  let destB = isMovingB ? resolveMovement(fB, actionB, s.terrain, origPosA) : { ...origPosB };

  // Collision: both move to same tile → neither moves
  if (destA.x === destB.x && destA.z === destB.z && isMovingA && isMovingB) {
    destA = { ...origPosA };
    destB = { ...origPosB };
    if (!narrA) narrA = `${fA.modelName} and ${fB.modelName} collide — both stay put!`;
    if (!narrB) narrB = `${fB.modelName} and ${fA.modelName} collide — both stay put!`;
  } else {
    // Apply movement for A
    if (isMovingA) {
      fA.position = destA;
      const isDash = actionA.type === "dash";
      if (isDash && fA.dashCooldown <= 0) fA.dashCooldown = DASH_COOLDOWN;

      // Power-up pickup
      const { pickupMsg, pickedIndex } = pickupPowerUp(fA, s.powerUps);
      if (pickedIndex !== -1) s.powerUps.splice(pickedIndex, 1);

      // Lava check
      let lavaDmg = 0;
      if (isLava(s.terrain, fA.position)) {
        lavaDmg = LAVA_DAMAGE;
        fA.hp = Math.max(0, fA.hp - lavaDmg);
      }

      const dir = actionA.direction ?? "north";
      const steps = actionA.type === "move" && fA.passive.name === PASSIVE.SPEED ? 2 : isDash ? 2 : 1;
      if (fA.position.x === origPosA.x && fA.position.z === origPosA.z) {
        narrA = `${fA.modelName} tried to ${isDash ? "dash" : "move"} ${dir} but the path is blocked!`;
      } else if (!narrA) {
        narrA = `${fA.modelName} ${isDash ? "dashes" : "moves"} ${dir}${!isDash && steps > 1 ? " (Speed!)" : ""}.${pickupMsg}`;
        if (lavaDmg > 0) narrA += ` Stepped on lava for ${lavaDmg} damage!`;
      }
    }

    // Apply movement for B
    if (isMovingB) {
      fB.position = destB;
      const isDash = actionB.type === "dash";
      if (isDash && fB.dashCooldown <= 0) fB.dashCooldown = DASH_COOLDOWN;

      const { pickupMsg, pickedIndex } = pickupPowerUp(fB, s.powerUps);
      if (pickedIndex !== -1) s.powerUps.splice(pickedIndex, 1);

      let lavaDmg = 0;
      if (isLava(s.terrain, fB.position)) {
        lavaDmg = LAVA_DAMAGE;
        fB.hp = Math.max(0, fB.hp - lavaDmg);
      }

      const dir = actionB.direction ?? "north";
      const steps = actionB.type === "move" && fB.passive.name === PASSIVE.SPEED ? 2 : isDash ? 2 : 1;
      if (fB.position.x === origPosB.x && fB.position.z === origPosB.z) {
        narrB = `${fB.modelName} tried to ${isDash ? "dash" : "move"} ${dir} but the path is blocked!`;
      } else if (!narrB) {
        narrB = `${fB.modelName} ${isDash ? "dashes" : "moves"} ${dir}${!isDash && steps > 1 ? " (Speed!)" : ""}.${pickupMsg}`;
        if (lavaDmg > 0) narrB += ` Stepped on lava for ${lavaDmg} damage!`;
      }
    }
  }

  // --- Phase 3: Attacks (resolve against post-movement positions) ---
  let damageA = 0;
  let isCritA = false;
  let knockbackA = false;
  let counterDamageA = 0;
  let dodgedA = false;

  let damageB = 0;
  let isCritB = false;
  let knockbackB = false;
  let counterDamageB = 0;
  let dodgedB = false;

  const isAttackA = actionA.type === "attack" || actionA.type === "special";
  const isAttackB = actionB.type === "attack" || actionB.type === "special";

  if (isAttackA) {
    const r = resolveAttack(fA, fB, actionA, s.terrain, comboA);
    damageA = r.damage;
    narrA = r.narration;
    isCritA = r.isCrit;
    knockbackA = r.knockback;
    counterDamageA = r.counterDamage;
    dodgedA = r.dodged;
  }

  if (isAttackB) {
    const r = resolveAttack(fB, fA, actionB, s.terrain, comboB);
    damageB = r.damage;
    narrB = r.narration;
    isCritB = r.isCrit;
    knockbackB = r.knockback;
    counterDamageB = r.counterDamage;
    dodgedB = r.dodged;
  }

  // --- Phase 4: Record actions ---
  fA.lastActions = [...fA.lastActions.slice(-2), actionA];
  fB.lastActions = [...fB.lastActions.slice(-2), actionB];

  const resultA: TurnResult = {
    fighter: "a",
    action: actionA,
    damage: damageA,
    narration: narrA,
    isCrit: isCritA,
    knockback: knockbackA,
    counterDamage: counterDamageA,
    dodged: dodgedA,
  };

  const resultB: TurnResult = {
    fighter: "b",
    action: actionB,
    damage: damageB,
    narration: narrB,
    isCrit: isCritB,
    knockback: knockbackB,
    counterDamage: counterDamageB,
    dodged: dodgedB,
  };

  const narrationSummary = [narrA, narrB].filter(Boolean).join(" | ");

  const roundResult: RoundResult = {
    round: s.round,
    resultA,
    resultB,
    narrationSummary,
  };

  s.log.push(roundResult);

  // --- Phase 5: End-of-round ---
  // Winner check
  if (fA.hp <= 0 && fB.hp <= 0) {
    s.winner = "draw";
  } else if (fB.hp <= 0) {
    s.winner = "a";
  } else if (fA.hp <= 0) {
    s.winner = "b";
  }

  s.round++;

  // Shrink arena
  const newShrinkLevel = Math.floor(s.round / SHRINK_INTERVAL);
  if (newShrinkLevel > s.shrinkLevel && newShrinkLevel <= 4) {
    s.shrinkLevel = newShrinkLevel;
    s.terrain = shrinkArena(s.terrain, newShrinkLevel);
    for (const f of s.fighters) {
      if (isLava(s.terrain, f.position)) {
        f.hp = Math.max(0, f.hp - LAVA_DAMAGE);
      }
    }
  }

  // Power-up spawning
  if (s.round % POWERUP_SPAWN_INTERVAL === 0) {
    const pu = spawnPowerUp(s.terrain, s.fighters, s.powerUps);
    if (pu) s.powerUps.push(pu);
  }

  // Max rounds safety valve
  if (s.round > MAX_ROUNDS && !s.winner) {
    if (fA.hp === fB.hp) {
      s.winner = "draw";
    } else {
      s.winner = fA.hp > fB.hp ? "a" : "b";
    }
  }

  return { state: s, result: roundResult };
}

// --- Prompts ---

export const FIGHTER_SYSTEM_PROMPT = `You are a fighter in a 3D arena battle. Defeat your opponent by reducing their HP to 0.

## Simultaneous Turns
Both fighters choose their action at the same time each round. You do NOT know what your opponent will do this round. Plan for multiple possibilities.
- Movement resolves before attacks each round.
- If both fighters move to the same tile, neither moves.
- If both attack while adjacent, both take damage simultaneously.

## Actions
- **move** (direction): Move 1 tile. Some fighters move 2 (Speed passive).
- **attack**: Melee 15-25 dmg. Must be adjacent. Knocks opponent back 1 tile. Wall collision = +5 dmg. Lava knockback = 10 dmg.
- **defend**: Block 50% damage AND counter-attack for 8 damage if melee'd.
- **special**: Ranged 10-20 dmg, 3-tile range, 3-round cooldown. Blocked by walls (line of sight).
- **dash** (direction): Move 2 tiles, 3-round cooldown. Good for repositioning quickly.
- **heal**: Restore 15 HP. Limited to 2 uses per game. Use wisely.
- **charge**: Skip action, next attack/special deals 1.5x damage.

## Terrain
- **Walls**: Block movement, specials, and knockback.
- **Lava**: Deals 10 damage when stepped on or knocked into. Arena shrinks every ${SHRINK_INTERVAL} rounds (outer ring becomes lava).

## Power-ups
Spawn on the grid periodically. Move onto them to pick up:
- **Heal**: +25 HP
- **Damage**: Next attack +10 damage
- **Shield**: Blocks 50% of next incoming hit

## Combat Mechanics
- **Critical hits**: 15% chance for 2x damage (3x with Berserker passive).
- **Knockback**: Melee attacks push the opponent 1 tile away.
- **Counter-attack**: Defending fighters deal 8 damage back when melee'd.
- **Combo decay**: Same action 3+ times in a row = 30% less effective.
- **Evasion**: Some fighters have a 15% dodge chance.

## Arena
10x10 grid (0-9). Manhattan distance. Adjacent = distance 1.

Think tactically about terrain, cooldowns, positioning, and your passive ability. Anticipate what your opponent might do.`;

export function buildPrompt(state: GameState, fighterId: "a" | "b"): string {
  const fi = fighterId === "a" ? 0 : 1;
  const oi = fi === 0 ? 1 : 0;
  const me = state.fighters[fi];
  const them = state.fighters[oi];
  const dist = distance(me.position, them.position);

  const recentLog = state.log
    .slice(-3)
    .map((r) => `  Round ${r.round}: ${r.narrationSummary}`)
    .join("\n");

  const nearbyTerrain: string[] = [];
  for (let dx = -2; dx <= 2; dx++) {
    for (let dz = -2; dz <= 2; dz++) {
      const tx = me.position.x + dx;
      const tz = me.position.z + dz;
      if (tx < 0 || tx >= GRID_SIZE || tz < 0 || tz >= GRID_SIZE) continue;
      if (dx === 0 && dz === 0) continue;
      const tile = state.terrain[tz][tx];
      if (tile !== "empty") {
        nearbyTerrain.push(`  (${tx},${tz}): ${tile}`);
      }
    }
  }

  const powerUps = state.powerUps.map((p) => `  (${p.position.x},${p.position.z}): ${p.type}`);

  return `Round ${state.round} — You are ${me.modelName} (Fighter ${fighterId.toUpperCase()})
Both fighters choose simultaneously. You don't know your opponent's choice this round.

YOUR STATUS:
  HP: ${me.hp}/${me.maxHp}
  Position: (${me.position.x}, ${me.position.z})
  Passive: ${me.passive.name} — ${me.passive.description}
  Defending: ${me.defending ? "yes" : "no"}
  Charged: ${me.chargeActive ? "YES — next attack 1.5x!" : "no"}
  Special cooldown: ${me.specialCooldown > 0 ? `${me.specialCooldown} rounds` : "ready"}
  Dash cooldown: ${me.dashCooldown > 0 ? `${me.dashCooldown} rounds` : "ready"}
  Heal uses: ${me.healUses}
  Damage boost: ${me.powerUpEffects.damageBoost ? "YES" : "no"}
  Shield: ${me.powerUpEffects.shieldActive ? "YES" : "no"}

OPPONENT (${them.modelName}):
  HP: ${them.hp}/${them.maxHp}
  Position: (${them.position.x}, ${them.position.z})
  Passive: ${them.passive.name}
  Defending: ${them.defending ? "yes (will counter-attack if you melee!)" : "no"}

Distance: ${dist} tiles ${dist === 1 ? "(ADJACENT — can attack!)" : dist <= 3 ? "(in special range)" : "(out of range)"}

${nearbyTerrain.length > 0 ? `NEARBY TERRAIN:\n${nearbyTerrain.join("\n")}` : "No terrain nearby."}

${powerUps.length > 0 ? `POWER-UPS ON MAP:\n${powerUps.join("\n")}` : "No power-ups on the map."}

${state.shrinkLevel > 0 ? `ARENA SHRINKING — ${state.shrinkLevel} ring(s) of lava! Next shrink in ${SHRINK_INTERVAL - (state.round % SHRINK_INTERVAL)} rounds.` : `Arena shrinks at round ${SHRINK_INTERVAL}.`}

${recentLog ? `RECENT ROUNDS:\n${recentLog}` : "First round."}

Choose wisely.`;
}
