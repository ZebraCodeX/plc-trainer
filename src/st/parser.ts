import type { Expr, Stmt, StProgram, VarDecl, StDiagnostic } from './ast';
import { tokenize, type Token } from './lexer';

export interface ParseResult {
  program: StProgram;
  diagnostics: StDiagnostic[];
}

class Parser {
  private pos = 0;
  private diagnostics: StDiagnostic[] = [];

  constructor(private tokens: Token[]) {}

  private peek(offset = 0): Token {
    return this.tokens[Math.min(this.pos + offset, this.tokens.length - 1)];
  }
  private next(): Token {
    return this.tokens[this.pos++];
  }
  private isIdent(word: string, offset = 0): boolean {
    const t = this.peek(offset);
    return t.type === 'ident' && t.value.toUpperCase() === word.toUpperCase();
  }
  private isPunct(value: string, offset = 0): boolean {
    const t = this.peek(offset);
    return t.type === 'punct' && t.value === value;
  }
  private isOp(value: string, offset = 0): boolean {
    const t = this.peek(offset);
    return t.type === 'op' && t.value === value;
  }
  private error(msg: string): void {
    const t = this.peek();
    this.diagnostics.push({ line: t.line, column: t.column, message: msg, severity: 'error' });
  }
  private expectPunct(value: string): boolean {
    if (this.isPunct(value)) {
      this.next();
      return true;
    }
    this.error(`Expected '${value}'`);
    return false;
  }
  private expectIdent(word: string): boolean {
    if (this.isIdent(word)) {
      this.next();
      return true;
    }
    this.error(`Expected ${word}`);
    return false;
  }

  parseProgram(): ParseResult {
    const vars: VarDecl[] = [];
    const body: Stmt[] = [];
    while (this.peek().type !== 'eof') {
      if (this.isIdent('VAR') || this.isIdent('VAR_INPUT') || this.isIdent('VAR_OUTPUT')) {
        vars.push(...this.parseVarBlock());
      } else {
        body.push(this.parseStatement());
      }
    }
    return { program: { vars, body }, diagnostics: this.diagnostics };
  }

  private parseVarBlock(): VarDecl[] {
    this.next(); // VAR
    const decls: VarDecl[] = [];
    while (this.peek().type !== 'eof' && !this.isIdent('END_VAR')) {
      if (this.isPunct(';')) {
        this.next();
        continue;
      }
      const nameTok = this.next();
      if (nameTok.type !== 'ident') {
        this.error('Expected variable name');
        break;
      }
      this.expectPunct(':');
      const typeTok = this.next();
      const typeName = typeTok.value.toUpperCase();
      let arraySize: number | undefined;
      if (this.isPunct('[')) {
        this.next();
        const lo = this.next();
        if (this.isPunct('..')) this.next();
        const hi = this.next();
        if (this.isPunct(']')) this.next();
        const a = Number(lo.value);
        const b = Number(hi.value);
        arraySize = Number.isFinite(b) ? (Number.isFinite(a) && b !== a ? b - a + 1 : b + 1) : 1;
      }
      let init: Expr | undefined;
      if (this.isOp(':=')) {
        this.next();
        init = this.parseExpression();
      }
      decls.push({ name: nameTok.value, typeName, arraySize, init });
      if (this.isPunct(';')) this.next();
    }
    this.expectIdent('END_VAR');
    return decls;
  }

  private parseStatement(): Stmt {
    const line = this.peek().line;
    if (this.isPunct(';')) {
      this.next();
      return { kind: 'expr', expr: { kind: 'num', value: 0 }, line };
    }
    if (this.isIdent('IF')) return this.parseIf();
    if (this.isIdent('WHILE')) return this.parseWhile();
    if (this.isIdent('REPEAT')) return this.parseRepeat();
    if (this.isIdent('FOR')) return this.parseFor();
    if (this.isIdent('CASE')) return this.parseCase();
    if (this.isIdent('RETURN')) {
      this.next();
      if (this.isPunct(';')) this.next();
      return { kind: 'return', line };
    }
    if (this.isIdent('EXIT')) {
      this.next();
      if (this.isPunct(';')) this.next();
      return { kind: 'exit', line };
    }
    if (this.isIdent('CONTINUE')) {
      this.next();
      if (this.isPunct(';')) this.next();
      return { kind: 'continue', line };
    }
    const expr = this.parseExpression();
    if (this.isOp(':=')) {
      this.next();
      const value = this.parseExpression();
      if (this.isPunct(';')) this.next();
      return { kind: 'assign', target: expr, value, line };
    }
    if (this.isPunct(';')) this.next();
    return { kind: 'expr', expr, line };
  }

