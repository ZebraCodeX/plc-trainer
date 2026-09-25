import type { InstructionCategory } from '../engine/instructions';

/**
 * Colour language for the logic. Each instruction category has a hue so the
 * eye can group instructions at a glance, like a colour-coded schematic.
 */
export const CATEGORY_COLORS: Record<InstructionCategory, string> = {
  bit: '#4aa3ff', // blue — contacts & coils
  timer: '#ffb020', // amber — time
  counter: '#b07cff', // violet — count
  compare: '#22c2b8', // teal — decisions
  math: '#ff7a59', // coral — arithmetic
  move: '#8ecb3a', // green — data movement
  logical: '#e05fbf', // magenta — bitwise
  program: '#8b9db3', // slate — control
};

export const CATEGORY_TEXT: Record<InstructionCategory, string> = {
  bit: 'Bit',
  timer: 'Timer',
  counter: 'Counter',
  compare: 'Compare',
  math: 'Math',
  move: 'Move',
  logical: 'Logic',
  program: 'Program',
};

const MAP: Record<string, string> = {
  XIC: CATEGORY_COLORS.bit,
  XIO: CATEGORY_COLORS.bit,
  ONS: CATEGORY_COLORS.bit,
  OTE: CATEGORY_COLORS.bit,
  OTL: CATEGORY_COLORS.bit,
  OTU: CATEGORY_COLORS.bit,
  TON: CATEGORY_COLORS.timer,
  TOF: CATEGORY_COLORS.timer,
  RTO: CATEGORY_COLORS.timer,
  RES: CATEGORY_COLORS.timer,
  CTU: CATEGORY_COLORS.counter,
  CTD: CATEGORY_COLORS.counter,
  EQU: CATEGORY_COLORS.compare,
  NEQ: CATEGORY_COLORS.compare,
  GRT: CATEGORY_COLORS.compare,
  GEQ: CATEGORY_COLORS.compare,
  LES: CATEGORY_COLORS.compare,
  LEQ: CATEGORY_COLORS.compare,
  LIM: CATEGORY_COLORS.compare,
  ADD: CATEGORY_COLORS.math,
  SUB: CATEGORY_COLORS.math,
  MUL: CATEGORY_COLORS.math,
  DIV: CATEGORY_COLORS.math,
  MOD: CATEGORY_COLORS.math,
  SQR: CATEGORY_COLORS.math,
  ABS: CATEGORY_COLORS.math,
  NEG: CATEGORY_COLORS.math,
  CPT: CATEGORY_COLORS.math,
  MOV: CATEGORY_COLORS.move,
  CLR: CATEGORY_COLORS.move,
  COP: CATEGORY_COLORS.move,
  FLL: CATEGORY_COLORS.move,
  AND: CATEGORY_COLORS.logical,
  OR: CATEGORY_COLORS.logical,
  XOR: CATEGORY_COLORS.logical,
  NOT: CATEGORY_COLORS.logical,
  NOP: CATEGORY_COLORS.program,
  AFI: CATEGORY_COLORS.program,
  JSR: CATEGORY_COLORS.program,
  RET: CATEGORY_COLORS.program,
};

export function instructionColor(op: string): string {
  return MAP[op.toUpperCase()] ?? '#4aa3ff';
}

export function categoryLabel(op: string): string {
  const upper = op.toUpperCase();
  if (['XIC', 'XIO', 'ONS', 'OTE', 'OTL', 'OTU'].includes(upper)) return 'Bit';
  if (['TON', 'TOF', 'RTO', 'RES'].includes(upper)) return 'Timer';
  if (['CTU', 'CTD'].includes(upper)) return 'Counter';
  if (['EQU', 'NEQ', 'GRT', 'GEQ', 'LES', 'LEQ', 'LIM'].includes(upper)) return 'Compare';
  if (['ADD', 'SUB', 'MUL', 'DIV', 'MOD', 'SQR', 'ABS', 'NEG', 'CPT'].includes(upper)) return 'Math';
  if (['MOV', 'CLR', 'COP', 'FLL'].includes(upper)) return 'Move';
  if (['AND', 'OR', 'XOR', 'NOT'].includes(upper)) return 'Logic';
  return 'Program';
}
