import { useMemo, useState } from 'react';
import { useStore } from '../store/store';
import { useEngine, useScanCount } from '../store/hooks';
import { analyzeRung, type RungAnalysis } from '../ladder/analysis';
import {
  addBranchToGroup,
  findBranchOf,
  findGroup,
  findGroupContainingBranch,
  findItem,
  makeConditionItem,
  makeEmptyBranch,
  makeOutputInstruction,
  removeConditionItem,
  updateOutput,
} from '../ladder/ops';
import { INSTRUCTIONS, getInstruction, operandAccepts, type InstructionDef } from '../engine/instructions';
import type { ConditionBranch, ConditionItem, Routine, Rung } from '../engine/model';
import { uid } from '../engine/uid';
import { makeRoutine } from '../engine/factory';
import { TagInput } from './TagInput';
import { LadderSymbol } from './LadderSymbol';
import { Guide } from './Guide';
import { Icon } from './icons';
import { instructionColor, CATEGORY_COLORS } from '../ladder/colors';
import type { Tag } from '../engine/types';

interface Selection {
  rungId: string;
  kind: 'item' | 'output' | 'group';
  id: string;
}

const INPUT_INSTS = INSTRUCTIONS.filter((i) => i.kind === 'input');
const OUTPUT_INSTS = INSTRUCTIONS.filter((i) => i.kind === 'output');

function operandSummary(op: string, operands: string[]): string {
  const def = getInstruction(op);
  if (!def || def.operands.length === 0) return '';
  if (op === 'XIC' || op === 'XIO' || op === 'OTE' || op === 'OTL' || op === 'OTU' || op === 'ONS')
    return operands[0] || '—';
  if (['EQU', 'NEQ', 'GRT', 'GEQ', 'LES', 'LEQ'].includes(op))
    return `${operands[0] || '?'} ${op} ${operands[1] || '?'}`;
  if (op === 'LIM') return `${operands[0] || '?'} ≤ ${operands[1] || '?'} ≤ ${operands[2] || '?'}`;
  if (['ADD', 'SUB', 'MUL', 'DIV', 'MOD', 'AND', 'OR', 'XOR'].includes(op))
    return `${operands[0] || '?'} ${op} ${operands[1] || '?'} → ${operands[2] || '?'}`;
  if (op === 'CPT') return `${operands[0] || '?'} = ${operands[1] || '?'}`;
  if (['EQUAL', 'RES'].includes(op)) return operands[0] || '—';
  return operands.filter(Boolean).join(' · ') || '—';
}

