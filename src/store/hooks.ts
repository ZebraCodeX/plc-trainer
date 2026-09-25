import { useSyncExternalStore } from 'react';
import { useStore } from './store';
import type { PlcEngine } from '../engine/engine';
import type { Scalar } from '../engine/types';

export function useEngine(): PlcEngine {
  return useStore((s) => s.engine);
}

/** Re-renders on every scan tick (use paired with direct engine reads). */
export function useScanCount(): number {
  const engine = useStore((s) => s.engine);
  return useSyncExternalStore(engine.subscribe, () => engine.scanCount);
}

export function useRunning(): boolean {
  const engine = useStore((s) => s.engine);
  return useSyncExternalStore(engine.subscribe, () => engine.running);
}

export function useTagValue(ref: string | undefined): Scalar | undefined {
  const engine = useStore((s) => s.engine);
  return useSyncExternalStore(engine.subscribe, () =>
    ref ? engine.db.readScalar(ref) : undefined,
  );
}
