import { useEffect, useRef, useState } from 'react';
import { useStore } from '../store/store';
import { useScanCount, useTagValue } from '../store/hooks';
import type { HmiWidget, HmiWidgetType } from '../engine/model';
import { makeWidget } from '../engine/factory';
import { TagInput, useTagNames } from './TagInput';
import { Guide } from './Guide';
import { Icon } from './icons';

interface WidgetDef {
  type: HmiWidgetType;
  label: string;
  hint: string;
  w: number;
  h: number;
  needsNum: boolean;
}

const WIDGETS: WidgetDef[] = [
  { type: 'indicator', label: 'Indicator', hint: 'BOOL lamp', w: 100, h: 76, needsNum: false },
  { type: 'button', label: 'Momentary', hint: 'Press-and-hold', w: 120, h: 76, needsNum: false },
  { type: 'switch', label: 'Switch', hint: 'Toggle BOOL', w: 120, h: 76, needsNum: false },
  { type: 'numeric', label: 'Numeric', hint: 'Read a value', w: 130, h: 76, needsNum: true },
  { type: 'gauge', label: 'Gauge', hint: 'Dial display', w: 130, h: 100, needsNum: true },
  { type: 'bar', label: 'Bar', hint: 'Level bar', w: 150, h: 80, needsNum: true },
  { type: 'trend', label: 'Trend', hint: 'Live chart', w: 220, h: 130, needsNum: true },
  { type: 'label', label: 'Label', hint: 'Static text', w: 130, h: 48, needsNum: false },
];