  private parseIf(): Stmt {
    const line = this.peek().line;
    this.next(); // IF
    const branches: { cond: Expr; body: Stmt[] }[] = [];
    const cond = this.parseExpression();
    this.expectIdent('THEN');
    branches.push({ cond, body: this.parseBlock(['ELSIF', 'ELSE', 'END_IF']) });
    while (this.isIdent('ELSIF')) {
      this.next();
      const c = this.parseExpression();
      this.expectIdent('THEN');
      branches.push({ cond: c, body: this.parseBlock(['ELSIF', 'ELSE', 'END_IF']) });
    }
    let elseBody: Stmt[] | undefined;
    if (this.isIdent('ELSE')) {
      this.next();
      elseBody = this.parseBlock(['END_IF']);
    }
    this.expectIdent('END_IF');
    if (this.isPunct(';')) this.next();
    return { kind: 'if', branches, elseBody, line };
  }

  private parseWhile(): Stmt {
    const line = this.peek().line;
    this.next();
    const cond = this.parseExpression();
    this.expectIdent('DO');
    const body = this.parseBlock(['END_WHILE']);
    this.expectIdent('END_WHILE');
    if (this.isPunct(';')) this.next();
    return { kind: 'while', cond, body, line };
  }

  private parseRepeat(): Stmt {
    const line = this.peek().line;
    this.next();
    const body = this.parseBlock(['UNTIL']);
    this.expectIdent('UNTIL');
    const cond = this.parseExpression();
    this.expectIdent('END_REPEAT');
    if (this.isPunct(';')) this.next();
    return { kind: 'repeat', body, cond, line };
  }

  private parseFor(): Stmt {
    const line = this.peek().line;
    this.next();
    const varTok = this.next();
    this.expectOp(':=');
    const from = this.parseExpression();
    this.expectIdent('TO');
    const to = this.parseExpression();
    let step: Expr | undefined;
    if (this.isIdent('BY')) {
      this.next();
      step = this.parseExpression();
    }
    this.expectIdent('DO');
    const body = this.parseBlock(['END_FOR']);
    this.expectIdent('END_FOR');
    if (this.isPunct(';')) this.next();
    return { kind: 'for', varName: varTok.value, from, to, step, body, line };
  }

  private parseCase(): Stmt {
    const line = this.peek().line;
    this.next();
    const expr = this.parseExpression();
    this.expectIdent('OF');
    const cases: { values: Expr[]; body: Stmt[] }[] = [];
    let elseBody: Stmt[] | undefined;
    while (this.peek().type !== 'eof' && !this.isIdent('END_CASE')) {
      if (this.isIdent('ELSE')) {
        this.next();
        elseBody = this.parseBlock(['END_CASE']);
        break;
      }
      const values: Expr[] = [this.parseExpression()];
      while (this.isPunct(',')) {
        this.next();
        values.push(this.parseExpression());
      }
      this.expectPunct(':');
      const body = this.parseBlockCase();
      cases.push({ values, body });
    }
    this.expectIdent('END_CASE');
    if (this.isPunct(';')) this.next();
    return { kind: 'case', expr, cases, elseBody, line };
  }

  private parseBlock(stopWords: string[]): Stmt[] {
    const stmts: Stmt[] = [];
    while (this.peek().type !== 'eof' && !stopWords.some((w) => this.isIdent(w))) {
      stmts.push(this.parseStatement());
    }
    return stmts;
  }

  private parseBlockCase(): Stmt[] {
    const stmts: Stmt[] = [];
    while (
      this.peek().type !== 'eof' &&
      !this.isIdent('ELSE') &&
      !this.isIdent('END_CASE') &&
      !this.looksLikeCaseLabel()
    ) {
      stmts.push(this.parseStatement());
    }
    return stmts;
  }

  private looksLikeCaseLabel(): boolean {
    // A case label is a sequence expression(s) followed by ':' with no ';' first.
    let i = 0;
    let depth = 0;
    for (;;) {
      const t = this.peek(i);
      if (t.type === 'eof') return false;
      if (t.type === 'punct' && t.value === '(') depth++;
      if (t.type === 'punct' && t.value === ')') depth--;
      if (depth === 0 && t.type === 'punct' && t.value === ';') return false;
      if (depth === 0 && t.type === 'punct' && t.value === ':') return true;
      if (depth === 0 && (t.type === 'op' && t.value === ':=')) return false;
      i++;
      if (i > 200) return false;
    }
  }

  /* ----------------------- expressions ----------------------- */

