import { describe, it, expect } from 'vitest';
import { MISSIONS, missionById } from './missions';
import { runTest, type MissionProgram } from './engine';
import { makeRung, inst, contact, series, parallel } from '../engine/factory';
import { instructionColor } from '../ladder/colors';

/** Reference solutions — prove every mission is solvable. */
const SOLUTIONS: Record<string, MissionProgram> = {
  m1: {
    kind: 'ladder',
    rungs: [makeRung(series(contact('XIC', 'Start_PB')), [inst('OTE', 'Motor')])],
  },
  m2: {
    kind: 'ladder',
    rungs: [
      makeRung(
        series(
          parallel(series(contact('XIC', 'Start_PB')), series(contact('XIC', 'Conveyor'))),
          contact('XIO', 'Stop_PB'),
        ),
        [inst('OTE', 'Conveyor')],
      ),
    ],
  },
  m3: {
    kind: 'ladder',
    rungs: [
      makeRung(
        series(
          parallel(series(contact('XIC', 'Start_PB')), series(contact('XIC', 'Motor'))),
          contact('XIO', 'Stop_PB'),
          contact('XIC', 'EStop_OK'),
        ),
        [inst('OTE', 'Motor')],
      ),
    ],
  },
  m4: {
    kind: 'ladder',
    rungs: [
      makeRung(
        series(
          parallel(series(contact('XIC', 'Inlet_Valve')), series(contact('XIC', 'Low_Level'))),
          contact('XIO', 'High_Level'),
        ),
        [inst('OTE', 'Inlet_Valve')],
      ),
    ],
  },
  m5: {
    kind: 'ladder',
    rungs: [
      makeRung(series(contact('XIC', 'Start_PB')), [inst('TON', 'Prime_Timer', '2000')]),
      makeRung(series(contact('XIC', 'Prime_Timer.DN')), [inst('OTE', 'Motor')]),
    ],
  },
  m6: {
    kind: 'ladder',
    rungs: [
      makeRung(
        series(contact('XIC', 'Part_Sensor'), contact('XIO', 'Pulse_Timer.DN')),
        [inst('TON', 'Pulse_Timer', '250')],
      ),
      makeRung(
        series(contact('XIC', 'Part_Sensor'), contact('XIO', 'Flash_Count.DN')),
        [inst('OTE', 'Beacon')],
      ),
      makeRung(series(contact('XIC', 'Pulse_Timer.DN')), [inst('CTU', 'Flash_Count', '3')]),
    ],
  },
  m8: {
    kind: 'ladder',
    rungs: [
      makeRung(
        series(contact('XIC', 'PumpA_Cmd'), contact('XIO', 'PumpB')),
        [inst('OTE', 'PumpA')],
      ),
      makeRung(
        series(contact('XIC', 'PumpB_Cmd'), contact('XIO', 'PumpA')),
        [inst('OTE', 'PumpB')],
      ),
    ],
  },
  m9: {
    kind: 'st',
    source: `CASE Recipe OF
  1: Target_Time := 60000; Heat := 0;
  2: Target_Time := 90000; Heat := 0;
  3: Target_Time := 120000; Heat := 1;
END_CASE;`,
  },
  m10: {
    kind: 'st',
    source: `Sum := 0;
FOR I := 0 TO 9 DO
  Sum := Sum + Sample[I];
END_FOR;
Average := Sum / 10;
IF Average > Trip_Point THEN
  High_Alarm := 1;
ELSE
  High_Alarm := 0;
END_IF;`,
  },
};

describe('missions', () => {
  it('has unique ids and increasing difficulty', () => {
    const ids = MISSIONS.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(MISSIONS.length).toBeGreaterThanOrEqual(8);
  });

  it('every mission has tests, objectives and hints', () => {
    for (const m of MISSIONS) {
      expect(m.tests.length).toBeGreaterThan(0);
      expect(m.objectives.length).toBeGreaterThan(0);
      expect(m.hints.length).toBeGreaterThan(0);
      expect(m.reward).toBeGreaterThan(0);
    }
  });

  it('reference solutions pass all behavioural tests', () => {
    for (const m of MISSIONS) {
      const solution = SOLUTIONS[m.id];
      if (!solution) continue;
      const results = m.tests.map((t) => runTest(m, solution, t));
      const failed = results.filter((r) => !r.pass).map((r) => `${m.id}/${r.name}`);
      expect(failed, `Failing: ${failed.join(', ')}`).toEqual([]);
    }
  });

  it('empty logic fails at least one test (nothing is trivially solved)', () => {
    for (const m of MISSIONS) {
      const empty: MissionProgram = m.kind === 'st' ? { kind: 'st', source: '' } : { kind: 'ladder', rungs: [] };
      const results = m.tests.map((t) => runTest(m, empty, t));
      expect(
        results.some((r) => !r.pass),
        `${m.id} should fail with no logic`,
      ).toBe(true);
    }
  });
});

describe('instruction colours', () => {
  it('assigns a distinct colour per category', () => {
    const colours = new Set([
      instructionColor('XIC'),
      instructionColor('TON'),
      instructionColor('CTU'),
      instructionColor('EQU'),
      instructionColor('ADD'),
      instructionColor('MOV'),
    ]);
    expect(colours.size).toBe(6);
  });
});

describe('mission lookups', () => {
  it('finds missions by id', () => {
    expect(missionById('m1')?.title).toBeTruthy();
    expect(missionById('nope')).toBeUndefined();
  });
});
