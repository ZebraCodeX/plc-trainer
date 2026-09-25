import { PlcEngine } from '../engine/engine';
import { emptyProject, type Project } from '../engine/model';
import { makeProgram, makeTag } from '../engine/factory';
import type { ConditionBranch, Rung } from '../engine/model';
import type { Mission, GameAction } from './types';
import { missionArrayTag } from './missions';

/**
 * Build a runnable Project from a mission. The "logic" is supplied separately
 * as either ladder rungs (compiled from the visual editor) or ST source.
 */
export interface MissionProgram {
  kind: 'ladder' | 'st';
  rungs?: Rung[];
  source?: string;
}

export function buildMissionProject(mission: Mission, program: MissionProgram): Project {
  const project = emptyProject(mission.title);
  const arr = missionArrayTag(mission);
  project.tags = mission.io.map((t) =>
    makeTag(t.name, t.dataType, {
      preset: t.preset ?? 0,
      initial: false,
      dimensions: arr && arr.name === t.name ? arr.size : undefined,
    }),
  );

  const main = makeProgram('GameProgram');
  const routine = main.routines[0];
  if (program.kind === 'st') {
    routine.type = 'st';
    routine.stSource = program.source ?? '';
  } else {
    routine.rungs = program.rungs ?? [];
  }
  main.mainRoutineId = routine.id;
  project.programs = [main];

  if (mission.machine) {
    project.process = [
      {
        id: 'machine',
        type: mission.machine.type,
        label: mission.machine.label,
        x: 60,
        y: 40,
        props: {},
        bindings: machineBindings(mission),
      },
    ];
  }
  return project;
}

function machineBindings(mission: Mission): Record<string, string> {
  const names = mission.io.map((t) => t.name);
  const find = (needles: string[]) =>
    names.find((n) => needles.some((x) => n.toLowerCase().includes(x)));
  switch (mission.machine?.type) {
    case 'motor':
      return {
        cmd: find(['cmd', 'motor', 'run']) ?? '',
        run: find(['running', 'feedback', 'at_speed']) ?? '',
        speed: find(['speed']) ?? '',
      };
    case 'tank':
      return {
        inlet: find(['inlet']) ?? '',
        outlet: find(['outlet', 'drain']) ?? '',
        level: find(['level']) ?? '',
        high: find(['high']) ?? '',
        low: find(['low']) ?? '',
      };
    case 'trafficLight':
      return {
        red: find(['red']) ?? '',
        yellow: find(['yellow', 'amber']) ?? '',
        green: find(['green']) ?? '',
      };
    case 'heater':
      return { on: find(['heat', 'on']) ?? '', temp: find(['temp']) ?? '' };
    case 'valve':
      return {
        openCmd: find(['open']) ?? '',
        closeCmd: find(['close']) ?? '',
        opened: find(['opened', 'open']) ?? '',
        closed: find(['closed', 'close']) ?? '',
      };
    default:
      return {};
  }
}

export interface TestStepResult {
  stepIndex: number;
  label: string;
  pass: boolean;
  expected?: Record<string, boolean | number>;
  actual?: Record<string, boolean | number>;
}

export interface TestResult {
  id: string;
  name: string;
  pass: boolean;
  steps: TestStepResult[];
  log: string[];
}

function fmt(v: unknown): string {
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
  if (typeof v === 'number') return String(v);
  return String(v);
}

function matches(actual: unknown, expected: boolean | number): boolean {
  if (typeof expected === 'boolean') return actual === expected;
  if (typeof actual === 'number') return Math.abs(actual - expected) <= 0.5;
  if (typeof actual === 'boolean') return (actual ? 1 : 0) === expected;
  return false;
}

/**
 * Run a single behavioural test against a fresh engine built from the mission.
 * The engine is stepped deterministically; timers advance by the mission tick.
 */
export function runTest(mission: Mission, program: MissionProgram, test: { id: string; name: string; actions: GameAction[] }, tickMs = 20): TestResult {
  const project = buildMissionProject(mission, program);
  const engine = new PlcEngine(project);
  engine.scanTimeMs = tickMs;

  const steps: TestStepResult[] = [];
  const log: string[] = [];
  let pass = true;

  engine.step(tickMs); // initial scan

  test.actions.forEach((action, i) => {
    if (action.set) {
      for (const [ref, value] of Object.entries(action.set)) {
        engine.db.writeScalar(ref, value);
        log.push(`→ ${ref} := ${fmt(value)}`);
      }
    }
    const ticks = Math.max(1, action.ticks ?? 1);
    for (let t = 0; t < ticks; t++) engine.step(tickMs);

    const actual: Record<string, boolean | number> = {};
    let stepPass = true;
    if (action.expect) {
      for (const [ref, expected] of Object.entries(action.expect)) {
        const value = engine.db.readScalar(ref);
        actual[ref] = (value ?? false) as boolean | number;
        const ok = matches(value, expected);
        if (!ok) stepPass = false;
        log.push(
          `${ok ? '✓' : '✗'} ${ref} = ${fmt(value)} (expected ${fmt(expected)})`,
        );
      }
    }
    if (!stepPass) pass = false;
    steps.push({
      stepIndex: i,
      label: action.label ?? `Step ${i + 1}`,
      pass: stepPass,
      expected: action.expect,
      actual,
    });
  });

  return { id: test.id, name: test.name, pass, steps, log };
}

/** Ladder text used for objective "requires" checks. */
export function programText(program: MissionProgram): string {
  if (program.kind === 'st') return (program.source ?? '').toUpperCase();
  const parts: string[] = [];
  for (const rung of program.rungs ?? []) {
    parts.push(rungText(rung.condition));
    for (const o of rung.outputs) parts.push(o.op.toUpperCase());
  }
  return parts.join(' ').toUpperCase();
}

function rungText(branch: ConditionBranch): string {
  const parts: string[] = [];
  for (const item of branch.items) {
    if (item.type === 'group') {
      for (const b of item.branches ?? []) parts.push(rungText(b));
    } else {
      parts.push((item.op ?? '').toUpperCase());
    }
  }
  return parts.join(' ');
}