export function HmiView() {
  const { project, applyEdit } = useStore();
  const canvasRef = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const dragRef = useRef<{ id: string; dx: number; dy: number } | null>(null);
  const [dragging, setDragging] = useState<{ id: string; x: number; y: number } | null>(null);
  const [snap, setSnap] = useState(true);
  const tagNames = useTagNames();

  function addWidget(type: HmiWidgetType, x: number, y: number) {
    const def = WIDGETS.find((d) => d.type === type)!;
    const w = makeWidget(type, x, y, def.label === 'Momentary' ? 'Start' : def.label);
    w.w = def.w;
    w.h = def.h;
    if (def.needsNum) {
      w.props.min = 0;
      w.props.max = 100;
    }
    applyEdit((p) => {
      p.hmi.push(w);
    }, 'content');
    setSelected(w.id);
  }

  function updateWidget(id: string, fn: (w: HmiWidget) => void) {
    applyEdit((p) => {
      const w = p.hmi.find((x) => x.id === id);
      if (w) fn(w);
    }, 'content');
  }

  function snapVal(v: number) {
    return snap ? Math.round(v / 10) * 10 : Math.round(v);
  }

  function onCanvasDrop(e: React.DragEvent) {
    e.preventDefault();
    const type = e.dataTransfer.getData('text/hmi') as HmiWidgetType;
    if (!type) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    addWidget(
      type,
      snapVal(Math.max(0, e.clientX - (rect?.left ?? 0) - 40)),
      snapVal(Math.max(0, e.clientY - (rect?.top ?? 0) - 20)),
    );
  }

  function onItemMouseDown(e: React.MouseEvent, w: HmiWidget) {
    e.stopPropagation();
    const rect = canvasRef.current?.getBoundingClientRect();
    dragRef.current = { id: w.id, dx: e.clientX - (rect?.left ?? 0) - w.x, dy: e.clientY - (rect?.top ?? 0) - w.y };
    setSelected(w.id);
  }

  function onCanvasMouseMove(e: React.MouseEvent) {
    const drag = dragRef.current;
    if (!drag) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    setDragging({
      id: drag.id,
      x: Math.max(0, e.clientX - (rect?.left ?? 0) - drag.dx),
      y: Math.max(0, e.clientY - (rect?.top ?? 0) - drag.dy),
    });
  }

  function onCanvasMouseUp() {
    const drag = dragRef.current;
    const pos = dragging;
    dragRef.current = null;
    if (drag && pos) {
      updateWidget(drag.id, (w) => {
        w.x = snapVal(pos.x);
        w.y = snapVal(pos.y);
      });
    }
    setDragging(null);
  }

  const selectedWidget = project.hmi.find((w) => w.id === selected);

  return (
    <div className="col">
      <div className="toolbar">
        <h3 style={{ margin: 0 }}>HMI / SCADA Dashboard</h3>
        <label className="pill" title="Snap widgets to a 10px grid">
          <input type="checkbox" checked={snap} onChange={(e) => setSnap(e.target.checked)} />
          Snap to grid
        </label>
        <span className="pill">
          <span className={`dot ${project.hmi.length ? 'on' : ''}`} />
          {project.hmi.length} widgets
        </span>
        <span className="muted small">Drag a widget onto the screen, then tag it.</span>
      </div>

      <Guide title="How the HMI works">
        <ul className="bullets">
          <li>
            Drag a <b>widget</b> from the library onto the screen. Select it to edit its label, tag
            binding, size and range.
          </li>
          <li>
            <b>Indicator</b> shows a BOOL as a lamp. <b>Momentary</b> forces a tag true while held;{' '}
            <b>Switch</b> toggles it — ideal for Start/Stop.
          </li>
          <li>
            <b>Numeric</b>, <b>Gauge</b> and <b>Bar</b> display numbers; set their <b>min/max</b> in
            the inspector. <b>Trend</b> charts the value live.
          </li>
          <li>
            Use the <b>Tag list</b> on the right to click a tag straight onto the selected widget.
          </li>
        </ul>
      </Guide>

      <div className="hmi-layout">
        <div className="panel hmi-library">
          <h3>Widget Library</h3>
          <div className="hmi-lib-grid">
            {WIDGETS.map((d) => (
              <div
                key={d.type}
                className="hmi-lib-chip"
                draggable
                title={`Drag ${d.label} — ${d.hint}`}
                onDragStart={(e) => e.dataTransfer.setData('text/hmi', d.type)}
                onClick={() => addWidget(d.type, 40, 40)}
              >
                <div className="hmi-lib-preview">
                  <HmiWidgetVisual widget={makeWidget(d.type, 0, 0, d.label)} preview />
                </div>
                <span className="hmi-lib-name">{d.label}</span>
                <span className="hmi-lib-hint muted small">{d.hint}</span>
              </div>
            ))}
          </div>
        </div>

        <div
          className={`canvas hmi-canvas grow ${snap ? 'grid-snap' : ''}`}
          ref={canvasRef}
          onDragOver={(e) => e.preventDefault()}
          onDrop={onCanvasDrop}
          onMouseMove={onCanvasMouseMove}
          onMouseUp={onCanvasMouseUp}
          onMouseLeave={onCanvasMouseUp}
          onClick={() => setSelected(null)}
        >
          {project.hmi.map((w) => {
            const pos = dragging?.id === w.id ? dragging : w;
            return (
              <div
                key={w.id}
                className={`hmi-widget ${selected === w.id ? 'selected' : ''}`}
                style={{ left: pos.x, top: pos.y, width: w.w, height: w.h, cursor: 'move' }}
                onMouseDown={(e) => onItemMouseDown(e, w)}
              >
                <span className="label">{w.label}</span>
                <HmiWidgetVisual widget={w} />
              </div>
            );
          })}
          {project.hmi.length === 0 && (
            <div className="empty-state" style={{ margin: 40 }}>
              Drag widgets from the library to build an operator screen.
            </div>
          )}
        </div>

        <div className="panel hmi-inspector">
          <div className="hmi-taglist">
            <h3>Tag list</h3>
            <span className="muted small">
              {selectedWidget
                ? 'Click a tag to bind it to the selected widget.'
                : 'Select a widget on the canvas, then click a tag to bind it.'}
            </span>
            <div className="hmi-tag-rows">
              {tagNames.map((name) => (
                <button
                  key={name}
                  className="hmi-tag-row"
                  disabled={!selectedWidget}
                  onClick={() => {
                    if (selectedWidget) updateWidget(selectedWidget.id, (w) => (w.binding = name));
                  }}
                >
                  <span className="mono">{name}</span>
                  <TagLive name={name} />
                </button>
              ))}
              {tagNames.length === 0 && (
                <div className="muted small">No tags yet — create some in the Tag Database.</div>
              )}
            </div>
          </div>

          {selectedWidget && (
            <div className="hmi-widget-editor">
              <div className="row" style={{ justifyContent: 'space-between', marginTop: 14 }}>
                <h3 style={{ margin: 0 }}>Widget</h3>
                <button
                  className="danger"
                  onClick={() => {
                    const id = selectedWidget.id;
                    applyEdit((p) => {
                      p.hmi = p.hmi.filter((x) => x.id !== id);
                    }, 'content');
                    setSelected(null);
                  }}
                >
                  <Icon name="trash" size={13} /> Delete
                </button>
              </div>

              <label className="col" style={{ gap: 3, marginTop: 8 }}>
                <span className="muted small">Label</span>
                <input
                  value={selectedWidget.label}
                  onChange={(e) => updateWidget(selectedWidget.id, (w) => (w.label = e.target.value))}
                />
              </label>

              <label className="col" style={{ gap: 3, marginTop: 8 }}>
                <span className="muted small">Tag binding</span>
                <TagInput
                  value={selectedWidget.binding ?? ''}
                  onChange={(v) => updateWidget(selectedWidget.id, (w) => (w.binding = v))}
                  width={180}
                />
              </label>

              <div className="row" style={{ gap: 8, marginTop: 8 }}>
                <label className="pill">
                  W
                  <input
                    type="number"
                    style={{ width: 56 }}
                    value={selectedWidget.w}
                    onChange={(e) => updateWidget(selectedWidget.id, (w) => (w.w = Number(e.target.value)))}
                  />
                </label>
                <label className="pill">
                  H
                  <input
                    type="number"
                    style={{ width: 56 }}
                    value={selectedWidget.h}
                    onChange={(e) => updateWidget(selectedWidget.id, (w) => (w.h = Number(e.target.value)))}
                  />
                </label>
              </div>

              {['gauge', 'bar', 'trend'].includes(selectedWidget.type) && (
                <div className="row" style={{ gap: 8, marginTop: 8 }}>
                  <label className="pill">
                    Min
                    <input
                      type="number"
                      style={{ width: 56 }}
                      value={Number(selectedWidget.props.min ?? 0)}
                      onChange={(e) => updateWidget(selectedWidget.id, (w) => (w.props.min = Number(e.target.value)))}
                    />
                  </label>
                  <label className="pill">
                    Max
                    <input
                      type="number"
                      style={{ width: 56 }}
                      value={Number(selectedWidget.props.max ?? 100)}
                      onChange={(e) => updateWidget(selectedWidget.id, (w) => (w.props.max = Number(e.target.value)))}
                    />
                  </label>
                </div>
              )}

              {['indicator', 'button', 'switch'].includes(selectedWidget.type) && (
                <div className="row" style={{ gap: 8, marginTop: 8 }}>
                  <span className="muted small">Colour</span>
                  {['green', 'red', 'amber'].map((c) => (
                    <button
                      key={c}
                      className={`color-swatch ${c} ${
                        String(selectedWidget.props.color ?? 'green') === c ? 'active' : ''
                      }`}
                      title={c}
                      onClick={() => updateWidget(selectedWidget.id, (w) => (w.props.color = c))}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TagLive({ name }: { name: string }) {
  const v = useTagValue(name);
  return (
    <span className="tag-value">
      {v === undefined ? '--' : typeof v === 'boolean' ? (v ? '1' : '0') : v}
    </span>
  );
}

function HmiWidgetVisual({ widget, preview }: { widget: HmiWidget; preview?: boolean }) {
  const { engine } = useStore();
  useScanCount();
  const value = useTagValue(preview ? undefined : widget.binding);
  const on = value === true;

  switch (widget.type) {
    case 'indicator': {
      const color = String(widget.props.color ?? 'green');
      return <span className={`lamp large ${color} ${on ? 'on' : ''}`} />;
    }
    case 'button':
    case 'switch':
      if (preview) return <span className={`hmi-preview-btn ${widget.type}`} />;
      return widget.type === 'button' ? (
        <button
          className={`hmi-btn ${on ? 'active' : ''}`}
          onMouseDown={(e) => {
            e.stopPropagation();
            if (widget.binding) engine.db.writeScalar(widget.binding, true);
          }}
          onMouseUp={(e) => {
            e.stopPropagation();
            if (widget.binding) engine.db.writeScalar(widget.binding, false);
          }}
        >
          PRESS
        </button>
      ) : (
        <button
          className={`hmi-btn ${on ? 'active' : ''}`}
          onClick={(e) => {
            e.stopPropagation();
            if (widget.binding) engine.db.writeScalar(widget.binding, !on);
          }}
        >
          {on ? 'ON' : 'OFF'}
        </button>
      );
    case 'numeric':
      return (
        <span className="value">
          {typeof value === 'number' ? value.toFixed(1) : on ? '1' : value === undefined ? '--' : '0'}
        </span>
      );
    case 'gauge': {
      const v = typeof value === 'number' ? value : 0;
      const min = Number(widget.props.min ?? 0);
      const max = Number(widget.props.max ?? 100);
      const angle = -90 + 180 * Math.max(0, Math.min(1, (v - min) / (max - min || 1)));
      return (
        <div className="gauge">
          <div className="gauge-ticks" />
          <div className="needle" style={{ transform: `rotate(${angle}deg)` }} />
          <span className="gauge-value mono">{v.toFixed(0)}</span>
        </div>
      );
    }
    case 'bar': {
      const v = typeof value === 'number' ? value : 0;
      const min = Number(widget.props.min ?? 0);
      const max = Number(widget.props.max ?? 100);
      const pct = Math.max(0, Math.min(100, ((v - min) / (max - min || 1)) * 100));
      return (
        <div className="hmi-bar">
          <div className="hmi-bar-fill" style={{ width: `${pct}%` }} />
        </div>
      );
    }
    case 'trend':
      return <Trend value={typeof value === 'number' ? value : on ? 1 : 0} preview={preview} />;
    case 'label':
      return <span className="hmi-static">{widget.label}</span>;
  }
}

function Trend({ value, preview }: { value: number; preview?: boolean }) {
  const scan = useScanCount();
  const dataRef = useRef<number[]>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lastScan = useRef(-1);

  useEffect(() => {
    if (preview) return;
    if (lastScan.current === scan) return;
    lastScan.current = scan;
    dataRef.current.push(value);
    if (dataRef.current.length > 120) dataRef.current.shift();
  }, [scan, value, preview]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let ctx: CanvasRenderingContext2D | null = null;
    try {
      ctx = canvas.getContext('2d');
    } catch {
      return; // canvas unavailable (e.g. headless test environment)
    }
    if (!ctx) return;
    const w = (canvas.width = canvas.clientWidth || 160);
    const h = (canvas.height = canvas.clientHeight || 60);
    ctx.clearRect(0, 0, w, h);
    ctx.strokeStyle = '#22303f';
    ctx.beginPath();
    ctx.moveTo(0, h / 2);
    ctx.lineTo(w, h / 2);
    ctx.stroke();
    const data = dataRef.current;
    if (data.length < 2) return;
    let min = Math.min(...data);
    let max = Math.max(...data);
    if (max - min < 1e-6) {
      max += 1;
      min -= 1;
    }
    ctx.strokeStyle = '#3ea6ff';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    const step = w / Math.max(1, data.length - 1);
    data.forEach((d, i) => {
      const x = i * step;
      const y = h - ((d - min) / (max - min)) * (h - 6) - 3;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
  });

  return <canvas className="trend-canvas" ref={canvasRef} />;
}
