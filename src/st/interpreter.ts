import { STD_FUNCTIONS } from '../engine/expr';
import { isCounterValue, isTimerValue, type Scalar } from '../engine/types';
import type { RunContext } from '../engine/runtime';
import type { Expr, StProgram, Stmt } from './ast';

type Flow = 'normal' | 'exit' | 'continue' | 'return';
type Value = number | boolean | string;

const MAX_ITER = 200000;

function refName(ctx: RunContext, e: Expr): string | undefined {
  if (e.kind === 'ref') return e.name;
  if (e.kind === 'str') return e.value;
  if (e.kind === 'index') {
    const idx = Math.round(num(evalExpr(ctx, e.index)));
    return `${e.name}[${idx}]`;
  }
  return undefined;
}

export function evalExpr(ctx: RunContext, e: Expr): Value {
  switch (e.kind) {
    case 'num':
      return e.value;
    case 'bool':
      return e.value;
    case 'str':
      return e.value;
    case 'ref': {
      const v = ctx.db.readScalar(e.name, ctx.programId);
      if (v === undefined) return 0;
      return v;
    }
    case 'index': {
      const idx = Math.round(num(evalExpr(ctx, e.index)));
      const v = ctx.db.readScalar(`${e.name}[${idx}]`, ctx.programId);
      if (v === undefined) return 0;
      return v;
    }
    case 'un': {
      if (e.op === 'NOT') return !truthy(evalExpr(ctx, e.operand));
      const v = num(evalExpr(ctx, e.operand));
      return e.op === '-' ? -v : v;
    }
    case 'bin': {
      const op = e.op.toUpperCase();
      if (['AND', 'OR', 'XOR'].includes(op)) {
        const a = truthy(evalExpr(ctx, e.left));
        const b = truthy(evalExpr(ctx, e.right));
        if (op === 'AND') return a && b;
        if (op === 'OR') return a || b;
        return a !== b;
      }
      if (op === '**') return Math.pow(num(evalExpr(ctx, e.left)), num(evalExpr(ctx, e.right)));
      const L = evalExpr(ctx, e.left);
      const R = evalExpr(ctx, e.right);
      if (op === '+' || op === '-' || op === '*' || op === '/' || op === 'MOD') {
        const a = num(L);
        const b = num(R);
        switch (op) {
          case '+': return a + b;
          case '-': return a - b;
          case '*': return a * b;
          case '/': return b === 0 ? 0 : a / b;
          default: return b === 0 ? 0 : a % b;
        }
      }
      const cmp = compareValues(L, R);
      switch (op) {
        case '=': return cmp === 0;
        case '<>': return cmp !== 0;
        case '<': return cmp < 0;
        case '>': return cmp > 0;
        case '<=': return cmp <= 0;
        case '>=': return cmp >= 0;
        default: return false;
      }
    }
    case 'call': {
      const fname = e.name.toUpperCase();
      const fn = STD_FUNCTIONS[fname];
      if (fn) return fn(...e.args.map((a) => num(evalExpr(ctx, a))));
      return 0;
    }
  }
}

function truthy(v: Value): boolean {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v !== 0;
  return v.length > 0;
}
function num(v: Value): number {
  if (typeof v === 'number') return v;
  if (typeof v === 'boolean') return v ? 1 : 0;
  const n = Number(v);
  return Number.isNaN(n) ? 0 : n;
}
function compareValues(a: Value, b: Value): number {
  if (typeof a === 'string' || typeof b === 'string') {
    const sa = String(a);
    const sb = String(b);
    return sa === sb ? 0 : sa > sb ? 1 : -1;
  }
  const na = num(a);
  const nb = num(b);
  return na === nb ? 0 : na > nb ? 1 : -1;
}

/* ----------------------- instruction calls ----------------------- */

