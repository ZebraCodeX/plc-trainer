import { INSTRUCTIONS, type InstructionCategory } from '../engine/instructions';
import { LadderSymbol } from './LadderSymbol';

const CATEGORY_LABELS: Record<InstructionCategory, string> = {
  bit: 'Bit / Contacts & Coils',
  timer: 'Timers',
  counter: 'Counters',
  compare: 'Compare',
  math: 'Math',
  move: 'Move',
  logical: 'Bitwise Logic',
  program: 'Program Control',
};

const ORDER: InstructionCategory[] = [
  'bit',
  'timer',
  'counter',
  'compare',
  'math',
  'move',
  'logical',
  'program',
];

export function InstructionReference({ compact = false }: { compact?: boolean }) {
  return (
    <div className="col">
      {ORDER.map((cat) => (
        <div key={cat} className="panel">
          <h3>{CATEGORY_LABELS[cat]}</h3>
          <table>
            <thead>
              <tr>
                <th style={{ width: 100 }}>Symbol</th>
                <th style={{ width: 70 }}>Code</th>
                <th style={{ width: 150 }}>Name</th>
                {!compact && <th style={{ width: 160 }}>Operands</th>}
                <th>What it does</th>
              </tr>
            </thead>
            <tbody>
              {INSTRUCTIONS.filter((i) => i.category === cat).map((i) => (
                <tr key={i.mnemonic}>
                  <td>
                    <LadderSymbol op={i.mnemonic} />
                  </td>
                  <td className="mono" style={{ fontWeight: 700, color: 'var(--accent)' }}>
                    {i.mnemonic}
                  </td>
                  <td>{i.name}</td>
                  {!compact && (
                    <td className="mono small muted">
                      {i.operands.length ? i.operands.map((o) => o.name).join(', ') : '—'}
                    </td>
                  )}
                  <td className="muted small">{i.help}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}
