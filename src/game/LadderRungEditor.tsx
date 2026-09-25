import { useState } from 'react';
import { INSTRUCTIONS, getInstruction } from '../engine/instructions';
import { instructionColor } from '../ladder/colors';
import { LadderSymbol } from '../ui/LadderSymbol';
import {
  findItem,
  makeConditionItem,
  makeEmptyBranch,
  makeOutputInstruction,
  removeConditionItem,
  findGroupContainingBranch,
} from '../ladder/ops';
import type { ConditionBranch, ConditionItem, Rung } from '../engine/model';
import { uid } from '../engine/uid';
import { Icon } from '../ui/icons';

const INPUT_INSTS = INSTRUCTIONS.filter((i) => i.kind === 'input');
const OUTPUT_INSTS = INSTRUCTIONS.filter((i) => i.kind === 'output');

/**
 * A focused ladder editor for the game arena: build rungs from a palette,
 * edit tags inline, add parallel branches, reorder and delete. Mirrors the main
 * editor's model so missions and the training editor stay compatible.
 */
export function LadderRungEditor({
  rungs,
  io,
  onChange,
}: {
  rungs: Rung[];
  io: string[];
  onChange: (rungs: Rung[]) => void;
}) {
  const [pending, setPending] = useState<string | null>(null);

  function clone(next: Rung[]) {
    onChange(next.map((r) => structuredCloneRung(r)));
  }

  function addRung() {
    clone([
      ...rungs,
      {
        id: uid('rung'),
        comment: '',
        condition: makeEmptyBranch(),
        outputs: [makeOutputInstruction('OTE')],
      },
    ]);
  }

  function updateRung(id: string, fn: (r: Rung) => void) {
    const next = rungs.map((r) => structuredCloneRung(r));
    const rung = next.find((r) => r.id === id);
    if (rung) fn(rung);
    onChange(next);
  }

  function moveRung(id: string, dir: -1 | 1) {
    const i = rungs.findIndex((r) => r.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= rungs.length) return;
    const next = [...rungs];
    [next[i], next[j]] = [next[j], next[i]];
    clone(next);
  }

  function deleteRung(id: string) {
    onChange(rungs.filter((r) => r.id !== id));
  }

  return (
    <div className="rung-editor">
      <div className="rung-palette">
        <span className="muted small">add:</span>
        {INPUT_INSTS.map((i) => (
          <button
            key={i.mnemonic}
            className="rung-chip"
            style={{ ['--op-color' as string]: instructionColor(i.mnemonic) }}
            title={`${i.name} — ${i.help}`}
            onClick={() => setPending(i.mnemonic)}
          >
            <LadderSymbol op={i.mnemonic} />
          </button>
        ))}
        <span className="muted small">|</span>
        {OUTPUT_INSTS.map((i) => (
          <button
            key={i.mnemonic}
            className="rung-chip out"
            style={{ ['--op-color' as string]: instructionColor(i.mnemonic) }}
            title={`${i.name} — ${i.help}`}
            onClick={() => setPending(i.mnemonic)}
          >
            <LadderSymbol op={i.mnemonic} />
          </button>
        ))}
      </div>
      {pending && (
        <div className="placing small">
          Placing <b className="mono">{pending}</b> — click a slot below, or{' '}
          <button onClick={() => setPending(null)}>cancel</button>
        </div>
      )}

      <div className="rungs game-rungs">
        {rungs.length === 0 && (
          <div className="empty-state small">
            No logic yet. Add a rung and build the circuit.
          </div>
        )}
        {rungs.map((rung, index) => (
          <div className="rung" key={rung.id}>
            <div className="rung-gutter">
              <span className="rung-no">{index + 1}</span>
              <button onClick={() => moveRung(rung.id, -1)} title="Move up">
                <Icon name="arrowUp" size={12} />
              </button>
              <button onClick={() => moveRung(rung.id, 1)} title="Move down">
                <Icon name="arrowDown" size={12} />
              </button>
              <button className="danger" onClick={() => deleteRung(rung.id)} title="Delete">
                <Icon name="trash" size={12} />
              </button>
            </div>
            <div className="rung-body">
              <div className="ladder-rail" />
              <Branch
                branch={rung.condition}
                io={io}
                pending={pending}
                consume={() => setPending(null)}
                onMutate={(fn) => updateRung(rung.id, fn)}
              />
              <div className="ladder-rail" />
              <div className="output-zone">
                {rung.outputs.map((out) => (
                  <div className="lad-cell output" key={out.id}>
                    <div className="lad-wire" />
                    <div
                      className="lad-item"
                      style={{ ['--op-color' as string]: instructionColor(out.op) }}
                      title={getInstruction(out.op)?.help}
                    >
                      <LadderSymbol op={out.op} />
                      <span className="lad-op">{out.op}</span>
                      <OpSelect
                        value={out.operands[0] ?? ''}
                        io={io}
                        onChange={(v) =>
                          updateRung(rung.id, (r) => {
                            const o = r.outputs.find((x) => x.id === out.id);
                            if (o) o.operands[0] = v;
                          })
                        }
                      />
                    </div>
                  </div>
                ))}
                <select
                  className="mini-select"
                  value=""
                  onChange={(e) => {
                    if (!e.target.value) return;
                    updateRung(rung.id, (r) => {
                      r.outputs.push(makeOutputInstruction(e.target.value));
                    });
                  }}
                >
                  <option value="">+ coil</option>
                  {OUTPUT_INSTS.map((i) => (
                    <option key={i.mnemonic} value={i.mnemonic}>
                      {i.mnemonic}
                    </option>
                  ))}
                </select>
              </div>
              <div className="ladder-rail" />
            </div>
          </div>
        ))}
        <button className="btn-add-rung" onClick={addRung}>
          <Icon name="plus" size={14} /> Rung
        </button>
      </div>
    </div>
  );
}

