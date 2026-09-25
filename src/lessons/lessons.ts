import type { Lesson, Project } from '../engine/model';
import { emptyProject } from '../engine/model';
import {
  contact,
  inst,
  makeComponent,
  makeIo,
  makeProgram,
  makeRung,
  makeTag,
  makeWidget,
  series,
} from '../engine/factory';
import { makeModule } from '../engine/io';

export interface LessonPack {
  lesson: Lesson;
  project: Project;
}

function motorLesson(): LessonPack {
  const project = emptyProject('Lesson 1 — Start/Stop Motor');
  project.tags = [
    makeTag('Start_PB', 'BOOL'),
    makeTag('Stop_PB', 'BOOL'),
    makeTag('EStop', 'BOOL', { initial: true }),
    makeTag('Motor_Cmd', 'BOOL'),
    makeTag('Motor_Running', 'BOOL'),
    makeTag('Motor_Speed', 'REAL'),
  ];
  const di = makeModule('1756-IB16', 1);
  const dout = makeModule('1756-OB16E', 2);
  di.channels[0].tagName = 'Start_PB';
  di.channels[1].tagName = 'Stop_PB';
  di.channels[2].tagName = 'EStop';
  dout.channels[0].tagName = 'Motor_Cmd';
  project.io = makeIo([di, dout]);

  const program = makeProgram('MainProgram');
  program.routines[0].rungs = [makeRung(series(contact('XIC', 'Start_PB')), [inst('OTE', 'Motor_Cmd')])];
  project.programs = [program];
  project.process = [
    makeComponent('motor', 80, 80, 'M1', { cmd: 'Motor_Cmd', run: 'Motor_Running', speed: 'Motor_Speed' }),
  ];
  project.hmi = [
    makeWidget('indicator', 40, 40, 'Running', 'Motor_Running'),
    makeWidget('switch', 40, 130, 'Start', 'Start_PB'),
  ];

  const lesson: Lesson = {
    id: 'motor',
    title: 'Start/Stop Motor with Seal-in',
    summary:
      'Complete the ladder so the motor starts with Start_PB, stays running after release (seal-in), and stops with Stop_PB. E-Stop must also stop the motor.',
    difficulty: 'intro',
    objectives: [
      {
        id: 'o1',
        description: 'Pressing Start runs the motor',
        kind: 'tagBoolean',
        ref: 'Motor_Cmd',
        expected: true,
        inputs: [
          { ref: 'Start_PB', value: true },
          { ref: 'EStop', value: true },
        ],
        steps: 10,
      },
      {
        id: 'o2',
        description: 'Stop pushbutton stops the motor',
        kind: 'tagBoolean',
        ref: 'Motor_Cmd',
        expected: false,
        inputs: [
          { ref: 'Start_PB', value: true },
          { ref: 'Stop_PB', value: true },
          { ref: 'EStop', value: true },
        ],
        steps: 10,
      },
      {
        id: 'o3',
        description: 'Motor feedback comes on while commanded',
        kind: 'tagBoolean',
        ref: 'Motor_Running',
        expected: true,
        inputs: [
          { ref: 'Start_PB', value: true },
          { ref: 'EStop', value: true },
        ],
        steps: 60,
      },
    ],
  };
  return { lesson, project };
}

function tankLesson(): LessonPack {
  const project = emptyProject('Lesson 2 — Tank Level Control');
  project.tags = [
    makeTag('Low_Sensor', 'BOOL'),
    makeTag('High_Sensor', 'BOOL'),
    makeTag('Inlet_Valve', 'BOOL'),
    makeTag('Outlet_Valve', 'BOOL'),
    makeTag('Level', 'REAL'),
  ];
  const di = makeModule('1756-IB16', 1);
  const dout = makeModule('1756-OB16E', 2);
  di.channels[0].tagName = 'Low_Sensor';
  di.channels[1].tagName = 'High_Sensor';
  dout.channels[0].tagName = 'Inlet_Valve';
  dout.channels[1].tagName = 'Outlet_Valve';
  project.io = makeIo([di, dout]);

  const program = makeProgram('MainProgram');
  program.routines[0].rungs = [];
  project.programs = [program];
  project.process = [
    makeComponent('tank', 200, 60, 'Tank 1', { inlet: 'Inlet_Valve', outlet: 'Outlet_Valve', level: 'Level' }),
  ];

  const lesson: Lesson = {
    id: 'tank',
    title: 'Tank Level Control',
    summary:
      'Open the inlet valve when the level is low (Low_Sensor) and close it when the tank is full (High_Sensor). Latch the valve so it stays where it is put.',
    difficulty: 'intermediate',
    objectives: [
      {
        id: 'o1',
        description: 'Low level opens the inlet valve',
        kind: 'tagBoolean',
        ref: 'Inlet_Valve',
        expected: true,
        inputs: [{ ref: 'Low_Sensor', value: true }],
        steps: 10,
      },
      {
        id: 'o2',
        description: 'High level closes the inlet valve',
        kind: 'tagBoolean',
        ref: 'Inlet_Valve',
        expected: false,
        inputs: [
          { ref: 'Low_Sensor', value: true },
          { ref: 'High_Sensor', value: true },
        ],
        steps: 10,
      },
    ],
  };
  return { lesson, project };
}

