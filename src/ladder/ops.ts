import type { ConditionBranch, ConditionItem, Rung, RungInstruction } from '../engine/model';
import { uid } from '../engine/uid';
import { getInstruction } from '../engine/instructions';

export function makeConditionItem(op: string): ConditionItem {
  const def = getInstruction(op);
  const operands = def ? def.operands.map(() => '') : [];
  return { id: uid('ci'), type: 'instruction', op, operands };
}

export function makeOutputInstruction(op: string): RungInstruction {
  const def = getInstruction(op);
  const operands = def ? def.operands.map(() => '') : [];
  return { id: uid('in'), op, operands };
}

export function makeEmptyBranch(): ConditionBranch {
  return { id: uid('br'), items: [makeConditionItem('XIC')] };
}

export function findItem(branch: ConditionBranch, id: string): ConditionItem | null {
  for (const item of branch.items) {
    if (item.id === id) return item;
    if (item.type === 'group') {
      for (const b of item.branches ?? []) {
        const found = findItem(b, id);
        if (found) return found;
      }
    }
  }
  return null;
}

export function findBranchOf(branch: ConditionBranch, id: string): ConditionBranch | null {
  for (const item of branch.items) {
    if (item.id === id) return branch;
    if (item.type === 'group') {
      for (const b of item.branches ?? []) {
        const found = findBranchOf(b, id);
        if (found) return found;
      }
    }
  }
  return null;
}

export function findGroup(branch: ConditionBranch, id: string): ConditionItem | null {
  for (const item of branch.items) {
    if (item.id === id && item.type === 'group') return item;
    if (item.type === 'group') {
      for (const b of item.branches ?? []) {
        const found = findGroup(b, id);
        if (found) return found;
      }
    }
  }
  return null;
}

export function removeConditionItem(branch: ConditionBranch, id: string): boolean {
  const idx = branch.items.findIndex((i) => i.id === id);
  if (idx >= 0) {
    branch.items.splice(idx, 1);
    return true;
  }
  for (const item of branch.items) {
    if (item.type === 'group') {
      for (const b of item.branches ?? []) {
        if (removeConditionItem(b, id)) return true;
      }
    }
  }
  return false;
}

/** Add a new parallel branch to the group, optionally nested in a series item. */
export function addBranchToGroup(branch: ConditionBranch, groupId: string): boolean {
  const group = findGroup(branch, groupId);
  if (!group) return false;
  group.branches = group.branches ?? [];
  group.branches.push(makeEmptyBranch());
  return true;
}

export function updateOutput(rung: Rung, id: string, op: string): void {
  const out = rung.outputs.find((o) => o.id === id);
  if (!out) return;
  const def = getInstruction(op);
  out.op = op;
  out.operands = def ? def.operands.map((_, i) => out.operands[i] ?? '') : [];
}
