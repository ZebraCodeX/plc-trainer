import { create } from 'zustand';
import { MISSIONS, missionById } from './missions';
import type { AnyMission } from './mission-types';
import type { GameProgress, GameRun, MissionResult } from './types';
import { levelProgress, rankForXp } from './types';
import { loadProgress, recordResult, resetProgress, saveProgress, unlockAchievement } from './progress';
import { runTest, type MissionProgram, type TestResult } from './engine';

export interface GameNotification {
  id: string;
  kind: 'achievement' | 'levelup' | 'info';
  title: string;
  detail: string;
}

interface GameStore {
  progress: GameProgress;
  run: GameRun | null;
  notifications: GameNotification[];
  /* Editor state for the active mission. */
  draft: MissionProgram | null;

  startMission: (id: string) => void;
  closeRun: () => void;
  setDraft: (draft: MissionProgram) => void;
  runTests: () => TestResult[];
  submit: () => { won: boolean; results: TestResult[] };
  addNotification: (n: GameNotification) => void;
  dismissNotification: (id: string) => void;
  reset: () => void;
  rank: () => string;
  level: () => { level: number; into: number; span: number };
}

function starterProgram(mission: AnyMission): MissionProgram {
  if (mission.kind === 'st') {
    return { kind: 'st', source: mission.starter };
  }
  return { kind: 'ladder', rungs: mission.buildStarter() };
}

export const useGame = create<GameStore>((set, get) => ({
  progress: loadProgress(),
  run: null,
  notifications: [],
  draft: null,

  startMission: (id) => {
    const mission = missionById(id);
    if (!mission) return;
    set({
      draft: starterProgram(mission),
      run: {
        missionId: id,
        status: 'briefing',
        startedAt: Date.now(),
        elapsedMs: 0,
        testIndex: 0,
        testResults: [],
        score: 0,
        hintsUsed: [],
        log: [`Mission ${mission.codename}: ${mission.title}`, mission.brief],
      },
    });
  },

  closeRun: () => set({ run: null, draft: null }),

  setDraft: (draft) => set({ draft }),

  runTests: () => {
    const { run, draft } = get();
    if (!run || !draft) return [];
    const mission = missionById(run.missionId);
    if (!mission) return [];
    return mission.tests.map((t) => runTest(mission, draft, t));
  },

  submit: () => {
    const { run, draft, progress } = get();
    if (!run || !draft) return { won: false, results: [] };
    const mission = missionById(run.missionId);
    if (!mission) return { won: false, results: [] };

    const results = mission.tests.map((t) => runTest(mission, draft, t));
    const won = results.every((r) => r.pass);
    const elapsedMs = run.elapsedMs;

    if (!won) {
      set({
        run: { ...run, status: 'lost', testResults: results, elapsedMs },
        progress: { ...progress, failures: progress.failures + 1 },
      });
      saveProgress(get().progress);
      return { won: false, results };
    }

    // Score: base reward, time bonus (timed missions), hint penalty.
    let score = mission.reward;
    let stars = 1;
    const hintsUsed = run.hintsUsed.length;
    score -= hintsUsed * 20;
    if (mission.timeLimit > 0 && elapsedMs > 0) {
      const speed = Math.max(0, 1 - elapsedMs / (mission.timeLimit * 1000));
      score = Math.round(score * (1 + speed * 0.5));
    }
    if (hintsUsed === 0) stars += 1;
    if (mission.timeLimit > 0 && elapsedMs < mission.timeLimit * 500) stars += 1;
    else if (mission.timeLimit === 0) stars += 1;
    stars = Math.min(3, stars);
    score = Math.max(10, score);

    const firstClear = !progress.completed[mission.id];
    const awarded = firstClear ? score : Math.round(score * 0.25);

    const result: MissionResult = {
      missionId: mission.id,
      stars,
      bestScore: score,
      bestTimeMs: elapsedMs,
      attempts: 1,
      completedAt: Date.now(),
    };

    let nextProgress = recordResult(progress, result, awarded);

    // Achievements
    const before = nextProgress.xp - awarded;
    if (before === 0) nextProgress = unlockAchievement(nextProgress, 'first_blood');
    if (hintsUsed === 0 && mission.difficulty >= 3) nextProgress = unlockAchievement(nextProgress, 'no_hints');
    if (Object.keys(nextProgress.completed).length >= 5) nextProgress = unlockAchievement(nextProgress, 'halfway');
    if (mission.id === 'm10') nextProgress = unlockAchievement(nextProgress, 'graduate');

    const prevLevel = Math.floor(before / 100) + 1;
    const newLevel = Math.floor(nextProgress.xp / 100) + 1;

    set({
      run: { ...run, status: 'won', testResults: results, elapsedMs, score, hintsUsed: run.hintsUsed },
      progress: nextProgress,
    });
    saveProgress(nextProgress);

    const notes: GameNotification[] = [];
    if (firstClear) notes.push({ id: `xp-${mission.id}`, kind: 'info', title: `+${awarded} XP`, detail: `${mission.title} cleared with ${stars}★` });
    else notes.push({ id: `xp-${Date.now()}`, kind: 'info', title: `+${awarded} XP`, detail: 'Repeat clear bonus' });
    if (newLevel > prevLevel) notes.push({ id: `lvl-${newLevel}`, kind: 'levelup', title: `Level ${newLevel}`, detail: `You are now ranked ${rankForXp(nextProgress.xp)}` });
    const newAchievements = nextProgress.achievements.filter((a) => !progress.achievements.includes(a));
    for (const a of newAchievements) notes.push({ id: `ach-${a}`, kind: 'achievement', title: 'Achievement unlocked', detail: a.replace(/_/g, ' ') });
    if (notes.length) set((s) => ({ notifications: [...s.notifications, ...notes] }));

    return { won: true, results };
  },

  addNotification: (n) => set((s) => ({ notifications: [...s.notifications, n] })),
  dismissNotification: (id) => set((s) => ({ notifications: s.notifications.filter((n) => n.id !== id) })),

  reset: () => {
    resetProgress();
    set({ progress: loadProgress(), run: null, draft: null });
  },

  rank: () => rankForXp(get().progress.xp),
  level: () => levelProgress(get().progress.xp),
}));

export { MISSIONS };
