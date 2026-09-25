/* Structured Text AST (Allen-Bradley / IEC 61131-3 style). */

export interface VarDecl {
  name: string;
  typeName: string;
  arraySize?: number;
  init?: Expr;
}

export type Expr =
  | { kind: 'num'; value: number }
  | { kind: 'bool'; value: boolean }
  | { kind: 'str'; value: string }
  | { kind: 'ref'; name: string }
  | { kind: 'index'; name: string; index: Expr }
  | { kind: 'bin'; op: string; left: Expr; right: Expr }
  | { kind: 'un'; op: string; operand: Expr }
  | { kind: 'call'; name: string; args: Expr[] };

export type Stmt =
  | { kind: 'assign'; target: Expr; value: Expr; line: number }
  | { kind: 'if'; branches: { cond: Expr; body: Stmt[] }[]; elseBody?: Stmt[]; line: number }
  | { kind: 'while'; cond: Expr; body: Stmt[]; line: number }
  | { kind: 'repeat'; body: Stmt[]; cond: Expr; line: number }
  | { kind: 'for'; varName: string; from: Expr; to: Expr; step?: Expr; body: Stmt[]; line: number }
  | { kind: 'case'; expr: Expr; cases: { values: Expr[]; body: Stmt[] }[]; elseBody?: Stmt[]; line: number }
  | { kind: 'expr'; expr: Expr; line: number }
  | { kind: 'exit'; line: number }
  | { kind: 'continue'; line: number }
  | { kind: 'return'; line: number };

export interface StProgram {
  vars: VarDecl[];
  body: Stmt[];
}

export interface StDiagnostic {
  line: number;
  column: number;
  message: string;
  severity: 'error' | 'warning';
}