export function LadderEditor() {
  const { project, applyEdit, ui, setUi } = useStore();
  const engine = useEngine();
  const scan = useScanCount();

  const program = project.programs[0];
  const routines = program?.routines ?? [];
  const routine =
    routines.find((r) => r.id === ui.selectedRoutineId) ?? routines.find((r) => r.type === 'ladder') ?? routines[0];

  const [selection, setSelection] = useState<Selection | null>(null);
  const [pendingOp, setPendingOp] = useState<string | null>(null);
  const [error, setError] = useState('');

  const rungAnalyses = useMemo(() => {
    const map = new Map<string, RungAnalysis>();
    if (!routine || routine.type !== 'ladder' || !ui.monitor) return map;
    const ctx = engine.makeRunContext(program.id, true);
    for (const rung of routine.rungs) map.set(rung.id, analyzeRung(ctx, rung));
    return map;
  }, [routine, engine, program, ui.monitor, project, scan]);

  const bitState = useMemo(() => {
    const map = new Map<string, boolean>();
    if (!routine || routine.type !== 'ladder') return map;
    for (const rung of routine.rungs) {
      const walk = (branch: ConditionBranch) => {
        for (const item of branch.items) {
          if (item.type === 'instruction') {
            const a = item.operands?.[0] ?? '';
            if (a && !/^[-+]?\d/.test(a)) map.set(item.id, engine.db.readScalar(a) === true);
          } else {
            for (const b of item.branches ?? []) walk(b);
          }
        }
      };
      walk(rung.condition);
    }
    return map;
  }, [routine, engine, project, scan]);

  if (!program || !routine) {
    return <div className="empty-state">No program found. Create one from the Training tab.</div>;
  }

  function mutateRoutine(routineId: string, fn: (rt: Routine) => void) {
    applyEdit((p) => {
      for (const prg of p.programs) {
        const rt = prg.routines.find((r) => r.id === routineId);
        if (rt) {
          fn(rt);
          return;
        }
      }
    }, 'content');
  }

  function mutateRung(rungId: string, fn: (rung: Rung) => void) {
    mutateRoutine(routine.id, (rt) => {
      const rung = rt.rungs.find((r) => r.id === rungId);
      if (rung) fn(rung);
    });
  }

  function addRung() {
    mutateRoutine(routine.id, (rt) => {
      rt.rungs.push({
        id: uid('rung'),
        comment: '',
        condition: makeEmptyBranch(),
        outputs: [makeOutputInstruction('OTE')],
      });
    });
  }

  function deleteRung(rungId: string) {
    mutateRoutine(routine.id, (rt) => {
      rt.rungs = rt.rungs.filter((r) => r.id !== rungId);
    });
    setSelection(null);
  }

  function moveRung(rungId: string, dir: -1 | 1) {
    mutateRoutine(routine.id, (rt) => {
      const i = rt.rungs.findIndex((r) => r.id === rungId);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= rt.rungs.length) return;
      [rt.rungs[i], rt.rungs[j]] = [rt.rungs[j], rt.rungs[i]];
    });
  }

  function addConditionItem(branchId: string, op: string) {
    const def = getInstruction(op);
    if (!def || def.kind !== 'input') return;
    // find the rung containing this branch
    mutateRoutine(routine.id, (rt) => {
      for (const rung of rt.rungs) {
        const branch = findBranchById(rung.condition, branchId);
        if (branch) {
          branch.items.push(makeConditionItem(op));
          return;
        }
      }
    });
    setPendingOp(null);
  }

  function addOutput(rungId: string, op: string) {
    const def = getInstruction(op);
    if (!def || def.kind !== 'output') return;
    mutateRung(rungId, (rung) => {
      rung.outputs.push(makeOutputInstruction(op));
    });
    setPendingOp(null);
  }

  function addGroup(rungId: string, branchId: string) {
    mutateRung(rungId, (rung) => {
      const branch = findBranchById(rung.condition, branchId);
      if (!branch) return;
      const first = branch.items[0] ?? makeConditionItem('XIC');
      const second = makeConditionItem('XIC');
      const group: ConditionItem = {
        id: uid('grp'),
        type: 'group',
        branches: [
          { id: uid('br'), items: [first] },
          { id: uid('br'), items: [second] },
        ],
      };
      branch.items = [group, ...branch.items.slice(1)];
    });
  }

  function addBranch(groupId: string) {
    mutateRoutine(routine.id, (rt) => {
      for (const rung of rt.rungs) {
        if (findGroup(rung.condition, groupId)) {
          addBranchToGroup(rung.condition, groupId);
          return;
        }
      }
    });
  }

  function removeBranch(branchId: string) {
    mutateRoutine(routine.id, (rt) => {
      for (const rung of rt.rungs) {
        const group = findGroupContainingBranch(rung.condition, branchId);
        if (group && group.branches) {
          group.branches = group.branches.filter((b) => b.id !== branchId);
          return;
        }
      }
    });
  }

  function deleteItem(rungId: string, id: string) {
    mutateRung(rungId, (rung) => {
      removeConditionItem(rung.condition, id);
    });
    setSelection(null);
  }

  function deleteOutput(rungId: string, id: string) {
    mutateRung(rungId, (rung) => {
      rung.outputs = rung.outputs.filter((o) => o.id !== id);
    });
    setSelection(null);
  }

  function newRoutine(type: 'ladder' | 'st') {
    const rt = makeRoutine(type === 'ladder' ? `Routine_${routines.length + 1}` : `ST_${routines.length + 1}`, type);
    applyEdit((p) => {
      p.programs[0].routines.push(rt);
    }, 'content');
    setUi({ selectedRoutineId: rt.id });
  }

  function renameRoutine(name: string) {
    mutateRoutine(routine.id, (rt) => {
      rt.name = name;
    });
  }

  function deleteRoutine() {
    if (routines.length <= 1) return;
    applyEdit((p) => {
      p.programs[0].routines = p.programs[0].routines.filter((r) => r.id !== routine.id);
    }, 'content');
    setUi({ selectedRoutineId: project.programs[0].routines[0]?.id ?? null });
  }

  const selectedRung = selection ? routine.rungs.find((r) => r.id === selection.rungId) : undefined;

  if (routine.type !== 'ladder') {
    return (
      <div className="col">
        <RoutineBar
          routine={routine}
          routines={routines}
          onSelect={(id) => setUi({ selectedRoutineId: id })}
          onNew={newRoutine}
          onRename={renameRoutine}
          onDelete={deleteRoutine}
        />
        <div className="empty-state">
          This is a Structured Text routine. Switch to the <b>Structured Text</b> tab to edit it.
        </div>
      </div>
    );
  }

  return (
    <div className="col">
      <RoutineBar
        routine={routine}
        routines={routines}
        onSelect={(id) => setUi({ selectedRoutineId: id })}
        onNew={newRoutine}
        onRename={renameRoutine}
        onDelete={deleteRoutine}
      />

      <Guide title="How ladder logic works">
        <ul className="bullets">
          <li>
            <b>Rungs</b> are evaluated left to right. Power flows from the left rail through{' '}
            <b>contacts</b> to the <b>coils</b> on the right. Green means the path is energized this
            scan.
          </li>
          <li>
            Click an instruction in the palette, then click a <span className="mono">+</span> slot —
            or drag the chip onto the slot. Click any element to change its tag or instruction.
          </li>
          <li>
            Contacts: <b>XIC</b> is normally open (passes when ON), <b>XIO</b> is normally closed
            (passes when OFF). Coils: <b>OTE</b> follows the rung, <b>OTL</b>/<b>OTU</b> latch and
            unlatch.
          </li>
          <li>
            Use the <b>∥</b> button to add a parallel branch, and <b>+ branch</b> inside a branch to
            nest more. Put the “seal-in” contact in parallel with the start button.
          </li>
          <li>
            Timers/counters are structured tags — create one in the Tag Database first (e.g.{' '}
            <span className="mono">Run_Timer</span>), then use it in TON/CTU.
          </li>
        </ul>
      </Guide>

      <div className="ladder-toolbar">
        <button onClick={addRung} className="btn-add-rung">
          <Icon name="plus" size={15} /> Rung
        </button>
        <label className="pill">
          <input
            type="checkbox"
            checked={ui.monitor}
            onChange={(e) => setUi({ monitor: e.target.checked })}
          />
          Live power flow
        </label>
        <span className="muted small">
          Pick an instruction, then click a <b>+</b> slot — or drag it onto a slot.
        </span>
        {pendingOp && (
          <span className="pill placing">
            Placing <b className="mono">{pendingOp}</b>{' '}
            <button onClick={() => setPendingOp(null)}>cancel</button>
          </span>
        )}
        {error && <span className="pill" style={{ color: 'var(--red)' }}>{error}</span>}
      </div>

      <div className="ladder-layout">
        <div className="col palette-col">
          <Palette
            title="Conditions (inputs)"
            instructions={INPUT_INSTS}
            pending={pendingOp}
            onPick={setPendingOp}
          />
          <Palette
            title="Outputs"
            instructions={OUTPUT_INSTS}
            pending={pendingOp}
            onPick={setPendingOp}
          />
        </div>

        <div className="rungs">
          <div className="rungs-head">
            <span>Rung</span>
            <span className="muted small">Logic</span>
          </div>
          {routine.rungs.length === 0 && (
            <div className="empty-state">No rungs yet. Click “Rung” to start programming.</div>
          )}
          {routine.rungs.map((rung, index) => (
            <div
              key={rung.id}
              className={`rung ${ui.selectedRungId === rung.id ? 'selected' : ''}`}
              onClick={() => setUi({ selectedRungId: rung.id })}
            >
              <div className="rung-gutter">
                <span className="rung-no">{index + 1}</span>
                <button title="Move up" onClick={() => moveRung(rung.id, -1)}>
                  <Icon name="arrowUp" size={13} />
                </button>
                <button title="Move down" onClick={() => moveRung(rung.id, 1)}>
                  <Icon name="arrowDown" size={13} />
                </button>
                <button className="danger" title="Delete rung" onClick={() => deleteRung(rung.id)}>
                  <Icon name="trash" size={13} />
                </button>
              </div>
              <div className="rung-body">
                <div className={`ladder-rail ${rungAnalyses.get(rung.id)?.power ? 'hot' : ''}`} />
                <BranchView
                  branch={rung.condition}
                  analysis={rungAnalyses.get(rung.id)}
                  bitState={bitState}
                  selection={selection}
                  onSelect={(s) => setSelection(s)}
                  onAddItem={addConditionItem}
                  onAddGroup={(branchId) => addGroup(rung.id, branchId)}
                  onAddBranch={addBranch}
                  onRemoveBranch={removeBranch}
                  onDropOp={(op, branchId) => {
                    if (op && getInstruction(op)?.kind === 'input') addConditionItem(branchId, op);
                  }}
                  rungId={rung.id}
                />
                <div className={`ladder-rail ${rungAnalyses.get(rung.id)?.power ? 'hot' : ''}`} />
                <div className="output-zone">
                  {rung.outputs.map((out) => (
                    <OutputView
                      key={out.id}
                      op={out.op}
                      operands={out.operands}
                      hot={rungAnalyses.get(rung.id)?.power ?? false}
                      selected={selection?.kind === 'output' && selection.id === out.id}
                      onSelect={() => setSelection({ rungId: rung.id, kind: 'output', id: out.id })}
                    />
                  ))}
                  <DropSlot
                    label="+"
                    onDrop={(op) => addOutput(rung.id, op || pendingOp || 'OTE')}
                    onClick={() => addOutput(rung.id, pendingOp ?? 'OTE')}
                  />
                </div>
                <div className={`ladder-rail end ${rungAnalyses.get(rung.id)?.power ? 'hot' : ''}`} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {selection && selectedRung && (
        <SelectionEditor
          selection={selection}
          rung={selectedRung}
          onClose={() => setSelection(null)}
          mutate={(fn) => mutateRung(selectedRung.id, fn)}
          onDeleteItem={() => deleteItem(selectedRung.id, selection.id)}
          onDeleteOutput={() => deleteOutput(selectedRung.id, selection.id)}
          onAddBranch={() => addBranch(selection.id)}
          onError={setError}
        />
      )}
    </div>
  );
}

function findBranchById(branch: ConditionBranch, id: string): ConditionBranch | null {
  if (branch.id === id) return branch;
  for (const item of branch.items) {
    if (item.type === 'group') {
      for (const b of item.branches ?? []) {
        const found = findBranchById(b, id);
        if (found) return found;
      }
    }
  }
  return null;
}

function DropSlot({
  label,
  onDrop,
  onClick,
  vertical,
}: {
  label: string;
  onDrop: (op: string) => void;
  onClick: () => void;
  vertical?: boolean;
}) {
  const [over, setOver] = useState(false);
  return (
    <div
      className="drop-hint"
      style={vertical ? { padding: '3px 10px' } : undefined}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setOver(false);
        onDrop(e.dataTransfer.getData('text/op'));
      }}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      title="Add instruction"
    >
      {over ? 'Drop' : label}
    </div>
  );
}

