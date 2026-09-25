import { useState } from 'react';
import { useStore } from '../store/store';
import { INSTRUCTIONS, type InstructionDef } from '../engine/instructions';
import { instructionColor, CATEGORY_COLORS } from '../ladder/colors';
import { LadderSymbol } from './LadderSymbol';
import { Icon } from './icons';

const INPUT_INSTS = INSTRUCTIONS.filter((i) => i.kind === 'input');
const OUTPUT_INSTS = INSTRUCTIONS.filter((i) => i.kind === 'output');

function categoryLabelOf(cat: string): string {
  const labels: Record<string, string> = {
    bit: 'Bit & Contacts',
    timer: 'Timers',
    counter: 'Counters',
    compare: 'Compare',
    math: 'Math',
    move: 'Move',
    logical: 'Bitwise Logic',
    program: 'Program Control',
  };
  return labels[cat] ?? cat;
}

/**
 * Ladder authoring controls (new rung, live power flow toggle, and the
 * Conditions / Outputs instruction dropdowns). Rendered inside the topbar so
 * the ladder page can devote all of its vertical space to rungs.
 */
export function LadderToolbar() {
  const { ui, setUi, addRung } = useStore();
  const pendingOp = ui.pendingOp;

  return (
    <div className="ladder-toolbar">
      <button onClick={addRung} className="btn-add-rung" title="Add a new rung">
        <Icon name="plus" size={15} /> <span>Rung</span>
      </button>

      <PaletteMenu
        title="Conditions"
        instructions={INPUT_INSTS}
        pending={pendingOp}
        onPick={(op) => setUi({ pendingOp: op })}
      />
      <PaletteMenu
        title="Outputs"
        instructions={OUTPUT_INSTS}
        pending={pendingOp}
        onPick={(op) => setUi({ pendingOp: op })}
      />

      <label className="pill" title="Highlight energized paths while running">
        <input
          type="checkbox"
          checked={ui.monitor}
          onChange={(e) => setUi({ monitor: e.target.checked })}
        />
        <span>Live flow</span>
      </label>

      {pendingOp && (
        <span className="pill placing">
          Placing <b className="mono">{pendingOp}</b>{' '}
          <button onClick={() => setUi({ pendingOp: null })}>cancel</button>
        </span>
      )}
    </div>
  );
}

function PaletteMenu({
  title,
  instructions,
  pending,
  onPick,
}: {
  title: string;
  instructions: InstructionDef[];
  pending: string | null;
  onPick: (op: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const categories = [...new Set(instructions.map((i) => i.category))];

  return (
    <div className="palette-menu">
      <button
        className={`palette-menu-btn ${open ? 'open' : ''}`}
        onClick={() => setOpen((o) => !o)}
        title={`${title} menu`}
      >
        <span>{title}</span>
        <span className="caret">▾</span>
      </button>
      {open && (
        <>
          <div className="palette-scrim" onClick={() => setOpen(false)} />
          <div className="palette-dropdown">
            {categories.map((cat) => (
              <div key={cat} className="palette-row">
                <span
                  className="palette-cat-inline"
                  style={{ color: CATEGORY_COLORS[cat] }}
                  title={categoryLabelOf(cat)}
                >
                  <span className="palette-dot" style={{ background: CATEGORY_COLORS[cat] }} />
                  {categoryLabelOf(cat)}
                </span>
                <div className="palette-row-items">
                  {instructions
                    .filter((i) => i.category === cat)
                    .map((i) => (
                      <button
                        key={i.mnemonic}
                        className={`rung-chip ${pending === i.mnemonic ? 'picked' : ''}`}
                        style={{ ['--op-color' as string]: instructionColor(i.mnemonic) }}
                        draggable
                        title={`${i.mnemonic} — ${i.name}: ${i.help}`}
                        onDragStart={(e) => e.dataTransfer.setData('text/op', i.mnemonic)}
                        onClick={() => {
                          onPick(i.mnemonic);
                          setOpen(false);
                        }}
                      >
                        <LadderSymbol op={i.mnemonic} />
                      </button>
                    ))}
                </div>
              </div>
            ))}
            <div className="palette-dropdown-foot">
              <span className="muted small">Click or drag an instruction onto a rung slot</span>
              <button className="small" onClick={() => setOpen(false)}>
                Close
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
