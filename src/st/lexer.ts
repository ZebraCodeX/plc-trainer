export type TokenType =
  | 'ident'
  | 'number'
  | 'string'
  | 'op'
  | 'punct'
  | 'newline'
  | 'eof';

export interface Token {
  type: TokenType;
  value: string;
  line: number;
  column: number;
}

const KEYWORDS = new Set([
  'IF', 'THEN', 'ELSIF', 'ELSE', 'END_IF',
  'CASE', 'OF', 'END_CASE',
  'FOR', 'TO', 'BY', 'DO', 'END_FOR',
  'WHILE', 'END_WHILE',
  'REPEAT', 'UNTIL', 'END_REPEAT',
  'VAR', 'VAR_INPUT', 'VAR_OUTPUT', 'END_VAR',
  'TRUE', 'FALSE',
  'AND', 'OR', 'NOT', 'XOR', 'MOD',
  'RETURN', 'EXIT', 'CONTINUE',
  'BOOL', 'SINT', 'INT', 'DINT', 'REAL', 'LREAL', 'TIMER', 'COUNTER',
]);

export function isKeyword(word: string): boolean {
  return KEYWORDS.has(word.toUpperCase());
}

const MULTI_OPS = ['<=', '>=', '<>', ':=', '**'];

export function tokenize(src: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  let line = 1;
  let col = 1;
  const n = src.length;

  const push = (type: TokenType, value: string, l = line, c = col) => {
    tokens.push({ type, value, line: l, column: c });
  };

  while (i < n) {
    const c = src[i];
    if (c === '\n') {
      push('newline', '\n');
      i++;
      line++;
      col = 1;
      continue;
    }
    if (c === ' ' || c === '\t' || c === '\r') {
      i++;
      col++;
      continue;
    }
    if (c === '/' && src[i + 1] === '/') {
      while (i < n && src[i] !== '\n') i++;
      continue;
    }
    if (c === '(' && src[i + 1] === '*') {
      i += 2;
      while (i < n && !(src[i] === '*' && src[i + 1] === ')')) {
        if (src[i] === '\n') {
          line++;
          col = 1;
        }
        i++;
      }
      i += 2;
      continue;
    }
    if (c === "'") {
      let j = i + 1;
      let str = '';
      while (j < n && src[j] !== "'") {
        if (src[j] === '\n') {
          line++;
          col = 1;
        }
        str += src[j];
        j++;
      }
      push('string', str, line, col);
      i = j + 1;
      col += j - i + 2;
      continue;
    }
    if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(src[i + 1] ?? ''))) {
      let j = i;
      while (j < n && /[0-9.eE]/.test(src[j])) {
        if ((src[j] === 'e' || src[j] === 'E') && /[+-]/.test(src[j + 1] ?? '')) j++;
        j++;
      }
      push('number', src.slice(i, j), line, col);
      col += j - i;
      i = j;
      continue;
    }
    if (/[A-Za-z_]/.test(c)) {
      let j = i;
      while (j < n && /[A-Za-z0-9_]/.test(src[j])) j++;
      push('ident', src.slice(i, j), line, col);
      col += j - i;
      i = j;
      continue;
    }
    const two = src.slice(i, i + 2);
    if (MULTI_OPS.includes(two)) {
      push('op', two);
      i += 2;
      col += 2;
      continue;
    }
    if ('+-*/=<>'.includes(c)) {
      push('op', c);
      i++;
      col++;
      continue;
    }
    if (';,.:[]()'.includes(c)) {
      push('punct', c);
      i++;
      col++;
      continue;
    }
    push('op', c);
    i++;
    col++;
  }
  push('eof', '');
  return tokens;
}
