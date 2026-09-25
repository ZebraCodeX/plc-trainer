/** Visual symbols for ladder / instruction elements. */

export const GLYPHS: Record<string, string> = {
  XIC: '┤ ├',
  XIO: '┤/├',
  ONS: '┤↑├',
  OTE: '—( )—',
  OTL: '—(L)—',
  OTU: '—(U)—',
  TON: '⏱',
  TOF: '⏱',
  RTO: '⏱',
  RES: '↺',
  CTU: '↗#',
  CTD: '↘#',
  EQU: '=',
  NEQ: '≠',
  GRT: '>',
  GEQ: '≥',
  LES: '<',
  LEQ: '≤',
  LIM: '⋚',
  ADD: '+',
  SUB: '−',
  MUL: '×',
  DIV: '÷',
  MOD: '%',
  SQR: '√',
  ABS: '|x|',
  NEG: '∓',
  CPT: 'ƒ',
  MOV: '→',
  CLR: '⌀',
  COP: '⧉',
  FLL: '▦',
  AND: '&',
  OR: '|',
  XOR: '⊕',
  NOT: '¬',
  NOP: '▫',
  AFI: '⛔',
  JSR: '↪',
  RET: '↩',
};

export function glyph(op: string): string {
  return GLYPHS[op.toUpperCase()] ?? op.toUpperCase();
}

export function isContact(op: string): boolean {
  return ['XIC', 'XIO', 'ONS'].includes(op.toUpperCase());
}

export function isCoil(op: string): boolean {
  return ['OTE', 'OTL', 'OTU'].includes(op.toUpperCase());
}