function execInstructionCall(ctx: RunContext, name: string, args: Expr[]): void {
  const upper = name.toUpperCase();
  const a0 = args[0];
  const destName = a0 ? refName(ctx, a0) : undefined;

  switch (upper) {
    case 'TON':
    case 'TOF':
    case 'RTO': {
      if (!destName) return;
      const t = ctx.db.rawValue(destName, ctx.programId);
      if (!isTimerValue(t)) return;
      const enable = args.length >= 3 ? truthy(evalExpr(ctx, args[1])) : true;
      const preset = num(evalExpr(ctx, args[args.length - 1]));
      t.PRE = Math.round(preset);
      if (upper === 'TON') {
        if (enable) {
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
      } else if (upper === 'TOF') {
        if (enable) {
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
          }
        }
      } else {
        if (enable) {
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
      }
      return;
    }
    case 'CTU':
    case 'CTD': {
      if (!destName) return;
      const c = ctx.db.rawValue(destName, ctx.programId);
      if (!isCounterValue(c)) return;
      const enable = args.length >= 3 ? truthy(evalExpr(ctx, args[1])) : true;
      const preset = num(evalExpr(ctx, args[args.length - 1]));
      c.PRE = Math.round(preset);
      const key = `st:${upper}:${destName}`;
      const prev = ctx.state.get(key) ?? 0;
      const rising = enable && prev === 0;
      ctx.state.set(key, enable ? 1 : 0);
      if (upper === 'CTU') {
        c.CU = enable;
        if (rising) c.ACC += 1;
        c.DN = c.ACC >= c.PRE;
      } else {
        c.CD = enable;
        if (rising) c.ACC -= 1;
        c.DN = c.ACC <= 0;
      }
      return;
    }
    case 'RES': {
      if (!destName) return;
      const v = ctx.db.rawValue(destName, ctx.programId);
      if (isTimerValue(v)) {
        v.EN = false;
        v.TT = false;
        v.DN = false;
        v.ACC = 0;
      } else if (isCounterValue(v)) {
        v.CU = false;
        v.CD = false;
        v.DN = false;
        v.ACC = 0;
      }
      return;
    }
    case 'MOV': {
      const dn = args[1] ? refName(ctx, args[1]) : undefined;
      if (!dn) return;
      const v = evalExpr(ctx, args[0]);
      writeValue(ctx, dn, v);
      return;
    }
    case 'CLR': {
      if (destName) ctx.db.writeScalar(destName, 0, ctx.programId);
      return;
    }
    case 'ADD':
    case 'SUB':
    case 'MUL':
    case 'DIV':
    case 'MOD':
    case 'AND':
    case 'OR':
    case 'XOR': {
      const dn = args[2] ? refName(ctx, args[2]) : undefined;
      if (!dn) return;
      const x = num(evalExpr(ctx, args[0]));
      const y = num(evalExpr(ctx, args[1]));
      let r = 0;
      if (upper === 'ADD') r = x + y;
      else if (upper === 'SUB') r = x - y;
      else if (upper === 'MUL') r = x * y;
      else if (upper === 'DIV') r = y === 0 ? 0 : x / y;
      else if (upper === 'MOD') r = y === 0 ? 0 : x % y;
      else if (upper === 'AND') r = x & y;
      else if (upper === 'OR') r = x | y;
      else r = x ^ y;
      ctx.db.writeScalar(dn, r, ctx.programId);
      return;
    }
    case 'SQR':
    case 'ABS':
    case 'NEG':
    case 'NOT': {
      const dn = args[1] ? refName(ctx, args[1]) : undefined;
      if (!dn) return;
      const x = num(evalExpr(ctx, args[0]));
      let r = 0;
      if (upper === 'SQR') r = Math.sqrt(x);
      else if (upper === 'ABS') r = Math.abs(x);
      else if (upper === 'NEG') r = -x;
      else r = ~x;
      ctx.db.writeScalar(dn, r, ctx.programId);
      return;
    }
    case 'JSR': {
      const rn = a0 ? refName(ctx, a0) : undefined;
      if (rn && ctx.callRoutine) ctx.callRoutine(rn);
      return;
    }
    case 'CPT': {
      const dn = args[0] ? refName(ctx, args[0]) : undefined;
      if (!dn) return;
      const v = evalExpr(ctx, args[1]);
      ctx.db.writeScalar(dn, num(v), ctx.programId);
      return;
    }
    default:
      return;
  }
}

function writeValue(ctx: RunContext, ref: string, v: Value): void {
  if (typeof v === 'boolean') ctx.db.writeScalar(ref, v, ctx.programId);
  else if (typeof v === 'number') ctx.db.writeScalar(ref, v, ctx.programId);
  else {
    const n = Number(v);
    if (!Number.isNaN(n)) ctx.db.writeScalar(ref, n, ctx.programId);
  }
}

/* ----------------------- statements ----------------------- */

function execBlock(ctx: RunContext, stmts: Stmt[]): Flow {
  for (const s of stmts) {
    const flow = execStmt(ctx, s);
    if (flow !== 'normal') return flow;
  }
  return 'normal';
}

function execStmt(ctx: RunContext, s: Stmt): Flow {
  switch (s.kind) {
    case 'assign': {
      const ref = refName(ctx, s.target);
      if (!ref) return 'normal';
      const v = evalExpr(ctx, s.value);
      writeValue(ctx, ref, v);
      return 'normal';
    }
    case 'expr': {
      const e = s.expr;
      if (e.kind === 'call') execInstructionCall(ctx, e.name, e.args);
      else evalExpr(ctx, e);
      return 'normal';
    }
    case 'if': {
      for (const b of s.branches) {
        if (truthy(evalExpr(ctx, b.cond))) return execBlock(ctx, b.body);
      }
      if (s.elseBody) return execBlock(ctx, s.elseBody);
      return 'normal';
    }
    case 'while': {
      let guard = 0;
      while (truthy(evalExpr(ctx, s.cond))) {
        const flow = execBlock(ctx, s.body);
        if (flow === 'return') return 'return';
        if (flow === 'exit') break;
        if (++guard > MAX_ITER) break;
      }
      return 'normal';
    }
    case 'repeat': {
      let guard = 0;
      do {
        const flow = execBlock(ctx, s.body);
        if (flow === 'return') return 'return';
        if (flow === 'exit') break;
        if (++guard > MAX_ITER) break;
      } while (!truthy(evalExpr(ctx, s.cond)));
      return 'normal';
    }
    case 'for': {
      const from = num(evalExpr(ctx, s.from));
      const to = num(evalExpr(ctx, s.to));
      const step = s.step ? num(evalExpr(ctx, s.step)) : 1;
      const dir = step >= 0 ? 1 : -1;
      let guard = 0;
      ctx.db.ensureScalar(s.varName, ctx.programId);
      for (let i = from; dir > 0 ? i <= to : i >= to; i += step) {
        ctx.db.writeScalar(s.varName, i, ctx.programId);
        const flow = execBlock(ctx, s.body);
        if (flow === 'return') return 'return';
        if (flow === 'exit') break;
        if (++guard > MAX_ITER) break;
      }
      return 'normal';
    }
    case 'case': {
      const v = evalExpr(ctx, s.expr);
      for (const c of s.cases) {
        for (const cv of c.values) {
          if (compareValues(v, evalExpr(ctx, cv)) === 0) {
            return execBlock(ctx, c.body);
          }
        }
      }
      if (s.elseBody) return execBlock(ctx, s.elseBody);
      return 'normal';
    }
    case 'return':
      return 'return';
    case 'exit':
      return 'exit';
    case 'continue':
      return 'continue';
  }
}

export function executeSt(ctx: RunContext, program: StProgram): void {
  execBlock(ctx, program.body);
}

export function makeEmptyStProgram(): StProgram {
  return { vars: [], body: [] };
}

export type { Scalar };
