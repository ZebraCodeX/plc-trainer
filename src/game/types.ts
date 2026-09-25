import type { Project } from '../engine/model';

/* ------------------------------------------------------------------ */
/* Behavioural test harness                                            */
/* ------------------------------------------------------------------ */

/** One step in a mission's test script: drive an input, then check tags. */
export interface GameAction {
  /** Force these tags before advancing the scans. */
  set?: Record<string, boolean | number>;
  /** Advance the PLC this many scans (default 1). */
  ticks?: number;
  /** Tags that must equal the expected value at the end of this step. */
  expect?: Record<string, boolean | number>;
  /** Optional human-readable label for the step. */
  label?: string;
}

export interface MissionTest {
  id: string;
  name: string;
  actions: GameAction[];
}

/* ------------------------------------------------------------------ */
/* Missions                                                            */
/* ------------------------------------------------------------------ */

export interface MissionObjective {
  id: string;
  text: string;
  /** Grep checked against the compiled ladder/ST text. */
  requires?: string;
}

export interface MissionHint {
  /** XP cost to unlock. */
  cost: number;
  text: string;
}

export interface Mission {
  id: string;
  title: string;
  codename: string;
  difficulty: 1 | 2 | 3 | 4 | 5;
  /** XP awarded on first completion. */
  reward: number;
  /** Time limit in seconds (0 = untimed). */
  timeLimit: number;
  brief: string;
  /** The broken machine description shown in the console. */
  fault: string;
  /** Tags the player has access to on this level. */
  io: { name: string; dataType: 'BOOL' | 'REAL' | 'INT' | 'TIMER' | 'COUNTER'; note?: string; preset?: number }[];
  /** A visible machine schematic (process component id prefilled). */
  machine?: { type: 'motor' | 'conveyor' | 'tank' | 'valve' | 'trafficLight' | 'heater'; label: string };
  objectives: MissionObjective[];
  hints: MissionHint[];
  tests: MissionTest[];
  /** Starting (broken or empty) program source. Ladder represented as pseudo-lines. */
  starter: string;
  /** Optional starting rung spec for ladder missions handled in the runner. */
  tutorial?: string;
}

/* ------------------------------------------------------------------ */
/* Progress                                                            */
/* ------------------------------------------------------------------ */

export type Rank = 'Trainee' | 'Apprentice' | 'Technician' | 'Engineer' | 'Senior' | 'Controls Lead';

export interface MissionResult {
  missionId: string;
  stars: number;
  bestScore: number;
  bestTimeMs: number;
  attempts: number;
  completedAt: number;
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
}

export interface GameProgress {
  xp: number;
  completed: Record<string, MissionResult>;
  achievements: string[];
  hintsUnlocked: Record<string, string[]>;
  currentStreak: number;
  failures: number;
}

export function emptyProgress(): GameProgress {
  return {
    xp: 0,
    completed: {},
    achievements: [],
    hintsUnlocked: {},
    currentStreak: 0,
    failures: 0,
  };
}

/* ------------------------------------------------------------------ */
/* Rank / level maths                                                  */
/* ------------------------------------------------------------------ */

export const RANK_THRESHOLDS: { rank: Rank; xp: number }[] = [
  { rank: 'Trainee', xp: 0 },
  { rank: 'Apprentice', xp: 200 },
  { rank: 'Technician', xp: 600 },
  { rank: 'Engineer', xp: 1400 },
  { rank: 'Senior', xp: 2800 },
  { rank: 'Controls Lead', xp: 5000 },
];

export function rankForXp(xp: number): Rank {
  let rank: Rank = 'Trainee';
  for (const t of RANK_THRESHOLDS) if (xp >= t.xp) rank = t.rank;
  return rank;
}

export function nextRankThreshold(xp: number): { rank: Rank; xp: number } | null {
  return RANK_THRESHOLDS.find((t) => t.xp > xp) ?? null;
}

export function levelForXp(xp: number): number {
  // Level rises every 100 XP.
  return Math.max(1, Math.floor(xp / 100) + 1);
}

export function levelProgress(xp: number): { level: number; into: number; span: number } {
  const level = levelForXp(xp);
  const base = (level - 1) * 100;
  return { level, into: xp - base, span: 100 };
}

/* ------------------------------------------------------------------ */
/* Run state (transient, per attempt)                                  */
/* ------------------------------------------------------------------ */

export interface GameRun {
  missionId: string;
  status: 'briefing' | 'running' | 'won' | 'lost';
  startedAt: number;
  elapsedMs: number;
  /** Which test is currently being evaluated. */
  testIndex: number;
  testResults: { id: string; name: string; pass: boolean; log: string[] }[];
  score: number;
  hintsUsed: string[];
  log: string[];
}

export interface Game {
  missions: Mission[];
  feedback: string;
}

void ({} as Project);
