import { useRef, useState } from 'react';
import { useStore } from '../store/store';
import { useEngine, useScanCount } from '../store/hooks';
import { PROCESS_DEFS, type TerminalDef } from '../engine/process';
import type { ProcessComponent, ProcessType } from '../engine/model';
import { makeComponent } from '../engine/factory';
import { TagInput } from './TagInput';
import { Guide } from './Guide';

const TYPE_LIST = Object.values(PROCESS_DEFS);

export function PlantView() {
  const { project, applyEdit } = useStore();
  useScanCount();
  const canvasRef = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const dragRef = useRef<{ id: string; dx: number; dy: number } | null>(null);
  const [dragging, setDragging] = useState<{ id: string; x: number; y: number } | null>(null);

  function addComponent(type: ProcessType, x: number, y: number) {
    const def = PROCESS_DEFS[type];
    const comp = makeComponent(type, x, y, `${def.label} ${project.process.filter((c) => c.type === type).length + 1}`, {}, { ...def.defaults });
    applyEdit((p) => {
      p.process.push(comp);
    }, 'content');
    setSelected(comp.id);
  }

  function updateComponent(id: string, fn: (c: ProcessComponent) => void, kind: 'content' | 'structure' = 'content') {
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

  return (
    <div className="col">
      <div className="toolbar">
        <h3 style={{ margin: 0 }}>Plant Simulation</h3>
        <span className="muted small">Drag a component onto the canvas, then wire its terminals to tags.</span>
      </div>

      <Guide title="How the plant simulation works">
        <ul className="bullets">
          <li>
            Drag a machine from <b>Components</b> onto the canvas (or click to place it), then drag
            the item to move it.
          </li>
          <li>
            Select a component to open the <b>Wiring</b> panel. Each terminal is either <b>IN</b>{' '}
            (PLC drives the machine, e.g. Motor_Cmd) or <b>OUT</b> (the machine drives a tag the PLC
            reads, e.g. Motor_Running).
          </li>
          <li>
            Bind terminals to tags from your Tag Database or I/O config. The machine then behaves
            physically — the motor ramps up, the tank fills and drains, the heater warms up.
          </li>
          <li>
            <b>Parameters</b> tune the behaviour (speed, rates, delays). The <b>Sensor</b> component
            has a slider so you can inject a value like temperature or level.
          </li>
          <li>Run the PLC (▶ in the header) to see everything animate live.</li>
        </ul>
      </Guide>

      <div className="flex" style={{ alignItems: 'flex-start' }}>
        <div className="panel" style={{ width: 220 }}>
          <h3>Components</h3>
          <div className="row">
            {TYPE_LIST.map((def) => (
              <div
                key={def.type}
                className="chip"
                draggable
                title={`Drag ${def.label} onto the canvas`}
                onDragStart={(e) => e.dataTransfer.setData('text/plant', def.type)}
                onClick={() => addComponent(def.type, 40, 40)}
              >
                {def.label}
              </div>
            ))}
          </div>
          <div className="muted small" style={{ marginTop: 8 }}>
            Click to place at top-left, or drag onto the canvas.
          </div>
        </div>

        <div
          className="canvas grow"
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
            return (
              <div
                key={comp.id}
                className={`canvas-item ${selected === comp.id ? 'selected' : ''}`}
                style={{ left: pos.x, top: pos.y, cursor: 'move' }}
                onMouseDown={(e) => onItemMouseDown(e, comp)}
              >
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <b className="small">{comp.label}</b>
                  <span className="badge">{PROCESS_DEFS[comp.type].label}</span>
                </div>
                <ComponentVisual comp={comp} />
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
          <div className="panel" style={{ width: 320 }}>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <h3 style={{ margin: 0 }}>Wiring</h3>
              <button className="danger" onClick={() => deleteComponent(selectedComp.id)}>
                Delete
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
  onChange,
}: {
  term: TerminalDef;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="terminal">
      <span
        className="badge"
        style={{ minWidth: 30, textAlign: 'center', background: term.dir === 'in' ? '#1c3b57' : '#2d3b23' }}
        title={term.dir === 'in' ? 'PLC → Component' : 'Component → PLC'}
      >
        {term.dir === 'in' ? 'IN' : 'OUT'}
      </span>
      <span className="muted small" style={{ width: 96 }}>
        {term.label}
      </span>
      <TagInput value={value} onChange={onChange} width={130} placeholder="tag" />
    </div>
  );
}

function ComponentVisual({ comp }: { comp: ProcessComponent }) {
  const engine = useEngine();
  useScanCount();
  const state = engine.getProcessState(comp.id) ?? {};
  const read = (key: string) => {
    const ref = comp.bindings[key];
    return ref ? engine.db.readScalar(ref) : undefined;
  };
  const bool = (key: string) => read(key) === true;
  const num = (key: string) => {
    const v = read(key);
    return typeof v === 'number' ? v : 0;
  };

  switch (comp.type) {
    case 'motor': {
      const running = bool('run');
      const rpm = num('speed');
      return (
        <div className="row" style={{ gap: 8 }}>
          <span className={`lamp ${running ? 'on' : ''}`} />
          <span className="mono small">{rpm.toFixed(0)} RPM</span>
          <span
            style={{
              display: 'inline-block',
              animation: running ? 'spin 1s linear infinite' : 'none',
              fontSize: 16,
            }}
          >
            ⚙
          </span>
        </div>
      );
    }
    case 'conveyor': {
      const moving = bool('run');
      return (
        <div className="row">
          <span className="mono small" style={{ letterSpacing: 2 }}>
            {moving ? '▶▶▶▶▶' : '▷▷▷▷▷'}
          </span>
          <span className="badge">box={bool('boxSensor') ? 1 : 0}</span>
        </div>
      );
    }
    case 'tank': {
      const level = num('level');
      const color = bool('high') ? 'var(--red)' : bool('low') ? 'var(--amber)' : '#2b7fbf';
      return (
        <div className="row">
          <div
            style={{
              width: 34,
              height: 56,
              border: '2px solid var(--border)',
              borderRadius: 3,
              display: 'flex',
              alignItems: 'flex-end',
              background: '#0b0f14',
              overflow: 'hidden',
            }}
          >
            <div style={{ width: '100%', height: `${level}%`, background: color }} />
          </div>
          <div className="col" style={{ gap: 2 }}>
            <span className="mono small">{level.toFixed(0)}%</span>
            {bool('high') && <span className="badge" style={{ color: 'var(--red)' }}>HIGH</span>}
            {bool('low') && <span className="badge" style={{ color: 'var(--amber)' }}>LOW</span>}
          </div>
        </div>
      );
    }
    case 'valve': {
      const opened = bool('opened');
      const closed = bool('closed');
      const color = opened ? 'var(--green)' : closed ? 'var(--red)' : 'var(--amber)';
      return (
        <div className="row">
          <span className="mono" style={{ color, fontSize: 18 }}>
            {opened ? '◀▶' : closed ? '▶◀' : '◆'}
          </span>
          <span className="mono small">{opened ? 'OPEN' : closed ? 'CLOSED' : 'MOVING'}</span>
        </div>
      );
    }
    case 'pump': {
      const running = bool('running');
      return (
        <div className="row">
          <span
            style={{ display: 'inline-block', animation: running ? 'spin 0.7s linear infinite' : 'none' }}
          >
            ✳
          </span>
          <span className="mono small">{num('flow').toFixed(1)} L/s</span>
        </div>
      );
    }
    case 'trafficLight': {
      return (
        <div className="col" style={{ gap: 3, alignItems: 'center' }}>
          <span className={`lamp red ${bool('red') ? 'on' : ''}`} />
          <span className={`lamp amber ${bool('yellow') ? 'on' : ''}`} />
          <span className={`lamp ${bool('green') ? 'on' : ''}`} />
        </div>
      );
    }
    case 'heater': {
      return (
        <div className="row">
          <span className={`lamp red ${bool('heaterOn') ? 'on' : ''}`} />
          <span className="mono small">{num('temp').toFixed(1)} °C</span>
        </div>
      );
    }
    case 'fan': {
      const running = bool('running');
      return (
        <div className="row">
          <span style={{ display: 'inline-block', animation: running ? 'spin 0.6s linear infinite' : 'none' }}>
            ✤
          </span>
          <span className="mono small">{num('airflow').toFixed(0)} CFM</span>
        </div>
      );
    }
    case 'sensor': {
      const min = Number(comp.props.min ?? 0);
      const max = Number(comp.props.max ?? 100);
      const val = Number(state.value ?? 0);
      return (
        <label className="row" style={{ gap: 6 }}>
          <input
            type="range"
            min={min}
            max={max}
            value={val}
            onChange={(e) => engine.setProcessValue(comp.id, 'value', Number(e.target.value))}
            style={{ width: 110 }}
          />
          <span className="mono small">{val}</span>
        </label>
      );
    }
    case 'counter': {
      return <span className="mono" style={{ fontSize: 20, color: 'var(--amber)' }}>{num('value').toFixed(0)}</span>;
    }
  }
}
