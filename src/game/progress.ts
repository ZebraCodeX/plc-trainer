import type { GameProgress, MissionResult } from './types';
import { emptyProgress } from './types';

const KEY = 'plc-trainer.game.v1';

export function loadProgress(): GameProgress {
  if (typeof localStorage === 'undefined') return emptyProgress();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return emptyProgress();
    const parsed = JSON.parse(raw) as GameProgress;
    return { ...emptyProgress(), ...parsed };
  } catch {
    return emptyProgress();
  }
}

export function saveProgress(progress: GameProgress): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(KEY, JSON.stringify(progress));
  } catch {
    /* ignore */
  }
}

export function resetProgress(): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.removeItem(KEY);
}

export function recordResult(progress: GameProgress, result: MissionResult, xp: number): GameProgress {
  const prev = progress.completed[result.missionId];
  const merged: MissionResult = prev
    ? {
        ...result,
        stars: Math.max(prev.stars, result.stars),
        bestScore: Math.max(prev.bestScore, result.bestScore),
        bestTimeMs: Math.min(prev.bestTimeMs || result.bestTimeMs, result.bestTimeMs),
        attempts: prev.attempts + 1,
      }
    : { ...result, attempts: 1 };
  return {
    ...progress,
    xp: progress.xp + xp,
    completed: { ...progress.completed, [result.missionId]: merged },
    currentStreak: result.stars > 0 ? progress.currentStreak + 1 : 0,
  };
}

export function unlockAchievement(progress: GameProgress, id: string): GameProgress {
  if (progress.achievements.includes(id)) return progress;
  return { ...progress, achievements: [...progress.achievements, id] };
}
