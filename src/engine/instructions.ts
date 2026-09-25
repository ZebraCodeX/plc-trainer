/** Instruction catalog (Allen-Bradley / Logix style). */

export type InstructionCategory =
  | 'bit'
  | 'timer'
  | 'counter'
  | 'compare'
  | 'math'
  | 'move'
  | 'logical'
  | 'program';

export type OperandRole = 'bool' | 'numeric' | 'timer' | 'counter' | 'any' | 'literal' | 'text';

export interface OperandDef {
  name: string;
  role: OperandRole;
  optional?: boolean;
}

export type LadderKind = 'input' | 'output';

export interface InstructionDef {
  mnemonic: string;
  name: string;
  category: InstructionCategory;
  kind: LadderKind;
  operands: OperandDef[];
  help: string;
}

const P = (name: string, role: OperandRole = 'any', optional = false): OperandDef => ({
  name,
  role,
  optional,
});

export const INSTRUCTIONS: InstructionDef[] = [
  // Bit (input)
  { mnemonic: 'XIC', name: 'Examine If Closed', category: 'bit', kind: 'input', operands: [P('Bit', 'bool')], help: 'Passes power when the bit is true.' },
  { mnemonic: 'XIO', name: 'Examine If Open', category: 'bit', kind: 'input', operands: [P('Bit', 'bool')], help: 'Passes power when the bit is false.' },
  { mnemonic: 'ONS', name: 'One Shot', category: 'bit', kind: 'input', operands: [P('Storage', 'bool')], help: 'Passes power for a single scan on a rising edge.' },
  // Bit (output)
  { mnemonic: 'OTE', name: 'Output Energize', category: 'bit', kind: 'output', operands: [P('Bit', 'bool')], help: 'Sets the bit while the rung is true.' },
  { mnemonic: 'OTL', name: 'Output Latch', category: 'bit', kind: 'output', operands: [P('Bit', 'bool')], help: 'Latches the bit on while the rung is true.' },
  { mnemonic: 'OTU', name: 'Output Unlatch', category: 'bit', kind: 'output', operands: [P('Bit', 'bool')], help: 'Unlatches the bit while the rung is true.' },
  // Timers
  { mnemonic: 'TON', name: 'Timer On Delay', category: 'timer', kind: 'output', operands: [P('Timer', 'timer'), P('Preset', 'numeric', true)], help: 'Accumulates while enabled; .DN when ACC >= PRE.' },
  { mnemonic: 'TOF', name: 'Timer Off Delay', category: 'timer', kind: 'output', operands: [P('Timer', 'timer'), P('Preset', 'numeric', true)], help: 'Starts timing when the rung goes false.' },
  { mnemonic: 'RTO', name: 'Retentive Timer', category: 'timer', kind: 'output', operands: [P('Timer', 'timer'), P('Preset', 'numeric', true)], help: 'Retains ACC when the rung goes false. Reset with RES.' },
  { mnemonic: 'RES', name: 'Reset', category: 'timer', kind: 'output', operands: [P('Target', 'any')], help: 'Resets a timer or counter.' },
  // Counters
  { mnemonic: 'CTU', name: 'Count Up', category: 'counter', kind: 'output', operands: [P('Counter', 'counter'), P('Preset', 'numeric', true)], help: 'Increments ACC on rung rising edges.' },
  { mnemonic: 'CTD', name: 'Count Down', category: 'counter', kind: 'output', operands: [P('Counter', 'counter'), P('Preset', 'numeric', true)], help: 'Decrements ACC on rung rising edges.' },
  // Compare
  { mnemonic: 'EQU', name: 'Equal', category: 'compare', kind: 'input', operands: [P('Source A'), P('Source B')], help: 'True when A = B.' },
  { mnemonic: 'NEQ', name: 'Not Equal', category: 'compare', kind: 'input', operands: [P('Source A'), P('Source B')], help: 'True when A <> B.' },
  { mnemonic: 'GRT', name: 'Greater Than', category: 'compare', kind: 'input', operands: [P('Source A'), P('Source B')], help: 'True when A > B.' },
  { mnemonic: 'GEQ', name: 'Greater Or Equal', category: 'compare', kind: 'input', operands: [P('Source A'), P('Source B')], help: 'True when A >= B.' },
  { mnemonic: 'LES', name: 'Less Than', category: 'compare', kind: 'input', operands: [P('Source A'), P('Source B')], help: 'True when A < B.' },
  { mnemonic: 'LEQ', name: 'Less Or Equal', category: 'compare', kind: 'input', operands: [P('Source A'), P('Source B')], help: 'True when A <= B.' },
  { mnemonic: 'LIM', name: 'Limit Test', category: 'compare', kind: 'input', operands: [P('Low'), P('Test'), P('High')], help: 'True when Low <= Test <= High.' },
  // Math
  { mnemonic: 'ADD', name: 'Add', category: 'math', kind: 'output', operands: [P('Source A'), P('Source B'), P('Dest')], help: 'Dest = A + B.' },
  { mnemonic: 'SUB', name: 'Subtract', category: 'math', kind: 'output', operands: [P('Source A'), P('Source B'), P('Dest')], help: 'Dest = A - B.' },
  { mnemonic: 'MUL', name: 'Multiply', category: 'math', kind: 'output', operands: [P('Source A'), P('Source B'), P('Dest')], help: 'Dest = A * B.' },
  { mnemonic: 'DIV', name: 'Divide', category: 'math', kind: 'output', operands: [P('Source A'), P('Source B'), P('Dest')], help: 'Dest = A / B.' },
  { mnemonic: 'MOD', name: 'Modulo', category: 'math', kind: 'output', operands: [P('Source A'), P('Source B'), P('Dest')], help: 'Dest = A modulo B.' },
  { mnemonic: 'SQR', name: 'Square Root', category: 'math', kind: 'output', operands: [P('Source'), P('Dest')], help: 'Dest = sqrt(Source).' },
  { mnemonic: 'ABS', name: 'Absolute', category: 'math', kind: 'output', operands: [P('Source'), P('Dest')], help: 'Dest = |Source|.' },
  { mnemonic: 'NEG', name: 'Negate', category: 'math', kind: 'output', operands: [P('Source'), P('Dest')], help: 'Dest = -Source.' },
  { mnemonic: 'CPT', name: 'Compute', category: 'math', kind: 'output', operands: [P('Dest'), P('Expression', 'text')], help: 'Dest = an arithmetic expression.' },
  // Move / logical
  { mnemonic: 'MOV', name: 'Move', category: 'move', kind: 'output', operands: [P('Source'), P('Dest')], help: 'Copies Source into Dest.' },
  { mnemonic: 'CLR', name: 'Clear', category: 'move', kind: 'output', operands: [P('Dest')], help: 'Sets Dest to zero.' },
  { mnemonic: 'COP', name: 'Copy', category: 'move', kind: 'output', operands: [P('Source'), P('Dest'), P('Length', 'numeric')], help: 'Copies Length elements.' },
  { mnemonic: 'FLL', name: 'Fill', category: 'move', kind: 'output', operands: [P('Source'), P('Dest'), P('Length', 'numeric')], help: 'Fills Length elements with Source.' },
  { mnemonic: 'AND', name: 'Bitwise AND', category: 'logical', kind: 'output', operands: [P('Source A'), P('Source B'), P('Dest')], help: 'Dest = A AND B.' },
  { mnemonic: 'OR', name: 'Bitwise OR', category: 'logical', kind: 'output', operands: [P('Source A'), P('Source B'), P('Dest')], help: 'Dest = A OR B.' },
  { mnemonic: 'XOR', name: 'Bitwise XOR', category: 'logical', kind: 'output', operands: [P('Source A'), P('Source B'), P('Dest')], help: 'Dest = A XOR B.' },
  { mnemonic: 'NOT', name: 'Bitwise NOT', category: 'logical', kind: 'output', operands: [P('Source'), P('Dest')], help: 'Dest = NOT Source.' },
  // Program
  { mnemonic: 'NOP', name: 'No Operation', category: 'program', kind: 'output', operands: [], help: 'Does nothing.' },
  { mnemonic: 'AFI', name: 'Always False', category: 'program', kind: 'output', operands: [], help: 'Disables the rung.' },
  { mnemonic: 'JSR', name: 'Jump To Subroutine', category: 'program', kind: 'output', operands: [P('Routine', 'text')], help: 'Calls another routine.' },
  { mnemonic: 'RET', name: 'Return', category: 'program', kind: 'output', operands: [], help: 'Returns from a subroutine.' },
];

export const INSTRUCTION_MAP: Record<string, InstructionDef> = Object.fromEntries(
  INSTRUCTIONS.map((i) => [i.mnemonic, i]),
);

export function getInstruction(mnemonic: string): InstructionDef | undefined {
  return INSTRUCTION_MAP[mnemonic.toUpperCase()];
}

/** Instructions whose primary operand is a specific structured tag type. */
export function operandAccepts(def: OperandDef, dataType: string): boolean {
  switch (def.role) {
    case 'bool':
      return dataType === 'BOOL';
    case 'timer':
      return dataType === 'TIMER';
    case 'counter':
      return dataType === 'COUNTER';
    case 'numeric':
      return dataType !== 'TIMER' && dataType !== 'COUNTER';
    case 'literal':
    case 'text':
      return true;
    default:
      return true;
  }
}
