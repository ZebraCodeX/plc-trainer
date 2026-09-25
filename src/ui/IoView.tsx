import { useStore } from '../store/store';
import { useScanCount } from '../store/hooks';
import { MODULE_CATALOG, getCatalog, makeModule, scaleEngToRaw } from '../engine/io';
import { makeTag } from '../engine/factory';
import type { DataType } from '../engine/types';
import type { IoModule, ModuleKind } from '../engine/model';
import { EditableTagValue } from './TagInput';
import { Guide } from './Guide';

function dataTypeForKind(kind: ModuleKind): DataType {
  return kind === 'DI' || kind === 'DO' ? 'BOOL' : 'REAL';
}

export function IoView() {
  const { project, applyEdit } = useStore();
  useScanCount();

  const modules = [...project.io.modules].sort((a, b) => a.slot - b.slot);

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

  return (
    <div className="col">
      <Guide title="How I/O configuration works" defaultOpen>
        <ul className="bullets">
          <li>
            A real PLC has a <b>chassis</b> with cards in numbered <b>slots</b>. Add modules with the
            buttons above — each one creates BOOL (digital) or REAL (analog) tags automatically.
          </li>
          <li>
            <b>1756-IB16</b> / <b>OB16E</b> are 16-point digital input / output cards.{' '}
            <b>IF8</b> / <b>OF8</b> are 8-channel analog cards.
          </li>
          <li>
            Click a channel tag name to rename it (this renames the tag everywhere). Use the{' '}
            <b>Simulated I/O Panel</b> to flip inputs and watch outputs react.
          </li>
          <li>
            Analog scaling maps raw counts (0–32767) to engineering units (e.g. 0–100%). The slider
            works in engineering units and shows the raw value beside it.
          </li>
        </ul>
      </Guide>
      <div className="flex" style={{ alignItems: 'flex-start' }}>
        <div className="panel grow">
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
              <div key={m.id} className="panel" style={{ marginBottom: 8, background: 'var(--panel-2)' }}>
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <div className="row">
                    <span className="badge">{m.catalog}</span>
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
                    Remove
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
                <table style={{ marginTop: 6 }}>
                  <thead>
                    <tr>
                      <th>Ch</th>
                      <th>Tag</th>
                      <th>Live</th>
                    </tr>
                  </thead>
                  <tbody>
                    {m.channels.map((ch) => {
                      const tag = project.tags.find((t) => t.name === ch.tagName);
                      return (
                        <tr key={ch.channel}>
                          <td className="mono">{ch.channel}</td>
                          <td>
                            <input
                              className="mono"
                              style={{ width: 170 }}
                              value={ch.tagName}
                              onChange={(e) => renameChannel(m.id, ch.channel, e.target.value)}
                            />
                          </td>
                          <td className="mono">
                            <EditableTagValue refName={ch.tagName} tag={tag} />
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

        <div className="panel grow">
          <h3>Simulated I/O Panel</h3>
          <span className="muted small">
            Toggle inputs and watch outputs. These write to the physical I/O tags the program scans.
          </span>
          <div style={{ marginTop: 10 }}>
            {modules.map((m) => (
              <div key={m.id} style={{ marginBottom: 10 }}>
                <div className="muted small">
                  {m.catalog} · slot {m.slot}
                </div>
                <div className="row">
                  {m.channels.map((ch) => (
                    <IoChannelControl key={ch.channel} module={m} channel={ch.channel} tagName={ch.tagName} />
                  ))}
                </div>
              </div>
            ))}
            {modules.length === 0 && <div className="muted small">Add modules on the left.</div>}
          </div>
        </div>
      </div>
    </div>
  );
}

function IoChannelControl({ module, channel, tagName }: { module: IoModule; channel: number; tagName: string }) {
  const { engine } = useStore();
  useScanCount();
  const value = engine.db.readScalar(tagName);

  if (module.kind === 'DI') {
    const on = value === true;
    return (
      <button
        className={on ? 'primary' : ''}
        title={`${tagName} — click to toggle`}
        onClick={() => engine.db.writeScalar(tagName, !on)}
      >
        {channel}: {on ? 'ON' : 'OFF'}
      </button>
    );
  }
  if (module.kind === 'DO') {
    const on = value === true;
    return (
      <span className="pill">
        <span className={`lamp ${on ? 'on' : ''}`} /> {channel}
      </span>
    );
  }
  if (module.kind === 'AI') {
    const eng = typeof value === 'number' ? value : 0;
    return (
      <label className="pill" style={{ minWidth: 170 }}>
        {channel}
        <input
          type="range"
          min={module.engMin}
          max={module.engMax}
          value={eng}
          onChange={(e) => engine.db.writeScalar(tagName, Number(e.target.value))}
          style={{ width: 90 }}
        />
        <span className="tag-value">{eng.toFixed(0)}</span>
        <span className="muted small">({scaleEngToRaw(module, eng)})</span>
      </label>
    );
  }
  const eng = typeof value === 'number' ? value : 0;
  const pct = ((eng - module.engMin) / (module.engMax - module.engMin || 1)) * 100;
  return (
    <span className="pill" style={{ minWidth: 150 }}>
      {channel}
      <span style={{ display: 'inline-block', width: 60, height: 8, background: '#0b0f14', borderRadius: 4 }}>
        <span
          style={{
            display: 'block',
            width: `${Math.max(0, Math.min(100, pct))}%`,
            height: '100%',
            background: 'var(--accent)',
            borderRadius: 4,
          }}
        />
      </span>
      <span className="tag-value">{eng.toFixed(0)}</span>
    </span>
  );
}
