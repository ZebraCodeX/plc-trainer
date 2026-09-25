/**
 * Core PLC domain types. Used by the runtime, editors and persistence layer.
 * Allen-Bradley / Logix style: everything is tag based (no physical addressing).
 */

export type DataType =
  | 'BOOL'
  | 'SINT'
  | 'INT'
  | 'DINT'
  | 'REAL'
  | 'TIMER'
  | 'COUNTER';

export type TagScope = 'controller' | 'program';

export interface TimerValue {
  EN: boolean;
  TT: boolean;
  DN: boolean;
  ACC: number;
  PRE: number;
}

export interface CounterValue {
  CU: boolean;
  CD: boolean;
  OV: boolean;
  UN: boolean;
  DN: boolean;
  ACC: number;
  PRE: number;
}

export type Scalar = boolean | number;
export type StructValue = TimerValue | CounterValue;
export type TagValue = Scalar | StructValue;
export type TagValueArray = TagValue[];

export interface IoBinding {
  moduleId: string;
  channel: number;
}

export interface Tag {
  id: string;
  name: string;
  dataType: DataType;
  scope: TagScope;
  /** Only for program scope tags. */
  programId?: string;
  /** Array length. Undefined means scalar. */
  dimensions?: number;
  description?: string;
  /** Initial / default value used when the project is loaded. */
  initial?: Scalar;
  /** Default preset for TIMER / COUNTER tags. */
  preset?: number;
  /** Optional I/O module binding (physical I/O simulation). */
  io?: IoBinding;
}

export function isStructType(t: DataType): t is 'TIMER' | 'COUNTER' {
  return t === 'TIMER' || t === 'COUNTER';
}

export function defaultStructValue(t: DataType, preset = 0): StructValue {
  if (t === 'TIMER') {
    return { EN: false, TT: false, DN: false, ACC: 0, PRE: preset };
  }
  return { CU: false, CD: false, OV: false, UN: false, DN: false, ACC: 0, PRE: preset };
}

export function defaultScalar(t: DataType): Scalar {
  return t === 'BOOL' ? false : 0;
}

export function createDefaultValue(tag: Tag): TagValue | TagValueArray {
  const init: Scalar = tag.initial ?? defaultScalar(tag.dataType);
  const one = (): TagValue =>
    isStructType(tag.dataType) ? defaultStructValue(tag.dataType, tag.preset ?? 0) : init;

  if (tag.dimensions && tag.dimensions > 0) {
    const arr: TagValue[] = [];
    for (let i = 0; i < tag.dimensions; i++) {
      if (isStructType(tag.dataType)) {
        arr.push(defaultStructValue(tag.dataType, tag.preset ?? 0));
      } else {
        arr.push(tag.initial ?? defaultScalar(tag.dataType));
      }
    }
    return arr;
  }
  return one();
}

export function isTimerValue(v: unknown): v is TimerValue {
  return !!v && typeof v === 'object' && 'ACC' in (v as object) && 'TT' in (v as object);
}

export function isCounterValue(v: unknown): v is CounterValue {
  return !!v && typeof v === 'object' && 'ACC' in (v as object) && 'CU' in (v as object);
}

export function isStructValue(v: unknown): v is StructValue {
  return isTimerValue(v) || isCounterValue(v);
}
