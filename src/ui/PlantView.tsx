import { useRef, useState } from 'react';
import { useStore } from '../store/store';
import { useEngine, useScanCount } from '../store/hooks';
import { PROCESS_DEFS, type TerminalDef } from '../engine/process';
import type { ProcessComponent, ProcessType } from '../engine/model';
import { makeComponent } from '../engine/factory';
import { TagInput } from './TagInput';
import { Guide } from './Guide';
import { Icon } from './icons';
import { ProcessVisual } from './ProcessVisual';

const TYPE_LIST = Object.values(PROCESS_DEFS);

export function PlantView() {
  const { project, applyEdit } = useStore();
  const engine = useEngine();
  useScanCount();
  const canvasRef = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const dragRef = useRef<{ id: string; dx: number; dy: number } | null>(null);
  const [dragging, setDragging] = useState<{ id: string; x: number; y: number } | null>(null);

  function addComponent(type: ProcessType, x: number, y: number) {
    const def = PROCESS_DEFS[type];
    const comp = makeComponent(
      type,
      x,
      y,
      `${def.label} ${project.process.filter((c) => c.type === type).length + 1}`,
      {},
      { ...def.defaults },
    );
    applyEdit((p) => {
      p.process.push(comp);
    }, 'content');
    setSelected(comp.id);
  }

  function updateComponent(
    id: string,
    fn: (c: ProcessComponent) => void,
    kind: 'content' | 'structure' = 'content',
  ) {
    applyEdit((p) => {
      const c = p.process.find((x) => x.id === id);
      if (c) fn(c);
    }, kind);
  }

  function deleteComponent(id: string) {
    applyEdit((p) => {
      p.process = p.process.filter((c) => c.id !== id);
    }, 'content');
    setSelected(null);
  }

  function onCanvasDrop(e: React.DragEvent) {
    e.preventDefault();
    const type = e.dataTransfer.getData('text/plant') as ProcessType;
    if (!type || !PROCESS_DEFS[type]) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    const x = e.clientX - (rect?.left ?? 0) - 40;
    const y = e.clientY - (rect?.top ?? 0) - 20 + (canvasRef.current?.scrollTop ?? 0);
    addComponent(type, Math.max(0, x), Math.max(0, y));
  }

  function onItemMouseDown(e: React.MouseEvent, comp: ProcessComponent) {
    e.stopPropagation();
    const rect = canvasRef.current?.getBoundingClientRect();
    dragRef.current = {
      id: comp.id,
      dx: e.clientX - (rect?.left ?? 0) - comp.x,
      dy: e.clientY - (rect?.top ?? 0) - comp.y + (canvasRef.current?.scrollTop ?? 0),
    };
    setSelected(comp.id);
  }

  function onCanvasMouseMove(e: React.MouseEvent) {
    const drag = dragRef.current;
    if (!drag) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    const x = Math.max(0, e.clientX - (rect?.left ?? 0) - drag.dx);
    const y = Math.max(0, e.clientY - (rect?.top ?? 0) - drag.dy + (canvasRef.current?.scrollTop ?? 0));
    setDragging({ id: drag.id, x, y });
  }

  function onCanvasMouseUp() {
    const drag = dragRef.current;
    const pos = dragging;
    dragRef.current = null;
    if (drag && pos) {
      applyEdit((p) => {
        const c = p.process.find((x) => x.id === drag.id);
        if (c) {
          c.x = Math.round(pos.x);
          c.y = Math.round(pos.y);
        }
      }, 'content');
    }
    setDragging(null);
  }

  const selectedComp = project.process.find((c) => c.id === selected);
  const wiredCount = (c: ProcessComponent) =>
    Object.values(c.bindings).filter((v) => v && v.trim()).length;
  const terminalCount = (c: ProcessComponent) => PROCESS_DEFS[c.type].terminals.length;
  const isFullyWired = (c: ProcessComponent) => wiredCount(c) === terminalCount(c);

  return (
    <div className="col">
      <div className="toolbar">
        <h3 style={{ margin: 0 }}>Plant Simulation</h3>
        <span className="muted small">
          Drag a machine onto the canvas, then wire its terminals to the tags your program uses.
        </span>
        <span className="pill">
          <span className={`dot ${project.process.length ? 'on' : ''}`} />
          {project.process.filter(isFullyWired).length}/{project.process.length} wired
        </span>
      </div>

      <Guide title="How the plant simulation works">
        <ul className="bullets">
          <li>
            Drag a machine from <b>Components</b> onto the canvas, then drag it to reposition.
          </li>
          <li>
            Each terminal is <b>IN</b> (the program drives the machine, e.g. Motor_Cmd) or{' '}
            <b>OUT</b> (the machine feeds a tag your program reads, e.g. Motor_Running). A green dot
            means the terminal is wired.
          </li>
          <li>
            Bind every terminal so the simulation matches reality. Machines animate in 3D and react
            to the live tag values.
          </li>
          <li>Press Run (▶ in the header) to watch the plant respond to your logic.</li>
        </ul>
      </Guide>

      <div className="plant-layout">
        <div className="panel plant-palette">
          <h3>Components</h3>
          <div className="plant-palette-grid">
            {TYPE_LIST.map((def) => (
              <div
                key={def.type}
                className="plant-chip"
                draggable
                title={`Drag ${def.label} onto the canvas`}
                onDragStart={(e) => e.dataTransfer.setData('text/plant', def.type)}
                onClick={() => addComponent(def.type, 40, 40)}
              >
                <ProcessVisual comp={makeComponent(def.type, 0, 0, '', {}, def.defaults)} />
                <span>{def.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div
          className="canvas plant-canvas grow"
          ref={canvasRef}
          onDragOver={(e) => e.preventDefault()}
          onDrop={onCanvasDrop}
          onMouseMove={onCanvasMouseMove}
          onMouseUp={onCanvasMouseUp}
          onMouseLeave={onCanvasMouseUp}
          onClick={() => setSelected(null)}
        >
          {project.process.map((comp) => {
            const pos = dragging?.id === comp.id ? dragging : comp;
            const wired = isFullyWired(comp);
            return (
              <div
                key={comp.id}
                className={`canvas-item pv-card ${selected === comp.id ? 'selected' : ''} ${
                  wired ? 'wired' : 'unwired'
                }`}
                style={{ left: pos.x, top: pos.y, cursor: 'move' }}
                onMouseDown={(e) => onItemMouseDown(e, comp)}
              >
                <div className="pv-card-head">
                  <b className="small">{comp.label}</b>
                  <span
                    className={`pv-wire-badge ${wired ? 'ok' : ''}`}
                    title={`${wiredCount(comp)}/${terminalCount(comp)} terminals wired`}
                  >
                    {wired ? '● wired' : `○ ${wiredCount(comp)}/${terminalCount(comp)}`}
                  </span>
                </div>
                <ProcessVisual comp={comp} />
              </div>
            );
          })}
          {project.process.length === 0 && (
            <div className="empty-state" style={{ margin: 40 }}>
              Drop components here to build your process.
            </div>
          )}
        </div>

        {selectedComp && (
          <div className="panel plant-inspector">
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <h3 style={{ margin: 0 }}>Wiring</h3>
              <button className="danger" onClick={() => deleteComponent(selectedComp.id)}>
                <Icon name="trash" size={13} /> Delete
              </button>
            </div>
            <label className="col" style={{ gap: 3, marginTop: 8 }}>
              <span className="muted small">Label</span>
              <input
                value={selectedComp.label}
                onChange={(e) => updateComponent(selectedComp.id, (c) => (c.label = e.target.value))}
              />
            </label>

            <h3 style={{ marginTop: 12 }}>Terminals</h3>
            {PROCESS_DEFS[selectedComp.type].terminals.map((term) => (
              <TerminalRow
                key={term.key}
                term={term}
                value={selectedComp.bindings[term.key] ?? ''}
                connected={
                  Boolean(selectedComp.bindings[term.key]) &&
                  engine.db.readScalar(selectedComp.bindings[term.key]) !== undefined
                }
                onChange={(v) =>
                  updateComponent(selectedComp.id, (c) => {
                    if (v) c.bindings[term.key] = v;
                    else delete c.bindings[term.key];
                  })
                }
              />
            ))}

            <h3 style={{ marginTop: 12 }}>Parameters</h3>
            {Object.entries(PROCESS_DEFS[selectedComp.type].defaults).map(([key, defVal]) =>
              typeof defVal === 'number' ? (
                <label key={key} className="col" style={{ gap: 3, marginBottom: 6 }}>
                  <span className="muted small">{key}</span>
                  <input
                    type="number"
                    value={Number(selectedComp.props[key] ?? defVal)}
                    onChange={(e) =>
                      updateComponent(selectedComp.id, (c) => (c.props[key] = Number(e.target.value)))
                    }
                  />
                </label>
              ) : null,
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function TerminalRow({
  term,
  value,
  connected,
  onChange,
}: {
  term: TerminalDef;
  value: string;
  connected: boolean;
  onChange: (v: string) => void;
}) {
  return (
    <div className="terminal">
      <span
        className={`term-badge ${term.dir}`}
        title={term.dir === 'in' ? 'Program → Machine' : 'Machine → Program'}
      >
        {term.dir === 'in' ? 'IN' : 'OUT'}
      </span>
      <span className="muted small term-label">{term.label}</span>
      <TagInput value={value} onChange={onChange} width={120} placeholder="tag" />
      <span className={`term-dot ${connected ? 'on' : ''}`} title={connected ? 'Connected' : 'No tag'} />
    </div>
  );
}
