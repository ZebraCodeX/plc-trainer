import { useEffect, useRef, useState } from 'react';
import { useStore } from '../store/store';
import { useScanCount, useTagValue } from '../store/hooks';
import type { HmiWidget, HmiWidgetType } from '../engine/model';
import { makeWidget } from '../engine/factory';
import { TagInput } from './TagInput';

const WIDGET_TYPES: { type: HmiWidgetType; label: string }[] = [
  { type: 'indicator', label: 'Indicator' },
  { type: 'button', label: 'Momentary Button' },
  { type: 'switch', label: 'Switch' },
  { type: 'numeric', label: 'Numeric Display' },
  { type: 'gauge', label: 'Gauge' },
  { type: 'bar', label: 'Bar' },
  { type: 'trend', label: 'Trend Chart' },
  { type: 'label', label: 'Label' },
];

export function HmiView() {
  const { project, applyEdit } = useStore();
  const canvasRef = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const dragRef = useRef<{ id: string; dx: number; dy: number } | null>(null);
  const [dragging, setDragging] = useState<{ id: string; x: number; y: number } | null>(null);

  function addWidget(type: HmiWidgetType, x: number, y: number) {
    const w = makeWidget(type, x, y, type === 'label' ? 'Label' : type);
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

  function onCanvasDrop(e: React.DragEvent) {
    e.preventDefault();
    const type = e.dataTransfer.getData('text/hmi') as HmiWidgetType;
    if (!type) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    addWidget(type, Math.max(0, e.clientX - (rect?.left ?? 0) - 40), Math.max(0, e.clientY - (rect?.top ?? 0) - 20));
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
        w.x = Math.round(pos.x);
        w.y = Math.round(pos.y);
      });
    }
    setDragging(null);
  }

  const selectedWidget = project.hmi.find((w) => w.id === selected);

  return (
    <div className="col">
      <div className="toolbar">
        <h3 style={{ margin: 0 }}>HMI / SCADA Dashboard</h3>
        <span className="muted small">Drag widgets onto the screen and bind them to tags.</span>
      </div>
      <div className="flex" style={{ alignItems: 'flex-start' }}>
        <div className="panel" style={{ width: 200 }}>
          <h3>Widgets</h3>
          <div className="row">
            {WIDGET_TYPES.map((w) => (
              <div
                key={w.type}
                className="chip"
                draggable
                onDragStart={(e) => e.dataTransfer.setData('text/hmi', w.type)}
                onClick={() => addWidget(w.type, 40, 40)}
              >
                {w.label}
              </div>
            ))}
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
              Drop widgets here to build an operator screen.
            </div>
          )}
        </div>

        {selectedWidget && (
          <div className="panel" style={{ width: 300 }}>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <h3 style={{ margin: 0 }}>Widget</h3>
              <button
                className="danger"
                onClick={() => {
                  applyEdit((p) => {
                    p.hmi = p.hmi.filter((x) => x.id !== selectedWidget.id);
                  }, 'content');
                  setSelected(null);
                }}
              >
                Delete
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
                width={200}
              />
            </label>
            <div className="row" style={{ gap: 8, marginTop: 8 }}>
              <label className="pill">
                W
                <input
                  type="number"
                  style={{ width: 60 }}
                  value={selectedWidget.w}
                  onChange={(e) => updateWidget(selectedWidget.id, (w) => (w.w = Number(e.target.value)))}
                />
              </label>
              <label className="pill">
                H
                <input
                  type="number"
                  style={{ width: 60 }}
                  value={selectedWidget.h}
                  onChange={(e) => updateWidget(selectedWidget.id, (w) => (w.h = Number(e.target.value)))}
                />
              </label>
              <label className="pill">
                Color
                <select
                  value={String(selectedWidget.props.color ?? 'green')}
                  onChange={(e) => updateWidget(selectedWidget.id, (w) => (w.props.color = e.target.value))}
                >
                  <option value="green">green</option>
                  <option value="red">red</option>
                  <option value="amber">amber</option>
                </select>
              </label>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function HmiWidgetVisual({ widget }: { widget: HmiWidget }) {
  const { engine } = useStore();
  useScanCount();
  const value = useTagValue(widget.binding);
  const on = value === true;

  switch (widget.type) {
    case 'indicator': {
      const color = String(widget.props.color ?? 'green');
      return <span className={`lamp ${color} ${on ? 'on' : ''}`} />;
    }
    case 'button':
      return (
        <button
          className={on ? 'primary' : ''}
          onMouseDown={(e) => {
            e.stopPropagation();
            if (widget.binding) engine.db.writeScalar(widget.binding, true);
          }}
          onMouseUp={(e) => {
            e.stopPropagation();
            if (widget.binding) engine.db.writeScalar(widget.binding, false);
          }}
        >
          {widget.label}
        </button>
      );
    case 'switch':
      return (
        <button
          className={on ? 'primary' : ''}
          onClick={(e) => {
            e.stopPropagation();
            if (widget.binding) engine.db.writeScalar(widget.binding, !on);
          }}
        >
          {on ? 'ON' : 'OFF'}
        </button>
      );
    case 'numeric':
      return <span className="value">{typeof value === 'number' ? value.toFixed(1) : on ? '1' : value === undefined ? '--' : '0'}</span>;
    case 'gauge': {
      const v = typeof value === 'number' ? value : 0;
      const min = Number(widget.props.min ?? 0);
      const max = Number(widget.props.max ?? 100);
      const angle = -90 + 180 * Math.max(0, Math.min(1, (v - min) / (max - min || 1)));
      return (
        <div className="gauge">
          <div className="needle" style={{ transform: `rotate(${angle}deg)` }} />
          <span className="value" style={{ position: 'absolute', bottom: 2, width: '100%', textAlign: 'center', fontSize: 12 }}>
            {v.toFixed(0)}
          </span>
        </div>
      );
    }
    case 'bar': {
      const v = typeof value === 'number' ? value : 0;
      const min = Number(widget.props.min ?? 0);
      const max = Number(widget.props.max ?? 100);
      const pct = Math.max(0, Math.min(100, ((v - min) / (max - min || 1)) * 100));
      return (
        <div style={{ width: '90%', height: 12, background: '#0b0f14', borderRadius: 6, marginTop: 6 }}>
          <div style={{ width: `${pct}%`, height: '100%', background: 'var(--accent)', borderRadius: 6 }} />
        </div>
      );
    }
    case 'trend':
      return <Trend value={typeof value === 'number' ? value : on ? 1 : 0} />;
    case 'label':
      return <span className="small">{widget.label}</span>;
  }
}

function Trend({ value }: { value: number }) {
  const scan = useScanCount();
  const dataRef = useRef<number[]>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lastScan = useRef(-1);

  useEffect(() => {
    if (lastScan.current === scan) return;
    lastScan.current = scan;
    dataRef.current.push(value);
    if (dataRef.current.length > 120) dataRef.current.shift();
  }, [scan, value]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const w = (canvas.width = canvas.clientWidth || 160);
    const h = (canvas.height = 80);
    ctx.clearRect(0, 0, w, h);
    ctx.strokeStyle = '#2c3848';
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
