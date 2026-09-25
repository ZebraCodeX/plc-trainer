import { describe, it, expect } from 'vitest';
import { PlcEngine } from './engine';
import { TagDatabase } from './tagdb';
import { makeTag, demoProject, makeProgram, makeRoutine } from './factory';
import { emptyProject } from './model';

function engineWith(tags: ReturnType<typeof makeTag>[], build: (engine: PlcEngine) => void) {
  const project = emptyProject('test');
  project.tags = tags;
  const engine = new PlcEngine(project);
  build(engine);
  return engine;
}

describe('TagDatabase', () => {
  it('reads and writes scalars', () => {
    const db = new TagDatabase([makeTag('A', 'BOOL'), makeTag('N', 'INT')]);
    db.writeScalar('A', true);
    db.writeScalar('N', 42);
    expect(db.readScalar('A')).toBe(true);
    expect(db.readScalar('N')).toBe(42);
  });

  it('handles arrays', () => {
    const db = new TagDatabase([makeTag('Arr', 'INT', { dimensions: 5 })]);
    db.writeScalar('Arr[2]', 7);
    expect(db.readScalar('Arr[2]')).toBe(7);
    expect(db.readScalar('Arr[0]')).toBe(0);
  });

  it('handles timer member access', () => {
    const db = new TagDatabase([makeTag('T', 'TIMER', { preset: 500 })]);
    expect(db.readScalar('T.DN')).toBe(false);
    expect(db.readScalar('T.PRE')).toBe(500);
    db.writeScalar('T.DN', true);
    expect(db.readScalar('T.DN')).toBe(true);
  });
});

describe('Ladder runtime', () => {
  it('holding start seals in until stop', () => {
    const engine = new PlcEngine(demoProject());
    const db = engine.db;
    engine.step();
    expect(db.readScalar('Motor_Cmd')).toBe(false);

    db.writeScalar('Start_PB', true);
    engine.step();
    expect(db.readScalar('Motor_Cmd')).toBe(true);

    db.writeScalar('Start_PB', false);
    engine.step();
    expect(db.readScalar('Motor_Cmd')).toBe(true);

    db.writeScalar('Stop_PB', true);
    engine.step();
    expect(db.readScalar('Motor_Cmd')).toBe(false);
  });

  it('drives the simulated motor after the startup delay', () => {
    const engine = new PlcEngine(demoProject());
    const db = engine.db;
    db.writeScalar('Start_PB', true);
    for (let i = 0; i < 40; i++) engine.step();
    expect(db.readScalar('Motor_Running')).toBe(true);
    expect(db.readScalar('Motor_Speed')).toBeGreaterThan(0);
  });

  it('runs TON timers', () => {
    const engine = engineWith([makeTag('EN', 'BOOL'), makeTag('T', 'TIMER', { preset: 100 })], (e) => {
      const program = makeProgram();
      program.routines[0].rungs = [
        {
          id: 'r1',
          condition: { id: 'b1', items: [{ id: 'i1', type: 'instruction', op: 'XIC', operands: ['EN'] }] },
          outputs: [{ id: 'o1', op: 'TON', operands: ['T', '100'] }],
        },
      ];
      e.project.programs = [program];
      e.invalidatePrograms();
    });
    engine.step();
    expect(engine.db.readScalar('T.DN')).toBe(false);
    engine.db.writeScalar('EN', true);
    for (let i = 0; i < 6; i++) engine.step();
    expect(engine.db.readScalar('T.DN')).toBe(true);
    expect(engine.db.readScalar('T.ACC')).toBe(100);
  });

  it('runs CTU counters on rising edges', () => {
    const engine = engineWith([makeTag('Pulse', 'BOOL'), makeTag('C', 'COUNTER', { preset: 3 })], (e) => {
      const program = makeProgram();
      program.routines[0].rungs = [
        {
          id: 'r1',
          condition: { id: 'b1', items: [{ id: 'i1', type: 'instruction', op: 'XIC', operands: ['Pulse'] }] },
          outputs: [{ id: 'o1', op: 'CTU', operands: ['C', '3'] }],
        },
      ];
      e.project.programs = [program];
    });
    for (let i = 0; i < 3; i++) {
      engine.db.writeScalar('Pulse', true);
      engine.step();
      engine.db.writeScalar('Pulse', false);
      engine.step();
    }
    expect(engine.db.readScalar('C.ACC')).toBe(3);
    expect(engine.db.readScalar('C.DN')).toBe(true);
  });
});

describe('Structured Text runtime', () => {
  it('executes an if/else program', () => {
    const engine = engineWith(
      [makeTag('Start', 'BOOL'), makeTag('Stop', 'BOOL'), makeTag('Run', 'BOOL')],
      (e) => {
        const program = makeProgram();
        program.routines[0] = makeRoutine('MainRoutine', 'st');
        program.routines[0].stSource = `
          IF Start AND NOT Stop THEN
            Run := 1;
          ELSE
            Run := 0;
          END_IF;
        `;
        program.mainRoutineId = program.routines[0].id;
        e.project.programs = [program];
        e.invalidatePrograms();
      },
    );
    engine.db.writeScalar('Start', true);
    engine.step();
    expect(engine.db.readScalar('Run')).toBe(true);
    engine.db.writeScalar('Stop', true);
    engine.step();
    expect(engine.db.readScalar('Run')).toBe(false);
  });

  it('runs a for loop and math', () => {
    const engine = engineWith([makeTag('Sum', 'DINT'), makeTag('I', 'DINT')], (e) => {
      const program = makeProgram();
      program.routines[0] = makeRoutine('MainRoutine', 'st');
      program.routines[0].stSource = `
        Sum := 0;
        FOR I := 1 TO 5 DO
          Sum := Sum + I;
        END_FOR;
      `;
      program.mainRoutineId = program.routines[0].id;
      e.project.programs = [program];
    });
    engine.step();
    expect(engine.db.readScalar('Sum')).toBe(15);
  });
});
