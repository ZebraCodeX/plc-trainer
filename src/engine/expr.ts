/** Tiny arithmetic expression evaluator used by the CPT instruction and ST. */

export interface FunctionTable {
  [name: string]: (...args: number[]) => number;
}

export const STD_FUNCTIONS: FunctionTable = {
  ABS: Math.abs,
  SQRT: Math.sqrt,
  SIN: Math.sin,
  COS: Math.cos,
  TAN: Math.tan,
  ASIN: Math.asin,
  ACOS: Math.acos,
  ATAN: Math.atan,
  LN: Math.log,
  LOG: Math.log10,
  EXP: Math.exp,
  ROUND: Math.round,
  FLOOR: Math.floor,
  CEIL: Math.ceil,
  TRUNC: Math.trunc,
  MIN: Math.min,
  MAX: Math.max,
  PI: () => Math.PI,
};

type TokenType = 'num' | 'id' | 'op' | 'lparen' | 'rparen' | 'comma' | 'end';

interface Token {
  type: TokenType;
  value: string;
}

function tokenize(src: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) {
      i++;
      continue;
    }
    if (/[0-9.]/.test(c)) {
      let j = i;
      while (j < src.length && /[0-9._eE]/.test(src[j])) {
        if ((src[j] === 'e' || src[j] === 'E') && /[+-]/.test(src[j + 1] ?? '')) j++;
        j++;
      }
      tokens.push({ type: 'num', value: src.slice(i, j) });
      i = j;
      continue;
    }
    if (/[A-Za-z_]/.test(c)) {
      let j = i;
      while (j < src.length && /[A-Za-z0-9_]/.test(src[j])) j++;
      tokens.push({ type: 'id', value: src.slice(i, j) });
      i = j;
      continue;
    }
    if (c === '(') {
      tokens.push({ type: 'lparen', value: c });
      i++;
      continue;
    }
    if (c === ')') {
      tokens.push({ type: 'rparen', value: c });
      i++;
      continue;
    }
    if (c === ',') {
      tokens.push({ type: 'comma', value: c });
      i++;
      continue;
    }
    if ('+-*/%'.includes(c)) {
      tokens.push({ type: 'op', value: c });
      i++;
      continue;
    }
    throw new Error(`Unexpected character '${c}' in expression`);
  }
  tokens.push({ type: 'end', value: '' });
  return tokens;
}

export interface EvalOptions {
  resolve: (name: string) => number;
  functions?: FunctionTable;
}

class Parser {
  private pos = 0;
  constructor(
    private tokens: Token[],
    private opts: EvalOptions,
  ) {}

  private peek(): Token {
    return this.tokens[this.pos];
  }
  private next(): Token {
    return this.tokens[this.pos++];
  }
  private expect(type: TokenType): Token {
    const t = this.next();
    if (t.type !== type) throw new Error(`Expected ${type} but got '${t.value}'`);
    return t;
  }

  parse(): number {
    const v = this.expr();
    if (this.peek().type !== 'end') throw new Error('Trailing tokens in expression');
    return v;
  }

  private expr(): number {
    let v = this.term();
    while (this.peek().type === 'op' && '+-'.includes(this.peek().value)) {
      const op = this.next().value;
      const rhs = this.term();
      v = op === '+' ? v + rhs : v - rhs;
    }
    return v;
  }

  private term(): number {
    let v = this.unary();
    while (this.peek().type === 'op' && '*/%'.includes(this.peek().value)) {
      const op = this.next().value;
      const rhs = this.unary();
      if (op === '*') v *= rhs;
      else if (op === '/') v /= rhs;
      else v %= rhs;
    }
    return v;
  }

  private unary(): number {
    if (this.peek().type === 'op' && '+-'.includes(this.peek().value)) {
      const op = this.next().value;
      const v = this.unary();
      return op === '-' ? -v : v;
    }
    return this.primary();
  }

  private primary(): number {
    const t = this.next();
    if (t.type === 'num') return Number(t.value);
    if (t.type === 'lparen') {
      const v = this.expr();
      this.expect('rparen');
      return v;
    }
    if (t.type === 'id') {
      if (this.peek().type === 'lparen') {
        this.next();
        const args: number[] = [];
        if (this.peek().type !== 'rparen') {
          args.push(this.expr());
          while (this.peek().type === 'comma') {
            this.next();
            args.push(this.expr());
          }
        }
        this.expect('rparen');
        const fn = (this.opts.functions ?? STD_FUNCTIONS)[t.value.toUpperCase()];
        if (!fn) return this.opts.resolve(t.value);
        return fn(...args);
      }
      return this.opts.resolve(t.value);
    }
    throw new Error(`Unexpected token '${t.value}'`);
  }
}

export function evalExpression(src: string, opts: EvalOptions): number {
  const parser = new Parser(tokenize(src), opts);
  return parser.parse();
}