  private parseExpression(): Expr {
    return this.parseOr();
  }
  private parseOr(): Expr {
    let left = this.parseXor();
    while (this.isIdent('OR')) {
      this.next();
      const right = this.parseXor();
      left = { kind: 'bin', op: 'OR', left, right };
    }
    return left;
  }
  private parseXor(): Expr {
    let left = this.parseAnd();
    while (this.isIdent('XOR')) {
      this.next();
      const right = this.parseAnd();
      left = { kind: 'bin', op: 'XOR', left, right };
    }
    return left;
  }
  private parseAnd(): Expr {
    let left = this.parseNot();
    while (this.isIdent('AND')) {
      this.next();
      const right = this.parseNot();
      left = { kind: 'bin', op: 'AND', left, right };
    }
    return left;
  }
  private parseNot(): Expr {
    if (this.isIdent('NOT')) {
      this.next();
      return { kind: 'un', op: 'NOT', operand: this.parseNot() };
    }
    return this.parseComparison();
  }
  private parseComparison(): Expr {
    let left = this.parseAdd();
    while (this.peek().type === 'op' && ['=', '<>', '<', '>', '<=', '>='].includes(this.peek().value)) {
      const op = this.next().value;
      const right = this.parseAdd();
      left = { kind: 'bin', op, left, right };
    }
    return left;
  }
  private parseAdd(): Expr {
    let left = this.parseMul();
    while (this.peek().type === 'op' && ['+', '-'].includes(this.peek().value)) {
      const op = this.next().value;
      const right = this.parseMul();
      left = { kind: 'bin', op, left, right };
    }
    return left;
  }
  private parseMul(): Expr {
    let left = this.parseUnary();
    while (
      (this.peek().type === 'op' && ['*', '/'].includes(this.peek().value)) ||
      this.isIdent('MOD')
    ) {
      const op = this.isIdent('MOD') ? this.next().value.toUpperCase() : this.next().value;
      const right = this.parseUnary();
      left = { kind: 'bin', op, left, right };
    }
    return left;
  }
  private parseUnary(): Expr {
    if (this.isOp('-') || this.isOp('+')) {
      const op = this.next().value;
      return { kind: 'un', op, operand: this.parseUnary() };
    }
    return this.parsePower();
  }
  private parsePower(): Expr {
    const base = this.parsePrimary();
    if (this.isOp('**')) {
      this.next();
      const exp = this.parseUnary();
      return { kind: 'bin', op: '**', left: base, right: exp };
    }
    return base;
  }

  private parsePrimary(): Expr {
    const t = this.peek();
    if (t.type === 'number') {
      this.next();
      return { kind: 'num', value: Number(t.value) };
    }
    if (t.type === 'string') {
      this.next();
      return { kind: 'str', value: t.value };
    }
    if (this.isPunct('(')) {
      this.next();
      const e = this.parseExpression();
      this.expectPunct(')');
      return e;
    }
    if (t.type === 'ident') {
      const upper = t.value.toUpperCase();
      if (upper === 'TRUE' || upper === 'FALSE') {
        this.next();
        return { kind: 'bool', value: upper === 'TRUE' };
      }
      return this.parseRefOrCall();
    }
    this.error(`Unexpected token '${t.value}'`);
    this.next();
    return { kind: 'num', value: 0 };
  }

  private parseRefOrCall(): Expr {
    const nameTok = this.next();
    if (this.isPunct('(')) {
      this.next();
      const args: Expr[] = [];
      if (!this.isPunct(')')) {
        args.push(this.parseExpression());
        while (this.isPunct(',')) {
          this.next();
          args.push(this.parseExpression());
        }
      }
      this.expectPunct(')');
      return { kind: 'call', name: nameTok.value, args };
    }
    let name = nameTok.value;
    for (;;) {
      if (this.isPunct('.')) {
        this.next();
        const member = this.next();
        name += `.${member.value}`;
      } else if (this.isPunct('[')) {
        this.next();
        const idx = this.parseExpression();
        this.expectPunct(']');
        if (idx.kind === 'num') {
          name += `[${idx.value}]`;
        } else {
          return { kind: 'index', name, index: idx };
        }
      } else {
        break;
      }
    }
    return { kind: 'ref', name };
  }

  private expectOp(value: string): boolean {
    if (this.isOp(value)) {
      this.next();
      return true;
    }
    this.error(`Expected '${value}'`);
    return false;
  }
}

export function parseSt(source: string): ParseResult {
  const raw = tokenize(source).filter((t) => t.type !== 'newline');
  const parser = new Parser(raw);
  return parser.parseProgram();
}
