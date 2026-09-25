import {
  createDefaultValue,
  isStructValue,
  type Scalar,
  type Tag,
  type TagValue,
  type TagValueArray,
} from './types';

export interface ParsedRef {
  raw: string;
  name: string;
  index?: number;
  member?: string;
}

const REF_RE = /^([A-Za-z_][A-Za-z0-9_]*)(?:\[(\d+)\])?(?:\.([A-Za-z]+))?$/;

export function parseRef(ref: string): ParsedRef | null {
  const m = REF_RE.exec(ref.trim());
  if (!m) return null;
  return {
    raw: ref,
    name: m[1],
    index: m[2] !== undefined ? Number(m[2]) : undefined,
    member: m[3],
  };
}

export function isValidTagName(name: string): boolean {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(name);
}

function qualified(tag: Tag): string {
  return tag.scope === 'program' ? `${tag.programId}:${tag.name}` : tag.name;
}

/**
 * In-memory tag database: holds tag definitions and their live values.
 * Program-scoped tags shadow controller tags of the same name inside a program.
 */
export class TagDatabase {
  private tags = new Map<string, Tag>();
  private byQualified = new Map<string, string>();
  private values = new Map<string, TagValue | TagValueArray>();

  constructor(tags: Tag[] = []) {
    for (const t of tags) this.addTag(t);
  }

  addTag(tag: Tag): Tag {
    const existingId = this.byQualified.get(qualified(tag));
    if (existingId && existingId !== tag.id) {
      // Replace definition, keep the id stable so editors keep working.
      const old = this.tags.get(existingId)!;
      const replacement: Tag = { ...tag, id: existingId };
      this.tags.set(existingId, replacement);
      this.values.set(existingId, createDefaultValue(replacement));
      void old;
      return replacement;
    }
    this.tags.set(tag.id, tag);
    this.byQualified.set(qualified(tag), tag.id);
    if (!this.values.has(tag.id)) this.values.set(tag.id, createDefaultValue(tag));
    return tag;
  }

  removeTag(id: string): void {
    const tag = this.tags.get(id);
    if (!tag) return;
    this.byQualified.delete(qualified(tag));
    this.tags.delete(id);
    this.values.delete(id);
  }

  /** Reload definitions from a project and reset all runtime values. */
  load(tags: Tag[]): void {
    this.tags.clear();
    this.byQualified.clear();
    this.values.clear();
    for (const t of tags) this.addTag(t);
  }

  resetValues(): void {
    for (const tag of this.tags.values()) {
      this.values.set(tag.id, createDefaultValue(tag));
    }
  }

  all(): Tag[] {
    return [...this.tags.values()];
  }

  getById(id: string): Tag | undefined {
    return this.tags.get(id);
  }

  getByName(name: string, programId?: string): Tag | undefined {
    if (programId) {
      const id = this.byQualified.get(`${programId}:${name}`);
      if (id) return this.tags.get(id);
    }
    const id = this.byQualified.get(name);
    return id ? this.tags.get(id) : undefined;
  }

  resolve(ref: string, programId?: string): { tag: Tag; parsed: ParsedRef } | undefined {
    const parsed = parseRef(ref);
    if (!parsed) return undefined;
    const tag = this.getByName(parsed.name, programId) ?? this.getByName(parsed.name);
    if (!tag) return undefined;
    return { tag, parsed };
  }

  getValue(ref: string, programId?: string): TagValue | TagValueArray | undefined {
    const r = this.resolve(ref, programId);
    if (!r) return undefined;
    const v = this.values.get(r.tag.id);
    if (v === undefined) return undefined;
    if (r.parsed.index !== undefined && Array.isArray(v)) return v[r.parsed.index];
    return v;
  }

  /** Read a primitive (BOOL / numeric) or a struct member such as Timer.DN. */
  readScalar(ref: string, programId?: string): Scalar | undefined {
    const r = this.resolve(ref, programId);
    if (!r) return undefined;
    const v = this.getValue(ref, programId);
    if (v === undefined) return undefined;
    if (r.parsed.member) {
      if (isStructValue(v)) {
        const member = (v as unknown as Record<string, unknown>)[r.parsed.member];
        if (typeof member === 'boolean' || typeof member === 'number') return member;
      }
      return undefined;
    }
    if (typeof v === 'boolean' || typeof v === 'number') return v;
    return undefined;
  }

  writeScalar(ref: string, value: Scalar, programId?: string): void {
    const r = this.resolve(ref, programId);
    if (!r) return;
    const current = this.values.get(r.tag.id);
    if (r.parsed.member && current && !Array.isArray(current) && isStructValue(current)) {
      (current as unknown as Record<string, unknown>)[r.parsed.member] = value;
      return;
    }
    const coerced = r.tag.dataType === 'BOOL' ? Boolean(value) : Number(value);
    if (r.parsed.index !== undefined && Array.isArray(current)) {
      current[r.parsed.index] = coerced;
      return;
    }
    this.values.set(r.tag.id, coerced);
  }

  /** Direct access to a tag's value container (structs are mutated in place). */
  rawValue(ref: string, programId?: string): TagValue | TagValueArray | undefined {
    return this.getValue(ref, programId);
  }
}

export function isReadable(tag: Tag | undefined): boolean {
  return !!tag;
}