function Branch({
  branch,
  io,
  pending,
  consume,
  onMutate,
}: {
  branch: ConditionBranch;
  io: string[];
  pending: string | null;
  consume: () => void;
  onMutate: (fn: (r: Rung) => void) => void;
}) {
  return (
    <div className="series">
      {branch.items.map((item) => {
        if (item.type === 'group') {
          const branches = item.branches ?? [];
          return (
            <div className="parallel-wrap" key={item.id}>
              <div className="parallel">
                <div className="branch-bar" />
                <div className="branch-stack">
                  {branches.map((sub) => (
                    <div className="branch-row" key={sub.id}>
                      {branches.length > 1 && (
                        <button
                          className="branch-del"
                          title="Remove branch"
                          onClick={(e) => {
                            e.stopPropagation();
                            onMutate((r) => {
                              const group = findGroupContainingBranch(r.condition, sub.id);
                              if (group && group.branches)
                                group.branches = group.branches.filter((b) => b.id !== sub.id);
                            });
                          }}
                        >
                          ×
                        </button>
                      )}
                      <Branch
                        branch={sub}
                        io={io}
                        pending={pending}
                        consume={consume}
                        onMutate={onMutate}
                      />
                    </div>
                  ))}
                </div>
                <div className="branch-bar" />
              </div>
            </div>
          );
        }
        const def = getInstruction(item.op ?? '');
        return (
          <div className="lad-cell" key={item.id}>
            <div className="lad-wire" />
            <div
              className="lad-item"
              style={{ ['--op-color' as string]: instructionColor(item.op ?? 'XIC') }}
              title={def?.help}
            >
              <LadderSymbol op={item.op ?? 'XIC'} />
              <span className="lad-op">{item.op}</span>
              <OpSelect
                value={item.operands?.[0] ?? ''}
                io={io}
                onChange={(v) =>
                  onMutate((r) => {
                    const it = findItem(r.condition, item.id);
                    if (it && it.operands) it.operands[0] = v;
                  })
                }
              />
              <div className="lad-cell-tools">
                <select
                  className="mini-select"
                  value={item.op}
                  onChange={(e) =>
                    onMutate((r) => {
                      const it = findItem(r.condition, item.id);
                      if (it) {
                        const nd = getInstruction(e.target.value);
                        it.op = e.target.value;
                        it.operands = nd ? nd.operands.map((_, i) => it.operands?.[i] ?? '') : [];
                      }
                    })
                  }
                >
                  {INPUT_INSTS.map((i) => (
                    <option key={i.mnemonic} value={i.mnemonic}>
                      {i.mnemonic}
                    </option>
                  ))}
                </select>
                <button
                  className="tool-x"
                  title="Delete instruction"
                  onClick={() =>
                    onMutate((r) => {
                      removeConditionItem(r.condition, item.id);
                    })
                  }
                >
                  ×
                </button>
              </div>
            </div>
          </div>
        );
      })}
      <AddSlot
        onAdd={(op) => {
          if (!op) return;
          onMutate((r) => {
            const target = findBranch(r.condition, branch.id) ?? r.condition;
            target.items.push(makeConditionItem(op));
          });
          consume();
        }}
        pending={pending}
      />
      <button
        className="branch-btn"
        title="Insert parallel branch"
        onClick={() =>
          onMutate((r) => {
            const br = findBranch(r.condition, branch.id) ?? r.condition;
            const first = br.items[0] ?? makeConditionItem('XIC');
            const second = makeConditionItem('XIC');
            br.items = [
              { id: uid('grp'), type: 'group', branches: [
                { id: uid('br'), items: [first] },
                { id: uid('br'), items: [second] },
              ] },
              ...br.items.slice(1),
            ];
          })
        }
      >
        ∥
      </button>
    </div>
  );
}

function AddSlot({ onAdd, pending }: { onAdd: (op: string) => void; pending: string | null }) {
  return (
    <button
      className={`drop-hint ${pending ? 'armed' : ''}`}
      title="Add instruction"
      onClick={() => onAdd(pending ?? 'XIC')}
    >
      +
    </button>
  );
}

function OpSelect({
  value,
  io,
  onChange,
}: {
  value: string;
  io: string[];
  onChange: (v: string) => void;
}) {
  return (
    <select className="op-select" value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">—</option>
      {io.map((name) => (
        <option key={name} value={name}>
          {name}
        </option>
      ))}
    </select>
  );
}

function findBranch(branch: ConditionBranch, id: string): ConditionBranch | null {
  if (branch.id === id) return branch;
  for (const item of branch.items) {
    if (item.type === 'group') {
      for (const b of item.branches ?? []) {
        const f = findBranch(b, id);
        if (f) return f;
      }
    }
  }
  return null;
}

function structuredCloneRung(rung: Rung): Rung {
  return {
    ...rung,
    condition: cloneBranch(rung.condition),
    outputs: rung.outputs.map((o) => ({ ...o, operands: [...o.operands] })),
  };
}

function cloneBranch(branch: ConditionBranch): ConditionBranch {
  return {
    id: branch.id,
    items: branch.items.map((item: ConditionItem) =>
      item.type === 'group'
        ? { ...item, branches: (item.branches ?? []).map(cloneBranch) }
        : { ...item, operands: [...(item.operands ?? [])] },
    ),
  };
}

