import type { Mission } from './types';
import type { Rung } from '../engine/model';

/**
 * A ladder mission ships a starter set of rungs. Players edit these in the
 * embedded ladder editor. `starterRungs` is built lazily by the runner.
 */
export interface LadderMission extends Mission {
  kind: 'ladder';
  buildStarter: () => Rung[];
}

export interface StMission extends Mission {
  kind: 'st';
}

export type AnyMission = LadderMission | StMission;

export function isLadderMission(m: AnyMission): m is LadderMission {
  return m.kind === 'ladder';
}