function trafficLesson(): LessonPack {
  const project = emptyProject('Lesson 3 — Traffic Light');
  project.tags = [
    makeTag('Enable', 'BOOL'),
    makeTag('Red', 'BOOL'),
    makeTag('Yellow', 'BOOL'),
    makeTag('Green', 'BOOL'),
    makeTag('Light_Timer', 'TIMER', { preset: 1000 }),
  ];
  const dout = makeModule('1756-OB16E', 2);
  dout.channels[0].tagName = 'Red';
  dout.channels[1].tagName = 'Yellow';
  dout.channels[2].tagName = 'Green';
  project.io = makeIo([dout]);
  const program = makeProgram('MainProgram');
  program.routines[0].rungs = [];
  project.programs = [program];
  project.process = [
    makeComponent('trafficLight', 200, 60, 'Signal', { red: 'Red', yellow: 'Yellow', green: 'Green' }),
  ];

  const lesson: Lesson = {
    id: 'traffic',
    title: 'Traffic Light Sequence',
    summary:
      'Build a repeating Red → Green → Yellow sequence using TON timers, enabled by the Enable input. Red must be on when the sequence starts.',
    difficulty: 'intermediate',
    objectives: [
      {
        id: 'o1',
        description: 'Red is on when enabled',
        kind: 'tagBoolean',
        ref: 'Red',
        expected: true,
        inputs: [{ ref: 'Enable', value: true }],
        steps: 10,
      },
      {
        id: 'o2',
        description: 'Green comes on after the first delay',
        kind: 'tagBoolean',
        ref: 'Green',
        expected: true,
        inputs: [{ ref: 'Enable', value: true }],
        steps: 80,
      },
    ],
  };
  return { lesson, project };
}

function stLesson(): LessonPack {
  const project = emptyProject('Lesson 4 — Structured Text');
  project.tags = [
    makeTag('Start_PB', 'BOOL'),
    makeTag('Stop_PB', 'BOOL'),
    makeTag('Run', 'BOOL'),
    makeTag('Run_Time', 'DINT'),
  ];
  const program = makeProgram('MainProgram');
  const routine = program.routines[0];
  routine.type = 'st';
  routine.name = 'MainRoutine';
  routine.stSource = `// Complete the seal-in logic in Structured Text
IF Start_PB AND NOT Stop_PB THEN
  Run := 1;
END_IF;

IF Run THEN
  Run_Time := Run_Time + 1;
END_IF;
`;
  project.programs = [program];

  const lesson: Lesson = {
    id: 'st',
    title: 'Structured Text Basics',
    summary:
      'Write an IF statement so Run is TRUE while Start_PB is pressed and Stop_PB is not. Run_Time should count up while Run is true.',
    difficulty: 'intro',
    objectives: [
      {
        id: 'o1',
        description: 'Run is true when Start pressed and Stop released',
        kind: 'tagBoolean',
        ref: 'Run',
        expected: true,
        inputs: [{ ref: 'Start_PB', value: true }],
        steps: 5,
      },
      {
        id: 'o2',
        description: 'Stop overrides Start',
        kind: 'tagBoolean',
        ref: 'Run',
        expected: false,
        inputs: [
          { ref: 'Start_PB', value: true },
          { ref: 'Stop_PB', value: true },
        ],
        steps: 5,
      },
    ],
  };
  return { lesson, project };
}

export function allLessons(): LessonPack[] {
  return [motorLesson(), tankLesson(), trafficLesson(), stLesson()];
}
