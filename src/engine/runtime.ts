import { evalExpression } from './expr';
import type { TagDatabase } from './tagdb';
import { isCounterValue, isTimerValue, type CounterValue, type TimerValue } from './types';
import type { ConditionBranch, ConditionItem, RungInstruction } from './model';

export interface RunContext {
  db: TagDatabase;
  programId: string;
  /** milliseconds since the previous scan. */
  dt: number;
  scan: number;
  /** Working state for edge detection / one-shots, keyed by instruction id. */
  state: Map<string, number>;
  callRoutine?: (name: string) => void;
}

/* ------------------------------------------------------------------ */
/* Operands                                                            */
/* ------------------------------------------------------------------ */

export function resolveOperand(ctx: RunContext, operand: string): number | boolean | string | undefined {
  const o = (operand ?? '').trim();
  if (o === '') return undefined;
  if (/^'.*'$/.test(o)) return o.slice(1, -1);
  if (/^[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/.test(o)) return Number(o);
  const v = ctx.db.readScalar(o, ctx.programId);
  if (v !== undefined) return v;
  return undefined;
}

export function readNum(ctx: RunContext, operand: string): number {
  const v = resolveOperand(ctx, operand);
  if (typeof v === 'number') return v;
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (typeof v === 'string') {
    const n = Number(v);
    return Number.isNaN(n) ? 0 : n;
  }
  return 0;
}

export function readBool(ctx: RunContext, operand: string): boolean {
  const v = resolveOperand(ctx, operand);
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v !== 0;
  return false;
}

function edge(ctx: RunContext, key: string, current: boolean): boolean {
  const prev = ctx.state.get(key) ?? 0;
  ctx.state.set(key, current ? 1 : 0);
  return current && prev === 0;
}

/* ------------------------------------------------------------------ */
/* Conditions (ladder input instructions)                              */
/* ------------------------------------------------------------------ */

export function evalSeries(ctx: RunContext, branch: ConditionBranch): boolean {
  let power = true;
  for (const item of branch.items) {
    power = power && evalConditionItem(ctx, item, power);
  }
  return power;
}

export function evalConditionItem(ctx: RunContext, item: ConditionItem, incoming: boolean): boolean {
  if (item.type === 'group') {
    const branches = item.branches ?? [];
    return branches.some((b) => evalSeries(ctx, b));
  }
  const op = (item.op ?? '').toUpperCase();
  const a = item.operands?.[0] ?? '';
  const b = item.operands?.[1] ?? '';
  const c = item.operands?.[2] ?? '';
  switch (op) {
    case 'XIC':
      return readBool(ctx, a);
    case 'XIO':
      return !readBool(ctx, a);
    case 'ONS':
      return incoming && edge(ctx, `ons:${item.id}`, true);
    case 'EQU':
      return compare(ctx, a, b) === 0;
    case 'NEQ':
      return compare(ctx, a, b) !== 0;
    case 'GRT':
      return compare(ctx, a, b) > 0;
    case 'GEQ':
      return compare(ctx, a, b) >= 0;
    case 'LES':
      return compare(ctx, a, b) < 0;
    case 'LEQ':
      return compare(ctx, a, b) <= 0;
    case 'LIM': {
      const v = readNum(ctx, b);
      return readNum(ctx, a) <= v && v <= readNum(ctx, c);
    }
    default:
      return false;
  }
}

function compare(ctx: RunContext, a: string, b: string): number {
  const va = resolveOperand(ctx, a);
  const vb = resolveOperand(ctx, b);
  if (typeof va === 'string' || typeof vb === 'string') {
    const sa = String(va ?? '');
    const sb = String(vb ?? '');
    return sa === sb ? 0 : sa > sb ? 1 : -1;
  }
  const na = readNum(ctx, a);
  const nb = readNum(ctx, b);
  return na === nb ? 0 : na > nb ? 1 : -1;
}

/* ------------------------------------------------------------------ */
/* Output instructions                                                 */
/* ------------------------------------------------------------------ */

function timerOf(ctx: RunContext, ref: string): TimerValue | undefined {
  const v = ctx.db.rawValue(ref, ctx.programId);
  if (isTimerValue(v)) return v;
  return undefined;
}

function counterOf(ctx: RunContext, ref: string): CounterValue | undefined {
  const v = ctx.db.rawValue(ref, ctx.programId);
  if (isCounterValue(v)) return v;
  return undefined;
}

function writeBoolTag(ctx: RunContext, ref: string, value: boolean): void {
  if (ref) ctx.db.writeScalar(ref, value, ctx.programId);
}

function writeNumTag(ctx: RunContext, ref: string, value: number): void {
  if (ref) ctx.db.writeScalar(ref, value, ctx.programId);
}

export function executeOutput(ctx: RunContext, inst: RungInstruction, power: boolean): void {
  const op = inst.op.toUpperCase();
  const o = inst.operands;
  switch (op) {
    case 'OTE':
      writeBoolTag(ctx, o[0], power);
      break;
    case 'OTL':
      if (power) writeBoolTag(ctx, o[0], true);
      break;
    case 'OTU':
      if (power) writeBoolTag(ctx, o[0], false);
      break;
    case 'TON': {
      const t = timerOf(ctx, o[0]);
      if (!t) break;
      if (o[1]) t.PRE = Math.round(readNum(ctx, o[1]));
      if (power) {
        t.EN = true;
        if (t.ACC < t.PRE) {
          t.TT = true;
          t.ACC += ctx.dt;
          if (t.ACC >= t.PRE) {
            t.ACC = t.PRE;
            t.TT = false;
            t.DN = true;
          }
        } else {
          t.TT = false;
          t.DN = true;
        }
      } else {
        t.EN = false;
        t.TT = false;
        t.DN = false;
        t.ACC = 0;
      }
      break;
    }
    case 'TOF': {
      const t = timerOf(ctx, o[0]);
      if (!t) break;
      if (o[1]) t.PRE = Math.round(readNum(ctx, o[1]));
      if (power) {
        t.EN = true;
        t.DN = true;
        t.TT = false;
        t.ACC = 0;
      } else {
        t.EN = false;
        if (t.DN && t.ACC < t.PRE) {
          t.TT = true;
          t.ACC += ctx.dt;
          if (t.ACC >= t.PRE) {
            t.ACC = t.PRE;
            t.TT = false;
            t.DN = false;
          }
        } else if (t.ACC >= t.PRE) {
          t.DN = false;
          t.TT = false;
        }
      }
      break;
    }
    case 'RTO': {
      const t = timerOf(ctx, o[0]);
      if (!t) break;
      if (o[1]) t.PRE = Math.round(readNum(ctx, o[1]));
      if (power) {
        t.EN = true;
        if (t.ACC < t.PRE) {
          t.TT = true;
          t.ACC += ctx.dt;
          if (t.ACC >= t.PRE) {
            t.ACC = t.PRE;
            t.TT = false;
            t.DN = true;
          }
        } else {
          t.TT = false;
        }
      } else {
        t.EN = false;
        t.TT = false;
      }
      break;
    }
    case 'RES': {
      const t = timerOf(ctx, o[0]);
      if (t) {
        t.EN = false;
        t.TT = false;
        t.DN = false;
        t.ACC = 0;
        break;
      }
      const c = counterOf(ctx, o[0]);
      if (c) {
        c.CU = false;
        c.CD = false;
        c.OV = false;
        c.UN = false;
        c.DN = false;
        c.ACC = 0;
      }
      break;
    }
    case 'CTU': {
      const c = counterOf(ctx, o[0]);
      if (!c) break;
      if (o[1]) c.PRE = Math.round(readNum(ctx, o[1]));
      c.CU = power;
      if (edge(ctx, `ctu:${inst.id}`, power)) c.ACC += 1;
      c.DN = c.ACC >= c.PRE;
      break;
    }
    case 'CTD': {
      const c = counterOf(ctx, o[0]);
      if (!c) break;
      if (o[1]) c.PRE = Math.round(readNum(ctx, o[1]));
      c.CD = power;
      if (edge(ctx, `ctd:${inst.id}`, power)) c.ACC -= 1;
      c.DN = c.ACC <= 0;
      break;
    }
    case 'MOV':
      if (power) {
        const v = resolveOperand(ctx, o[0]);
        if (typeof v === 'number') writeNumTag(ctx, o[1], v);
        else if (typeof v === 'boolean') writeBoolTag(ctx, o[1], v);
      }
      break;
    case 'CLR':
      if (power) writeNumTag(ctx, o[0], 0);
      break;
    case 'ADD':
      if (power) writeNumTag(ctx, o[2], readNum(ctx, o[0]) + readNum(ctx, o[1]));
      break;
    case 'SUB':
      if (power) writeNumTag(ctx, o[2], readNum(ctx, o[0]) - readNum(ctx, o[1]));
      break;
    case 'MUL':
      if (power) writeNumTag(ctx, o[2], readNum(ctx, o[0]) * readNum(ctx, o[1]));
      break;
    case 'DIV':
      if (power) {
        const d = readNum(ctx, o[1]);
        writeNumTag(ctx, o[2], d === 0 ? 0 : readNum(ctx, o[0]) / d);
      }
      break;
    case 'MOD':
      if (power) {
        const d = readNum(ctx, o[1]);
        writeNumTag(ctx, o[2], d === 0 ? 0 : readNum(ctx, o[0]) % d);
      }
      break;
    case 'SQR':
      if (power) writeNumTag(ctx, o[1], Math.sqrt(readNum(ctx, o[0])));
      break;
    case 'ABS':
      if (power) writeNumTag(ctx, o[1], Math.abs(readNum(ctx, o[0])));
      break;
    case 'NEG':
      if (power) writeNumTag(ctx, o[1], -readNum(ctx, o[0]));
      break;
    case 'AND':
      if (power) writeNumTag(ctx, o[2], readNum(ctx, o[0]) & readNum(ctx, o[1]));
      break;
    case 'OR':
      if (power) writeNumTag(ctx, o[2], readNum(ctx, o[0]) | readNum(ctx, o[1]));
      break;
    case 'XOR':
      if (power) writeNumTag(ctx, o[2], readNum(ctx, o[0]) ^ readNum(ctx, o[1]));
      break;
    case 'NOT':
      if (power) writeNumTag(ctx, o[1], ~readNum(ctx, o[0]));
      break;
    case 'CPT': {
      if (!power) break;
      const src = o[1] ?? '';
      try {
        const value = evalExpression(src, {
          resolve: (name) => readNum(ctx, name),
        });
        writeNumTag(ctx, o[0], value);
      } catch {
        /* leave dest unchanged on bad expression */
      }
      break;
    }
    case 'COP':
    case 'FLL':
      if (power) {
        const dest = o[1];
        const len = Math.max(0, Math.round(readNum(ctx, o[2])));
        const base = dest.replace(/\[\d+\]$/, '');
        const tag = ctx.db.getByName(base, ctx.programId) ?? ctx.db.getByName(base);
        if (!tag) break;
        if (op === 'FLL') {
          const src = readNum(ctx, o[0]);
          for (let i = 0; i < len; i++) ctx.db.writeScalar(`${base}[${i}]`, src, ctx.programId);
        } else {
          for (let i = 0; i < len; i++) {
            const v = ctx.db.readScalar(`${o[0]}[${i}]`, ctx.programId);
            if (v !== undefined) ctx.db.writeScalar(`${base}[${i}]`, v, ctx.programId);
          }
        }
      }
      break;
    case 'JSR':
      if (power && ctx.callRoutine) ctx.callRoutine(o[0]);
      break;
    case 'NOP':
    case 'AFI':
    case 'RET':
    default:
      break;
  }
}
