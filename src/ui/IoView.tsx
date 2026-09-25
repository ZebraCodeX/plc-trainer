import { useMemo } from 'react';
import { useStore } from '../store/store';
import { useEngine, useScanCount } from '../store/hooks';
import { MODULE_CATALOG, getCatalog, makeModule, scaleEngToRaw } from '../engine/io';
import { makeTag } from '../engine/factory';
import type { DataType } from '../engine/types';
import type { IoModule, ModuleKind, Project } from '../engine/model';
import { EditableTagValue } from './TagInput';
import { Guide } from './Guide';
import { Icon } from './icons';
import type { PlcEngine } from '../engine/engine';

function dataTypeForKind(kind: ModuleKind): DataType {
  return kind === 'DI' || kind === 'DO' ? 'BOOL' : 'REAL';
}

/** Collect every tag name the program's ladder/ST logic references. */
function collectUsedTags(project: Project): Set<string> {
  const used = new Set<string>();
  const re = /[A-Za-z_][A-Za-z0-9_]*(?:\[[A-Za-z0-9_]+\])?(?:\.[A-Za-z]+)?/g;
  const add = (text: string) => {
    for (const m of text.match(re) ?? []) {
      const base = m.split(/[[.]/)[0];
      used.add(base.toUpperCase());
    }
  };
  for (const program of project.programs) {
    for (const routine of program.routines) {
      if (routine.type === 'st') add(routine.stSource);
      for (const rung of routine.rungs) {
        const walk = (b: { items: any[] }) => {
          for (const item of b.items) {
            if (item.type === 'group') (item.branches ?? []).forEach(walk);
            else (item.operands ?? []).forEach((o: string) => add(o));
          }
        };
        walk(rung.condition);
        for (const o of rung.outputs) o.operands.forEach((x) => add(x));
      }
    }
  }
  return used;
}

export function IoView() {
  const { project, applyEdit } = useStore();
  const engine = useEngine();
  useScanCount();

  const modules = [...project.io.modules].sort((a, b) => a.slot - b.slot);
  const usedTags = useMemo(() => collectUsedTags(project), [project]);

  function addModule(catalog: string) {
    const slot = modules.length ? Math.max(...modules.map((m) => m.slot)) + 1 : 1;
    const mod = makeModule(catalog, slot);
    applyEdit((p) => {
      p.io.modules.push(mod);
      const dt = dataTypeForKind(mod.kind);
      for (const ch of mod.channels) {
        if (!p.tags.some((t) => t.name === ch.tagName)) {
          p.tags.push(
            makeTag(ch.tagName, dt, { description: `${mod.catalog} slot ${mod.slot} ch ${ch.channel}` }),
          );
        }
      }
    }, 'structure');
  }

  function removeModule(id: string) {
    applyEdit((p) => {
      p.io.modules = p.io.modules.filter((m) => m.id !== id);
    }, 'structure');
  }

  function updateModule(id: string, patch: Partial<IoModule>) {
    applyEdit((p) => {
      const m = p.io.modules.find((x) => x.id === id);
      if (m) Object.assign(m, patch);
    }, patch.slot !== undefined ? 'structure' : 'content');
  }

  function renameChannel(moduleId: string, channel: number, name: string) {
    applyEdit((p) => {
      const m = p.io.modules.find((x) => x.id === moduleId);
      if (!m) return;
      const ch = m.channels.find((c) => c.channel === channel);
      if (!ch) return;
      const old = ch.tagName;
      ch.tagName = name;
      const tag = p.tags.find((t) => t.name === old);
      if (tag) tag.name = name;
    }, 'structure');
  }

  const inputModules = modules.filter((m) => m.kind === 'DI' || m.kind === 'AI');
  const outputModules = modules.filter((m) => m.kind === 'DO' || m.kind === 'AO');

  return (
    <div className="col">
      <Guide title="How I/O configuration works" defaultOpen>
        <ul className="bullets">
          <li>
            A real PLC has a <b>chassis</b> with cards in numbered <b>slots</b>. Add modules with the
            buttons above — each creates BOOL (digital) or REAL (analog) tags automatically.
          </li>
          <li>
            Rename any channel to a tag your program uses (e.g. <span className="mono">Start_PB</span>).
            The <b>Program</b> column shows whether the running logic reads or drives it.
          </li>
          <li>
            <b>Inputs</b> (DI / AI) are things you change by hand: click a digital input to toggle it,
            or drag an analog slider. <b>Outputs</b> (DO / AO) show what the program is driving — you
            can also <b>force</b> them for testing.
          </li>
          <li>
            Press <b>Run</b> in the header so the scan updates the outputs live.
          </li>
        </ul>
      </Guide>

      <div className="io-layout">
        <div className="panel">
          <h3>Chassis I/O Configuration</h3>
          <div className="toolbar">
            {MODULE_CATALOG.map((c) => (
              <button key={c.catalog} onClick={() => addModule(c.catalog)} title={c.description}>
                + {c.catalog}
              </button>
            ))}
          </div>
          {modules.length === 0 && (
            <div className="empty-state">
              No modules configured. Add a module to create I/O tags automatically.
            </div>
          )}
          {modules.map((m) => {
            const entry = getCatalog(m.catalog);
            return (
              <div key={m.id} className="panel io-module">
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <div className="row">
                    <span className={`badge mod ${m.kind}`}>{m.catalog}</span>
                    <span className="muted small">{entry?.description}</span>
                    <label className="pill">
                      Slot
                      <input
                        type="number"
                        min={0}
                        max={16}
                        style={{ width: 48 }}
                        value={m.slot}
                        onChange={(e) => updateModule(m.id, { slot: Number(e.target.value) })}
                      />
                    </label>
                  </div>
                  <button className="danger" onClick={() => removeModule(m.id)}>
                    <Icon name="trash" size={13} /> Remove
                  </button>
                </div>

                {(m.kind === 'AI' || m.kind === 'AO') && (
                  <div className="row small" style={{ marginTop: 6 }}>
                    <span className="muted">Scaling:</span>
                    <label className="pill">
                      Raw
                      <input
                        type="number"
                        style={{ width: 70 }}
                        value={m.rawMin}
                        onChange={(e) => updateModule(m.id, { rawMin: Number(e.target.value) })}
                      />
                      <input
                        type="number"
                        style={{ width: 70 }}
                        value={m.rawMax}
                        onChange={(e) => updateModule(m.id, { rawMax: Number(e.target.value) })}
                      />
                    </label>
                    <label className="pill">
                      Eng
                      <input
                        type="number"
                        style={{ width: 70 }}
                        value={m.engMin}
                        onChange={(e) => updateModule(m.id, { engMin: Number(e.target.value) })}
                      />
                      <input
                        type="number"
                        style={{ width: 70 }}
                        value={m.engMax}
                        onChange={(e) => updateModule(m.id, { engMax: Number(e.target.value) })}
                      />
                    </label>
                  </div>
                )}

                <table className="io-table" style={{ marginTop: 8 }}>
                  <thead>
                    <tr>
                      <th>Ch</th>
                      <th>Tag</th>
                      <th>Program</th>
                      <th>Live</th>
                      <th>Test</th>
                    </tr>
                  </thead>
                  <tbody>
                    {m.channels.map((ch) => {
                      const tag = project.tags.find((t) => t.name === ch.tagName);
                      const used = usedTags.has(ch.tagName.toUpperCase());
                      return (
                        <tr key={ch.channel} className={used ? 'used' : ''}>
                          <td className="mono">{ch.channel}</td>
                          <td>
                            <input
                              className="mono"
                              style={{ width: 150 }}
                              value={ch.tagName}
                              onChange={(e) => renameChannel(m.id, ch.channel, e.target.value)}
                            />
                          </td>
                          <td>
                            {used ? (
                              <span className="io-used" title="Referenced by the program logic">
                                <Icon name="play" size={11} /> used
                              </span>
                            ) : (
                              <span className="muted small">—</span>
                            )}
                          </td>
                          <td className="mono">
                            <EditableTagValue refName={ch.tagName} tag={tag} />
                          </td>
                          <td>
                            <IoChannelControl module={m} channel={ch.channel} tagName={ch.tagName} engine={engine} compact />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            );
          })}
        </div>

        <div className="panel io-panel-wrap">
          <h3>Simulated I/O Panel</h3>
          <span className="muted small">
            Drive the inputs by hand and watch the program respond on the outputs.
          </span>

          {modules.length === 0 && (
            <div className="muted small" style={{ marginTop: 10 }}>
              Add modules on the left to begin.
            </div>
          )}

          {inputModules.length > 0 && (
            <div className="io-group">
              <div className="io-group-title">
                <span className="lamp on" /> Inputs
              </div>
              {inputModules.map((m) => (
                <div key={m.id} className="io-group-block">
                  <div className="muted small">
                    {m.catalog} · slot {m.slot}
                  </div>
                  <div className="row">
                    {m.channels.map((ch) => (
                      <IoChannelControl key={ch.channel} module={m} channel={ch.channel} tagName={ch.tagName} engine={engine} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {outputModules.length > 0 && (
            <div className="io-group">
              <div className="io-group-title">
                <span className="lamp red" /> Outputs
              </div>
              {outputModules.map((m) => (
                <div key={m.id} className="io-group-block">
                  <div className="muted small">
                    {m.catalog} · slot {m.slot}
                  </div>
                  <div className="row">
                    {m.channels.map((ch) => (
                      <IoChannelControl key={ch.channel} module={m} channel={ch.channel} tagName={ch.tagName} engine={engine} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function IoChannelControl({
  module,
  channel,
  tagName,
  engine,
  compact,
}: {
  module: IoModule;
  channel: number;
  tagName: string;
  engine: PlcEngine;
  compact?: boolean;
}) {
  useScanCount();
  const value = engine.db.readScalar(tagName);

  if (module.kind === 'DI') {
    const on = value === true;
    return (
      <button
        className={`io-toggle ${on ? 'on' : ''} ${compact ? 'compact' : ''}`}
        title={`${tagName} — click to toggle`}
        onClick={() => engine.db.writeScalar(tagName, !on)}
      >
        <span className="io-toggle-led" />
        {!compact && <span className="mono">{channel}</span>}
        {!compact && <b>{on ? 'ON' : 'OFF'}</b>}
      </button>
    );
  }

  if (module.kind === 'DO') {
    const on = value === true;
    return (
      <span className={`io-toggle output ${on ? 'on' : ''} ${compact ? 'compact' : ''}`} title={tagName}>
        <span className="io-toggle-led" />
        {!compact && <span className="mono">{channel}</span>}
        <button
          className="io-force"
          title="Force this output on/off for testing"
          onClick={(e) => {
            e.stopPropagation();
            engine.db.writeScalar(tagName, !on);
          }}
        >
          {on ? 'OFF' : 'ON'}
        </button>
      </span>
    );
  }

  if (module.kind === 'AI') {
    const eng = typeof value === 'number' ? value : 0;
    return (
      <label className={`io-analog ${compact ? 'compact' : ''}`}>
        <span className="mono">{channel}</span>
        <input
          type="range"
          min={module.engMin}
          max={module.engMax}
          value={eng}
          onChange={(e) => engine.db.writeScalar(tagName, Number(e.target.value))}
          style={{ width: compact ? 70 : 90 }}
        />
        <span className="tag-value">{eng.toFixed(0)}</span>
        {!compact && <span className="muted small">({scaleEngToRaw(module, eng)})</span>}
      </label>
    );
  }

  const eng = typeof value === 'number' ? value : 0;
  const pct = ((eng - module.engMin) / (module.engMax - module.engMin || 1)) * 100;
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <span className={`io-analog output ${compact ? 'compact' : ''}`} title={tagName}>
      <span className="mono">{channel}</span>
      <span className="io-bar">
        <span className="io-bar-fill" style={{ width: `${clamped}%` }} />
      </span>
      <span className="tag-value">{eng.toFixed(0)}</span>
    </span>
  );
}
