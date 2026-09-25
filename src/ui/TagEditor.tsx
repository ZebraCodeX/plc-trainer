import { useState } from 'react';
import { useStore } from '../store/store';
import { useTagValue } from '../store/hooks';
import { makeTag } from '../engine/factory';
import type { DataType, TagScope } from '../engine/types';
import { formatValue } from './TagInput';

const DATA_TYPES: DataType[] = ['BOOL', 'SINT', 'INT', 'DINT', 'REAL', 'TIMER', 'COUNTER'];

export function TagEditor() {
  const { project, applyEdit } = useStore();
  const [filter, setFilter] = useState('');

  const tags = project.tags.filter((t) =>
    (t.name + ' ' + (t.description ?? '')).toLowerCase().includes(filter.toLowerCase()),
  );

  function addTag() {
    let n = 1;
    while (project.tags.some((t) => t.name === `New_Tag_${n}`)) n++;
    applyEdit((p) => {
      p.tags.push(makeTag(`New_Tag_${n}`, 'BOOL'));
    }, 'structure');
  }

  function removeTag(id: string) {
    applyEdit((p) => {
      p.tags = p.tags.filter((t) => t.id !== id);
    }, 'structure');
  }

  function update(id: string, patch: Partial<{ name: string; dataType: DataType; scope: TagScope; description: string; dimensions: number | undefined; preset: number }>) {
    const structural =
      patch.name !== undefined ||
      patch.dataType !== undefined ||
      patch.dimensions !== undefined ||
      patch.scope !== undefined;
    applyEdit((p) => {
      const t = p.tags.find((x) => x.id === id);
      if (t) Object.assign(t, patch);
    }, structural ? 'structure' : 'content');
  }

  return (
    <div className="col">
      <div className="toolbar">
        <h3 style={{ margin: 0 }}>Tag Database</h3>
        <input
          placeholder="Search tags…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <button className="primary" onClick={addTag}>
          + Add Tag
        </button>
        <span className="muted small">
          {project.tags.length} tags · controller &amp; program scope · drag refs happen in the editors
        </span>
      </div>

      <div className="panel" style={{ padding: 0, overflow: 'auto' }}>
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Type</th>
              <th>Scope</th>
              <th>Array</th>
              <th>Preset</th>
              <th>Live Value</th>
              <th>Description</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {tags.map((t) => (
              <TagRow
                key={t.id}
                tag={t}
                onChange={(patch) => update(t.id, patch)}
                onRemove={() => removeTag(t.id)}
              />
            ))}
          </tbody>
        </table>
        {tags.length === 0 && <div className="empty-state">No tags yet. Add one to begin.</div>}
      </div>
    </div>
  );
}

function TagRow({
  tag,
  onChange,
  onRemove,
}: {
  tag: ReturnType<typeof makeTag>;
  onChange: (patch: Partial<{ name: string; dataType: DataType; scope: TagScope; description: string; dimensions: number | undefined; preset: number }>) => void;
  onRemove: () => void;
}) {
  const value = useTagValue(tag.name);
  return (
    <tr>
      <td>
        <input
          value={tag.name}
          style={{ width: 160, fontFamily: 'var(--mono)' }}
          onChange={(e) => onChange({ name: e.target.value })}
        />
      </td>
      <td>
        <select value={tag.dataType} onChange={(e) => onChange({ dataType: e.target.value as DataType })}>
          {DATA_TYPES.map((d) => (
            <option key={d}>{d}</option>
          ))}
        </select>
      </td>
      <td>
        <select value={tag.scope} onChange={(e) => onChange({ scope: e.target.value as TagScope })}>
          <option value="controller">Controller</option>
          <option value="program">Program</option>
        </select>
      </td>
      <td>
        <input
          type="number"
          min={0}
          style={{ width: 60 }}
          value={tag.dimensions ?? 0}
          onChange={(e) => {
            const n = Number(e.target.value);
            onChange({ dimensions: n > 0 ? n : undefined });
          }}
        />
      </td>
      <td>
        {(tag.dataType === 'TIMER' || tag.dataType === 'COUNTER') && (
          <input
            type="number"
            style={{ width: 70 }}
            value={tag.preset ?? 0}
            onChange={(e) => onChange({ preset: Number(e.target.value) })}
          />
        )}
      </td>
      <td className="mono">
        <span className="tag-value">{value === undefined ? '--' : formatValue(value)}</span>
      </td>
      <td>
        <input
          className="wide-input"
          value={tag.description ?? ''}
          onChange={(e) => onChange({ description: e.target.value })}
        />
      </td>
      <td>
        <button className="danger" onClick={onRemove}>
          ✕
        </button>
      </td>
    </tr>
  );
}
