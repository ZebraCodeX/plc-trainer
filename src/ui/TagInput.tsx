import { useMemo } from 'react';
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
      {live !== undefined && <span className="tag-value">{formatValue(live)}</span>}
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
