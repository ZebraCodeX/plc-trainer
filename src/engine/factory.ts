import type { DataType, Tag } from './types';
import {
  emptyProject,
  type ConditionBranch,
  type ConditionItem,
  type HmiWidget,
  type IoConfig,
  type ProcessComponent,
  type ProcessType,
  type Program,
  type Project,
  type Rung,
  type RungInstruction,
  type Routine,
} from './model';
import { makeModule } from './io';
import { uid } from './uid';

export function makeTag(
  name: string,
  dataType: DataType,
  opts: Partial<Omit<Tag, 'id' | 'name' | 'dataType'>> = {},
): Tag {
  return { id: uid('tag'), name, dataType, scope: 'controller', ...opts };
}

export function inst(op: string, ...operands: string[]): RungInstruction {
  return { id: uid('in'), op, operands };
}

export function contact(op: 'XIC' | 'XIO' | 'ONS' | 'EQU' | 'NEQ' | 'GRT' | 'GEQ' | 'LES' | 'LEQ' | 'LIM', ...operands: string[]): ConditionItem {
  return { id: uid('ci'), type: 'instruction', op, operands };
}

export function series(...items: ConditionItem[]): ConditionBranch {
  return { id: uid('br'), items };
}

export function parallel(...branches: ConditionBranch[]): ConditionItem {
  return { id: uid('grp'), type: 'group', branches };
}

export function makeRung(condition: ConditionBranch, outputs: RungInstruction[], comment = ''): Rung {
  return { id: uid('rung'), comment, condition, outputs };
}

export function makeRoutine(name: string, type: 'ladder' | 'st' = 'ladder'): Routine {
  return { id: uid('rtn'), name, type, rungs: [], stSource: '' };
}

export function makeProgram(name = 'MainProgram'): Program {
  const routine = makeRoutine('MainRoutine', 'ladder');
  return { id: uid('prg'), name, routines: [routine], mainRoutineId: routine.id };
}

export function makeComponent(
  type: ProcessType,
  x: number,
  y: number,
  label: string,
  bindings: Record<string, string> = {},
  props: Record<string, number | string | boolean> = {},
): ProcessComponent {
  return { id: uid('cmp'), type, label, x, y, props, bindings };
}

export function makeWidget(
  type: HmiWidget['type'],
  x: number,
  y: number,
  label: string,
  binding?: string,
  props: Record<string, number | string | boolean> = {},
): HmiWidget {
  return { id: uid('w'), type, x, y, w: 120, h: 60, label, binding, props };
}

export function makeIo(modules: IoConfig['modules']): IoConfig {
  return { chassisName: 'Local', modules };
}

/**
 * A ready-to-run demonstration project: a Start/Stop seal-in motor circuit.
 */
export function demoProject(): Project {
  const project = emptyProject('Motor Start/Stop Demo');

  const tags: Tag[] = [
    makeTag('Start_PB', 'BOOL', { description: 'Start pushbutton (momentary)' }),
    makeTag('Stop_PB', 'BOOL', { description: 'Stop pushbutton' }),
    makeTag('EStop', 'BOOL', { initial: true, description: 'E-Stop healthy (normally true)' }),
    makeTag('Motor_Cmd', 'BOOL', { description: 'Motor run command' }),
    makeTag('Run_Lamp', 'BOOL', { description: 'Running indicator' }),
    makeTag('Motor_Running', 'BOOL', { description: 'Motor running feedback' }),
    makeTag('Motor_Speed', 'REAL', { description: 'Motor speed (RPM)' }),
    makeTag('Run_Timer', 'TIMER', { preset: 2000 }),
  ];

  const di = makeModule('1756-IB16', 1);
  const doMod = makeModule('1756-OB16E', 2);
  di.channels[0].tagName = 'Start_PB';
  di.channels[1].tagName = 'Stop_PB';
  di.channels[2].tagName = 'EStop';
  doMod.channels[0].tagName = 'Motor_Cmd';
  doMod.channels[1].tagName = 'Run_Lamp';

  const program = makeProgram('MainProgram');
  const routine = program.routines[0];
  routine.rungs = [
    makeRung(
      series(
        parallel(series(contact('XIC', 'Start_PB')), series(contact('XIC', 'Motor_Cmd'))),
        contact('XIO', 'Stop_PB'),
        contact('XIC', 'EStop'),
      ),
      [inst('OTE', 'Motor_Cmd')],
      'Seal-in start/stop circuit',
    ),
    makeRung(
      series(contact('XIC', 'Motor_Cmd')),
      [inst('OTE', 'Run_Lamp'), inst('TON', 'Run_Timer', '2000')],
      'Running lamp and runtime timer',
    ),
  ];

  project.tags = tags;
  project.io = makeIo([di, doMod]);
  project.programs = [program];
  project.process = [
    makeComponent('motor', 80, 80, 'M1', { cmd: 'Motor_Cmd', run: 'Motor_Running', speed: 'Motor_Speed' }, { rpm: 1750, startupDelay: 0.4, rampTime: 1.5 }),
  ];
  project.hmi = [
    makeWidget('indicator', 40, 40, 'Motor Running', 'Motor_Running', { color: 'green' }),
    makeWidget('gauge', 200, 40, 'Motor Speed', 'Motor_Speed', { min: 0, max: 1800 }),
    makeWidget('button', 40, 160, 'Start', 'Start_PB'),
    makeWidget('button', 200, 160, 'Stop', 'Stop_PB'),
    makeWidget('trend', 40, 260, 'Speed Trend', 'Motor_Speed', { min: 0, max: 1800 }),
  ];

  return project;
}
