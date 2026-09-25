import { useMemo, useState } from 'react';
import { useStore } from '../store/store';
import { useTagValue } from '../store/hooks';
import type { Tag } from '../engine/types';

export function useTagNames(accepts?: (tag: Tag) => boolean): string[] {
  const tags = useStore((s) => s.project.tags);
  return useMemo(() => {
    const list = accepts ? tags.filter(accepts) : tags;
    return list
      .map((t) => t.name)
      .filter((v, i, a) => a.indexOf(v) === i)
      .sort((a, b) => a.localeCompare(b));
  }, [tags, accepts]);
}

interface TagInputProps {
  value: string;
  onChange: (value: string) => void;
  accepts?: (tag: Tag) => boolean;
  placeholder?: string;
  width?: number;
}

export function TagInput({ value, onChange, accepts, placeholder, width }: TagInputProps) {
  const names = useTagNames(accepts);
  const listId = useMemo(() => `tags-${Math.random().toString(36).slice(2, 7)}`, []);
  const live = useTagValue(value);
  return (
    <span className="row" style={{ gap: 4 }}>
      <input
        list={listId}
        value={value}
        placeholder={placeholder ?? 'Tag'}
        style={width ? { width } : undefined}
        onChange={(e) => onChange(e.target.value)}
      />
      <datalist id={listId}>
        {names.map((n) => (
          <option key={n} value={n} />
        ))}
      </datalist>
      {live !== undefined && <EditableTagValue refName={value} />}
    </span>
  );
}

export function formatValue(v: unknown): string {
  if (typeof v === 'boolean') return v ? '1' : '0';
  if (typeof v === 'number') return Number.isInteger(v) ? String(v) : v.toFixed(1);
  return String(v);
}

export function TagValue({ refName }: { refName: string }) {
  const v = useTagValue(refName);
  return <span className="tag-value">{v === undefined ? '--' : formatValue(v)}</span>;
}

/**
 * Live tag value that can be edited inline.
 *  - BOOL tags toggle on click.
 *  - Numeric tags become an input you can type into; Enter/blur commits.
 *  - When not running, edits still apply to the tag's live value.
 */
export function EditableTagValue({
  refName,
  tag,
  value,
  width = 58,
}: {
  refName?: string;
  tag?: Tag;
  value?: boolean | number;
  width?: number;
}) {
  const { engine } = useStore();
  const live = useTagValue(refName);
  const current = value ?? live;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const isBool = tag?.dataType === 'BOOL' || typeof current === 'boolean';

  if (refName === undefined || refName === '') {
    return <span className="tag-value muted">--</span>;
  }

  if (isBool) {
    const on = current === true;
    return (
      <button
        className={`tag-value tag-toggle ${on ? 'on' : ''}`}
        title={`${refName} — click to toggle ${on ? 'OFF' : 'ON'}`}
        onClick={(e) => {
          e.stopPropagation();
          engine.db.writeScalar(refName, !on);
        }}
      >
        {on ? '1' : '0'}
      </button>
    );
  }

  if (editing) {
    const commit = () => {
      const n = Number(draft);
      if (!Number.isNaN(n)) engine.db.writeScalar(refName, n);
      setEditing(false);
    };
    return (
      <input
        className="tag-value tag-edit"
        autoFocus
        style={{ width }}
        value={draft}
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
          if (e.key === 'Escape') setEditing(false);
        }}
      />
    );
  }

  return (
    <button
      className="tag-value tag-toggle"
      title={`${refName} — click to edit`}
      onClick={(e) => {
        e.stopPropagation();
        if (current === undefined) return;
        setDraft(String(current));
        setEditing(true);
      }}
    >
      {current === undefined ? '--' : formatValue(current)}
    </button>
  );
}