function Palette({
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
  const categories = [...new Set(instructions.map((i) => i.category))];
  return (
    <div className="panel palette-panel">
      <h3>{title}</h3>
      {categories.map((cat) => (
        <div key={cat} className="palette-section">
          <div className="palette-cat" style={{ color: CATEGORY_COLORS[cat] }}>
            <span className="palette-dot" style={{ background: CATEGORY_COLORS[cat] }} />
            {categoryLabelOf(cat)}
          </div>
          <div className="palette-grid">
            {instructions
              .filter((i) => i.category === cat)
              .map((i) => (
                <div
                  key={i.mnemonic}
                  className={`chip ${pending === i.mnemonic ? 'picked' : ''}`}
                  style={{ ['--op-color' as string]: instructionColor(i.mnemonic) }}
                  draggable
                  title={`${i.name} — ${i.help}`}
                  onDragStart={(e) => e.dataTransfer.setData('text/op', i.mnemonic)}
                  onClick={() => onPick(i.mnemonic)}
                >
                  <span className="chip-code">{i.mnemonic}</span>
                  <span className="chip-name">{i.name}</span>
                </div>
              ))}
          </div>
        </div>
      ))}
    </div>
  );
}

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

function BranchView({
  branch,
  analysis,
  bitState,
  selection,
  onSelect,
  onAddItem,
  onAddGroup,
  onAddBranch,
  onRemoveBranch,
  onDropOp,
  rungId,
}: {
  branch: ConditionBranch;
  analysis?: RungAnalysis;
  bitState: Map<string, boolean>;
  selection: Selection | null;
  onSelect: (s: Selection) => void;
  onAddItem: (branchId: string, op: string) => void;
  onAddGroup: (branchId: string) => void;
  onAddBranch: (groupId: string) => void;
  onRemoveBranch: (branchId: string) => void;
  onDropOp: (op: string, branchId: string) => void;
  rungId: string;
}) {
  return (
    <div className="series">
      {branch.items.map((item) => {
        if (item.type === 'group') {
          const branches = item.branches ?? [];
          const anyActive = branches.some((b) => analysis?.activeBranches.has(b.id));
          return (
            <div className="parallel-wrap" key={item.id}>
              <div className="parallel">
                <div className={`branch-bar ${anyActive ? 'hot' : ''}`} />
                <div className="branch-stack">
                  {branches.map((sub, i) => {
                    const active = analysis?.activeBranches.has(sub.id);
                    return (
                      <div className={`branch-row ${active ? 'active' : ''}`} key={sub.id}>
                        <BranchView
                          branch={sub}
                          analysis={analysis}
                          bitState={bitState}
                          selection={selection}
                          onSelect={onSelect}
                          onAddItem={onAddItem}
                          onAddGroup={onAddGroup}
                          onAddBranch={onAddBranch}
                          onRemoveBranch={onRemoveBranch}
                          onDropOp={onDropOp}
                          rungId={rungId}
                        />
                        {branches.length > 1 && (
                          <button
                            className="branch-del"
                            title="Remove branch"
                            onClick={(e) => {
                              e.stopPropagation();
                              onRemoveBranch(sub.id);
                            }}
                          >
                            ×
                          </button>
                        )}
                        <span
                          className="branch-node"
                          data-first={i === 0}
                          data-last={i === branches.length - 1}
                        />
                      </div>
                    );
                  })}
                </div>
                <div className={`branch-bar ${anyActive ? 'hot' : ''}`} />
              </div>
              <button className="add-branch" onClick={() => onAddBranch(item.id)}>
                + branch
              </button>
            </div>
          );
        }
        const def = getInstruction(item.op ?? '');
        const st = analysis?.items.get(item.id);
        return (
          <LadderItem
            key={item.id}
            op={item.op ?? 'XIC'}
            operands={item.operands ?? []}
            hotIn={st?.in ?? false}
            hotOut={st?.out ?? false}
            bit={bitState.get(item.id) ?? false}
            title={`${item.op} — ${def?.name ?? ''}: ${def?.help ?? ''}`}
            selected={selection?.kind === 'item' && selection.id === item.id}
            onClick={() => onSelect({ rungId, kind: 'item', id: item.id })}
          />
        );
      })}
      <DropSlot
        label="+"
        onDrop={(op) => onDropOp(op, branch.id)}
        onClick={() => onAddItem(branch.id, 'XIC')}
      />
      <button className="branch-btn" title="Insert parallel branch" onClick={() => onAddGroup(branch.id)}>
        ∥
      </button>
    </div>
  );
}

function LadderItem({
  op,
  operands,
  hotIn,
  hotOut,
  bit,
  title,
  selected,
  onClick,
}: {
  op: string;
  operands: string[];
  hotIn: boolean;
  hotOut: boolean;
  bit: boolean;
  title: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <div className="lad-cell" onClick={(e) => { e.stopPropagation(); onClick(); }}>
      <div className={`lad-wire ${hotIn ? 'hot' : ''}`} />
      <div
        className={`lad-item ${hotOut ? 'energized' : ''} ${selected ? 'selected' : ''}`}
        style={{ ['--op-color' as string]: instructionColor(op) }}
        title={title}
      >
        <LadderSymbol op={op} hot={hotOut} bit={bit} />
        <span className="lad-op">{op}</span>
        <span className="lad-tag">{operandSummary(op, operands)}</span>
      </div>
    </div>
  );
}

function OutputView({
  op,
  operands,
  hot,
  selected,
  onSelect,
}: {
  op: string;
  operands: string[];
  hot: boolean;
  selected: boolean;
  onSelect: () => void;
}) {
  const def = getInstruction(op);
  return (
    <div className="lad-cell output" onClick={(e) => { e.stopPropagation(); onSelect(); }}>
      <div className={`lad-wire ${hot ? 'hot' : ''}`} />
      <div
        className={`lad-item ${hot ? 'energized' : ''} ${selected ? 'selected' : ''}`}
        style={{ ['--op-color' as string]: instructionColor(op) }}
        title={`${op} — ${def?.name ?? ''}: ${def?.help ?? ''}`}
      >
        <LadderSymbol op={op} hot={hot} />
        <span className="lad-op">{op}</span>
        <span className="lad-tag">{operandSummary(op, operands)}</span>
      </div>
    </div>
  );
}

function RoutineBar({
  routine,
  routines,
  onSelect,
  onNew,
  onRename,
  onDelete,
}: {
  routine: Routine;
  routines: Routine[];
  onSelect: (id: string) => void;
  onNew: (type: 'ladder' | 'st') => void;
  onRename: (name: string) => void;
  onDelete: () => void;
}) {
  return (
    <div className="toolbar">
      <h3 style={{ margin: 0 }}>Routines</h3>
      {routines.map((r) => (
        <button
          key={r.id}
          className={r.id === routine.id ? 'active' : ''}
          onClick={() => onSelect(r.id)}
        >
          {r.name} <span className="badge">{r.type === 'st' ? 'ST' : 'LAD'}</span>
        </button>
      ))}
      <button onClick={() => onNew('ladder')}>+ Ladder</button>
      <button onClick={() => onNew('st')}>+ ST</button>
      <input
        value={routine.name}
        onChange={(e) => onRename(e.target.value)}
        style={{ width: 150 }}
        title="Routine name"
      />
      <button className="danger" onClick={onDelete} disabled={routines.length <= 1}>
        Delete routine
      </button>
    </div>
  );
}

function SelectionEditor({
  selection,
  rung,
  onClose,
  mutate,
  onDeleteItem,
  onDeleteOutput,
  onAddBranch,
  onError,
}: {
  selection: Selection;
  rung: Rung;
  onClose: () => void;
  mutate: (fn: (rung: Rung) => void) => void;
  onDeleteItem: () => void;
  onDeleteOutput: () => void;
  onAddBranch: () => void;
  onError: (msg: string) => void;
}) {
  void onError;
  if (selection.kind === 'output') {
    const out = rung.outputs.find((o) => o.id === selection.id);
    if (!out) return null;
    const def = getInstruction(out.op);
    return (
      <div className="panel">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <h3 style={{ margin: 0 }}>Edit output instruction</h3>
          <div className="row">
            <button className="danger" onClick={onDeleteOutput}>
              Delete
            </button>
            <button onClick={onClose}>Close</button>
          </div>
        </div>
        <div className="row" style={{ marginTop: 8 }}>
          <select
            value={out.op}
            onChange={(e) =>
              mutate((r) => {
                updateOutput(r, out.id, e.target.value);
              })
            }
          >
            {OUTPUT_INSTS.map((i) => (
              <option key={i.mnemonic} value={i.mnemonic}>
                {i.mnemonic} — {i.name}
              </option>
            ))}
          </select>
          <span className="muted small">{def?.help}</span>
        </div>
        <div className="row" style={{ marginTop: 8 }}>
          {def?.operands.map((opnd, i) => (
            <OperandField
              key={opnd.name}
              label={opnd.name}
              role={opnd.role}
              value={out.operands[i] ?? ''}
              onChange={(v) =>
                mutate((r) => {
                  const o = r.outputs.find((x) => x.id === out.id);
                  if (o) o.operands[i] = v;
                })
              }
            />
          ))}
        </div>
      </div>
    );
  }

  const item = findItem(rung.condition, selection.id);
  if (!item) return null;
  if (item.type === 'group') {
    return (
      <div className="panel">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <h3 style={{ margin: 0 }}>Parallel branch</h3>
          <div className="row">
            <button onClick={onAddBranch}>+ Add branch</button>
            <button className="danger" onClick={onDeleteItem}>
              Delete
            </button>
            <button onClick={onClose}>Close</button>
          </div>
        </div>
      </div>
    );
  }
  const def = getInstruction(item.op ?? '');
  return (
    <div className="panel">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h3 style={{ margin: 0 }}>Edit condition instruction</h3>
        <div className="row">
          <button className="danger" onClick={onDeleteItem}>
            Delete
          </button>
          <button onClick={onClose}>Close</button>
        </div>
      </div>
      <div className="row" style={{ marginTop: 8 }}>
        <select
          value={item.op}
          onChange={(e) =>
            mutate((r) => {
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
              {i.mnemonic} — {i.name}
            </option>
          ))}
        </select>
        <span className="muted small">{def?.help}</span>
      </div>
      <div className="row" style={{ marginTop: 8 }}>
        {def?.operands.map((opnd, i) => (
          <OperandField
            key={opnd.name}
            label={opnd.name}
            role={opnd.role}
            value={item.operands?.[i] ?? ''}
            onChange={(v) =>
              mutate((r) => {
                const it = findItem(r.condition, item.id);
                if (it && it.operands) it.operands[i] = v;
              })
            }
          />
        ))}
      </div>
      <div className="muted small" style={{ marginTop: 8 }}>
        Belongs to branch {findBranchOf(rung.condition, item.id)?.id.slice(-4)} · group inside{' '}
        {findGroup(rung.condition, item.id) ? 'yes' : 'no'}
      </div>
    </div>
  );
}

function OperandField({
  label,
  role,
  value,
  onChange,
}: {
  label: string;
  role: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const accepts = useMemo(() => {
    if (role === 'bool') return (t: Tag) => t.dataType === 'BOOL';
    if (role === 'timer') return (t: Tag) => t.dataType === 'TIMER';
    if (role === 'counter') return (t: Tag) => t.dataType === 'COUNTER';
    if (role === 'numeric') return (t: Tag) => operandAccepts({ name: '', role: 'numeric' }, t.dataType);
    return undefined;
  }, [role]);

  return (
    <label className="col" style={{ gap: 3 }}>
      <span className="muted small">{label}</span>
      {role === 'text' ? (
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={{ width: 220 }}
          placeholder="expression / routine"
        />
      ) : (
        <TagInput
          value={value}
          onChange={onChange}
          accepts={accepts}
          width={140}
          placeholder={role === 'numeric' ? 'tag or number' : 'tag'}
        />
      )}
    </label>
  );
}
