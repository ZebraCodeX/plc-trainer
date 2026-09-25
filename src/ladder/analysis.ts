import { evalConditionItem, type RunContext } from '../engine/runtime';
import type { Rung } from '../engine/model';

export interface ItemState {
  in: boolean;
  out: boolean;
}

export interface RungAnalysis {
  items: Map<string, ItemState>;
  activeBranches: Set<string>;
  power: boolean;
}

function analyzeBranch(
  ctx: RunContext,
  branch: { id: string; items: Rung['condition']['items'] },
  incoming: boolean,
  analysis: RungAnalysis,
): boolean {
  let power = incoming;
  for (const item of branch.items) {
    if (item.type === 'instruction') {
      const inP = power;
      const r = evalConditionItem(ctx, item, power);
      power = power && r;
      analysis.items.set(item.id, { in: inP, out: power });
    } else {
      const inP = power;
      let any = false;
      for (const b of item.branches ?? []) {
        if (analyzeBranch(ctx, b, inP, analysis)) {
          any = true;
          analysis.activeBranches.add(b.id);
        }
      }
      power = power && any;
      analysis.items.set(item.id, { in: inP, out: power });
    }
  }
  return power;
}

export function analyzeRung(ctx: RunContext, rung: Rung): RungAnalysis {
  const analysis: RungAnalysis = { items: new Map(), activeBranches: new Set(), power: false };
  analysis.power = analyzeBranch(ctx, rung.condition, true, analysis);
  return analysis;
}
