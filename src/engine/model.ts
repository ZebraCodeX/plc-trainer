import type { Tag } from './types';

export const SCHEMA_VERSION = 1;

/* ------------------------------------------------------------------ */
/* Ladder model: nested series / parallel rungs                        */
/* ------------------------------------------------------------------ */

export interface RungInstruction {
  id: string;
  op: string;
  /** Operand expressions. May be tag refs, literals (123, 'text') or expressions (CPT). */
  operands: string[];
}

export interface ConditionItem {
  id: string;
  type: 'instruction' | 'group';
  op?: string;
  operands?: string[];
  /** Present when type === 'group': parallel branches. */
  branches?: ConditionBranch[];
}

export interface ConditionBranch {
  id: string;
  items: ConditionItem[];
}

export interface Rung {
  id: string;
  comment?: string;
  condition: ConditionBranch;
  outputs: RungInstruction[];
}

/* ------------------------------------------------------------------ */
/* Routines & programs                                                 */
/* ------------------------------------------------------------------ */

export type RoutineType = 'ladder' | 'st';

export interface Routine {
  id: string;
  name: string;
  type: RoutineType;
  rungs: Rung[];
  stSource: string;
}

export interface Program {
  id: string;
  name: string;
  routines: Routine[];
  mainRoutineId: string;
}

/* ------------------------------------------------------------------ */
/* I/O configuration                                                   */
/* ------------------------------------------------------------------ */

export type ModuleKind = 'DI' | 'DO' | 'AI' | 'AO';

export interface IoChannel {
  channel: number;
  tagName: string;
  description?: string;
}

export interface IoModule {
  id: string;
  slot: number;
  catalog: string;
  kind: ModuleKind;
  channels: IoChannel[];
  /** Analog scaling. */
  rawMin: number;
  rawMax: number;
  engMin: number;
  engMax: number;
}

export interface IoConfig {
  chassisName: string;
  modules: IoModule[];
}

/* ------------------------------------------------------------------ */
/* Simulated process / plant                                           */
/* ------------------------------------------------------------------ */

export type ProcessType =
  | 'motor'
  | 'conveyor'
  | 'tank'
  | 'valve'
  | 'pump'
  | 'trafficLight'
  | 'heater'
  | 'fan'
  | 'sensor'
  | 'counter';

export interface ProcessComponent {
  id: string;
  type: ProcessType;
  label: string;
  x: number;
  y: number;
  props: Record<string, number | string | boolean>;
  /** terminal key -> tag ref */
  bindings: Record<string, string>;
}

/* ------------------------------------------------------------------ */
/* HMI / SCADA                                                         */
/* ------------------------------------------------------------------ */

export type HmiWidgetType =
  | 'indicator'
  | 'button'
  | 'switch'
  | 'numeric'
  | 'gauge'
  | 'bar'
  | 'trend'
  | 'label';

export interface HmiWidget {
  id: string;
  type: HmiWidgetType;
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  binding?: string;
  props: Record<string, number | string | boolean>;
}

/* ------------------------------------------------------------------ */
/* IIoT: MQTT + Modbus                                                 */
/* ------------------------------------------------------------------ */

export interface MqttRule {
  id: string;
  tag: string;
  topic: string;
}

export type ModbusArea = 'coil' | 'discrete' | 'holding' | 'input';

export interface ModbusMapping {
  id: string;
  tag: string;
  area: ModbusArea;
  address: number;
}

export interface IiotConfig {
  mqttEnabled: boolean;
  mqttPublish: MqttRule[];
  useRealBroker: boolean;
  brokerUrl: string;
  clientId: string;
  modbus: ModbusMapping[];
}

/* ------------------------------------------------------------------ */
/* Training                                                            */
/* ------------------------------------------------------------------ */

export interface ObjectiveInput {
  ref: string;
  value: number | boolean;
}

export interface Objective {
  id: string;
  description: string;
  kind: 'tagBoolean' | 'tagNumber';
  ref: string;
  expected?: boolean | number;
  tolerance?: number;
  /** Inputs applied before the check runs. */
  inputs?: ObjectiveInput[];
  /** Scans to run before reading the result (default 25). */
  steps?: number;
}

export interface Lesson {
  id: string;
  title: string;
  summary: string;
  difficulty: 'intro' | 'intermediate' | 'advanced';
  objectives: Objective[];
  starter?: Partial<Project>;
}

/* ------------------------------------------------------------------ */
/* Project root                                                        */
/* ------------------------------------------------------------------ */

export interface Project {
  schemaVersion: number;
  name: string;
  description?: string;
  tags: Tag[];
  programs: Program[];
  io: IoConfig;
  process: ProcessComponent[];
  hmi: HmiWidget[];
  iiot: IiotConfig;
  lessons?: Lesson[];
}

export function emptyProject(name = 'Untitled Project'): Project {
  return {
    schemaVersion: SCHEMA_VERSION,
    name,
    tags: [],
    programs: [],
    io: { chassisName: 'Local', modules: [] },
    process: [],
    hmi: [],
    iiot: {
      mqttEnabled: true,
      mqttPublish: [],
      useRealBroker: false,
      brokerUrl: 'ws://localhost:9001',
      clientId: 'plc-trainer',
      modbus: [],
    },
  };
}
