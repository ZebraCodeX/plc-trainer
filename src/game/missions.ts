import { makeRung, inst, contact, series, parallel } from '../engine/factory';
import type { Rung } from '../engine/model';
import type { AnyMission, LadderMission, StMission } from './mission-types';

function ladder(m: Omit<LadderMission, 'kind'>): LadderMission {
  return { ...m, kind: 'ladder' };
}

function st(m: Omit<StMission, 'kind'>): StMission {
  return { ...m, kind: 'st' };
}

/* ------------------------------------------------------------------ */
/* Shift 1 — Basics                                                    */
/* ------------------------------------------------------------------ */

const starterMotorB: Rung[] = [
  makeRung(series(contact('XIC', 'Start_PB')), [inst('OTE', 'Motor')]),
];

const M1: LadderMission = ladder({
  id: 'm1',
  title: 'The Runaway Motor',
  codename: 'SHIFT-01',
  difficulty: 1,
  reward: 120,
  timeLimit: 0,
  brief:
    'Line 1 has a pump motor that should run only while the operator holds the Start button. Right now it latches on forever after one press — the night crew keeps flooding the sump.',
  fault: 'Motor stays ON after Start is released.',
  io: [
    { name: 'Start_PB', dataType: 'BOOL', note: 'Operator start button (momentary)' },
    { name: 'Motor', dataType: 'BOOL', note: 'Pump motor output' },
  ],
  machine: { type: 'motor', label: 'Sump Pump' },
  objectives: [
    { id: 'o1', text: 'Motor runs while Start_PB is held', requires: 'XIC' },
    { id: 'o2', text: 'Motor turns off when Start_PB is released' },
    { id: 'o3', text: 'Use an OTE (energize) coil on the motor' },
  ],
  hints: [
    { cost: 15, text: 'A rung passes power left to right. The coil mirrors whatever reaches it.' },
    { cost: 20, text: 'XIC Start_PB followed by OTE Motor gives you exactly a "follow the button" behaviour.' },
  ],
  tests: [
    {
      id: 't1',
      name: 'Motor follows the button',
      actions: [
        { set: { Start_PB: false }, ticks: 2, expect: { Motor: false }, label: 'Idle' },
        { set: { Start_PB: true }, ticks: 3, expect: { Motor: true }, label: 'Press start' },
        { set: { Start_PB: false }, ticks: 3, expect: { Motor: false }, label: 'Release' },
      ],
    },
  ],
  starter: 'XIC Start_PB  →  OTE Motor',
  buildStarter: () => starterMotorB,
});

const M2: LadderMission = ladder({
  id: 'm2',
  title: 'Seal the Deal',
  codename: 'SHIFT-02',
  difficulty: 1,
  reward: 150,
  timeLimit: 0,
  brief:
    'The conveyor on Line 2 needs a classic start/stop station: a momentary Start to run it, a Stop button to halt it, and it must stay running after Start is released.',
  fault: 'Conveyor needs a seal-in (latching) rung.',
  io: [
    { name: 'Start_PB', dataType: 'BOOL' },
    { name: 'Stop_PB', dataType: 'BOOL' },
    { name: 'Conveyor', dataType: 'BOOL' },
  ],
  machine: { type: 'conveyor', label: 'Conveyor 2' },
  objectives: [
    { id: 'o1', text: 'Start runs the conveyor and it latches on', requires: 'XIC' },
    { id: 'o2', text: 'Stop breaks the latch', requires: 'OTU|XIO' },
    { id: 'o3', text: 'The seal-in branch references the output itself' },
  ],
  hints: [
    { cost: 20, text: 'Put a branch in parallel with Start: one leg is Start_PB, the other is the Conveyor output.' },
    { cost: 25, text: 'Series: [ (Start ∥ Conveyor) · NOT Stop ] → OTE Conveyor.' },
  ],
  tests: [
    {
      id: 't1',
      name: 'Seal-in start/stop',
      actions: [
        { set: { Start_PB: false, Stop_PB: false }, ticks: 2, expect: { Conveyor: false }, label: 'Idle' },
        { set: { Start_PB: true }, ticks: 2 },
        { set: { Start_PB: false }, ticks: 2, expect: { Conveyor: true }, label: 'Stays running' },
        { set: { Stop_PB: true }, ticks: 3, expect: { Conveyor: false }, label: 'Stop pressed' },
        { set: { Stop_PB: false }, ticks: 3, expect: { Conveyor: false }, label: 'Stop released' },
      ],
    },
    {
      id: 't2',
      name: 'Restart works after stop',
      actions: [
        { set: { Stop_PB: true }, ticks: 2 },
        { set: { Start_PB: true, Stop_PB: false }, ticks: 2, expect: { Conveyor: true }, label: 'Restart' },
      ],
    },
  ],
  starter: 'XIC Start_PB  →  OTE Conveyor',
  buildStarter: () => [makeRung(series(contact('XIC', 'Start_PB')), [inst('OTE', 'Conveyor')])],
});

const M3: LadderMission = ladder({
  id: 'm3',
  title: 'Safety First',
  codename: 'SHIFT-03',
  difficulty: 2,
  reward: 200,
  timeLimit: 0,
  brief:
    'Now add the E-Stop. The machine must not run whenever the safety circuit is broken, and it must be impossible to seal in across a bad E-Stop.',
  fault: 'E-Stop is unwired — machine keeps running with the guard open.',
  io: [
    { name: 'Start_PB', dataType: 'BOOL' },
    { name: 'Stop_PB', dataType: 'BOOL' },
    { name: 'EStop_OK', dataType: 'BOOL', note: 'TRUE while the safety circuit is healthy' },
    { name: 'Motor', dataType: 'BOOL' },
  ],
  machine: { type: 'motor', label: 'Press Motor' },
  objectives: [
    { id: 'o1', text: 'Motor runs with the seal-in from Shift-02' },
    { id: 'o2', text: 'Opening the E-Stop drops the motor immediately' },
    { id: 'o3', text: 'Motor cannot restart until E-Stop is healthy' },
  ],
  hints: [
    { cost: 25, text: 'The E-Stop must be in SERIES with everything else, before the coil.' },
    { cost: 30, text: 'Use XIC EStop_OK in series. When it goes false, no path reaches the coil.' },
  ],
  tests: [
    {
      id: 't1',
      name: 'Normal start/stop',
      actions: [
        { set: { EStop_OK: true, Stop_PB: false }, ticks: 2 },
        { set: { Start_PB: true }, ticks: 2 },
        { set: { Start_PB: false }, ticks: 2, expect: { Motor: true }, label: 'Running' },
        { set: { Stop_PB: true }, ticks: 2, expect: { Motor: false } },
      ],
    },
    {
      id: 't2',
      name: 'E-Stop drops the motor',
      actions: [
        { set: { EStop_OK: true, Stop_PB: false, Start_PB: true }, ticks: 2 },
        { set: { Start_PB: false }, ticks: 2, expect: { Motor: true }, label: 'Running' },
        { set: { EStop_OK: false }, ticks: 2, expect: { Motor: false }, label: 'E-Stop opened' },
      ],
    },
    {
      id: 't3',
      name: 'Cannot start with bad E-Stop',
      actions: [
        { set: { EStop_OK: false }, ticks: 2 },
        { set: { Start_PB: true }, ticks: 3, expect: { Motor: false }, label: 'Start held, E-Stop bad' },
      ],
    },
  ],
  starter: 'XIC Start_PB  →  OTE Motor',
  buildStarter: () => [
    makeRung(
      series(parallel(series(contact('XIC', 'Start_PB'))), contact('XIC', 'EStop_OK')),
      [inst('OTE', 'Motor')],
    ),
  ],
});

const M4: LadderMission = ladder({
  id: 'm4',
  title: 'Fill It Up',
  codename: 'SHIFT-04',
  difficulty: 2,
  reward: 220,
  timeLimit: 0,
  brief:
    'Tank T-400 fills through an inlet valve. Open the valve when the level is LOW; close it when the level reaches HIGH. A simple float control, but wire it as a latch so the valve holds position.',
  fault: 'Inlet valve never closes — tank overflows every shift.',
  io: [
    { name: 'Low_Level', dataType: 'BOOL', note: 'TRUE when level is low' },
    { name: 'High_Level', dataType: 'BOOL', note: 'TRUE when level is high' },
    { name: 'Inlet_Valve', dataType: 'BOOL' },
  ],
  machine: { type: 'tank', label: 'Tank T-400' },
  objectives: [
    { id: 'o1', text: 'Low level opens the inlet valve' },
    { id: 'o2', text: 'High level closes the inlet valve' },
    { id: 'o3', text: 'Valve latches (OTL/OTU or seal-in)' },
  ],
  hints: [
    { cost: 30, text: 'Latch on Low_Level with OTL, unlatch on High_Level with OTU.' },
    { cost: 35, text: 'If you prefer a seal-in: (Inlet ∥ Low) · NOT High → OTE Inlet.' },
  ],
  tests: [
    {
      id: 't1',
      name: 'Fill control',
      actions: [
        { set: { Low_Level: false, High_Level: false }, ticks: 2 },
        { set: { Low_Level: true }, ticks: 2, expect: { Inlet_Valve: true }, label: 'Low → open' },
        { set: { Low_Level: false }, ticks: 2, expect: { Inlet_Valve: true }, label: 'Holds open' },
        { set: { High_Level: true }, ticks: 2, expect: { Inlet_Valve: false }, label: 'High → close' },
        { set: { High_Level: false }, ticks: 2, expect: { Inlet_Valve: false }, label: 'Holds closed' },
      ],
    },
  ],
  starter: '',
  buildStarter: () => [makeRung(series(contact('XIC', 'Low_Level')), [inst('OTE', 'Inlet_Valve')])],
});

/* ------------------------------------------------------------------ */
/* Shift 2 — Timers & sequences                                        */
/* ------------------------------------------------------------------ */

const M5: LadderMission = ladder({
  id: 'm5',
  title: 'Soft Start',
  codename: 'SHIFT-05',
  difficulty: 2,
  reward: 250,
  timeLimit: 0,
  brief:
    'The big gearbox must wait 2 seconds after the Start button before switching the motor on, so the lubricant pump can prime. Add a TON timer and drive the motor from its Done bit.',
  fault: 'Motor starts instantly, grinding the gearbox.',
  io: [
    { name: 'Start_PB', dataType: 'BOOL' },
    { name: 'Motor', dataType: 'BOOL' },
    { name: 'Prime_Timer', dataType: 'TIMER', preset: 2000, note: 'Preset 2000 ms' },
  ],
  machine: { type: 'motor', label: 'Gearbox Motor' },
  objectives: [
    { id: 'o1', text: 'Run a TON with a 2 s preset while Start is held' },
    { id: 'o2', text: 'Confirm with the .TT bit while timing' },
    { id: 'o3', text: 'Energize Motor from the .DN bit' },
  ],
  hints: [
    { cost: 30, text: 'TON: when the rung is true it counts ACC up to PRE and sets .DN.' },
    { cost: 35, text: 'Two rungs: [Start → TON Prime 2000], then [Prime.DN → OTE Motor].' },
  ],
  tests: [
    {
      id: 't1',
      name: 'Delayed start',
      actions: [
        { set: { Start_PB: true }, ticks: 5, expect: { Motor: false }, label: 'Still priming' },
        { ticks: 110, expect: { Motor: true }, label: 'After 2 s' },
        { set: { Start_PB: false }, ticks: 3, expect: { Motor: false }, label: 'Stop' },
      ],
    },
    {
      id: 't2',
      name: 'Timer resets on release',
      actions: [
        { set: { Start_PB: true }, ticks: 60 },
        { set: { Start_PB: false }, ticks: 3, expect: { Motor: false }, label: 'Reset' },
        { set: { Start_PB: true }, ticks: 5, expect: { Motor: false }, label: 'Re-primes from 0' },
      ],
    },
  ],
  starter: '',
  buildStarter: () => [makeRung(series(contact('XIC', 'Start_PB')), [inst('OTE', 'Motor')])],
});

const M6: LadderMission = ladder({
  id: 'm6',
  title: 'Three Blinks',
  codename: 'SHIFT-06',
  difficulty: 3,
  reward: 300,
  timeLimit: 0,
  brief:
    'The stack light should flash the Beacon three times when a part is detected, then stop. Use a self-resetting pulse timer and count the flashes; reset the count when the part clears.',
  fault: 'Beacon flashes forever, or never.',
  io: [
    { name: 'Part_Sensor', dataType: 'BOOL' },
    { name: 'Beacon', dataType: 'BOOL' },
    { name: 'Pulse_Timer', dataType: 'TIMER', preset: 250 },
    { name: 'Flash_Count', dataType: 'COUNTER', preset: 3 },
  ],
  machine: { type: 'conveyor', label: 'Part Feeder' },
  objectives: [
    { id: 'o1', text: 'Pulse the beacon with a TON that resets itself' },
    { id: 'o2', text: 'Count flashes with a CTU (preset 3)' },
    { id: 'o3', text: 'Stop the beacon once the count is done' },
  ],
  hints: [
    { cost: 45, text: 'A TON with its own .DN bit in series resets itself next scan and makes a repeating pulse.' },
    { cost: 50, text: 'Energize Beacon while the sensor is on AND the counter is not done; count on the pulse .DN.' },
  ],
  tests: [
    {
      id: 't1',
      name: 'Beacon flashes then stops',
      actions: [
        { set: { Part_Sensor: true }, ticks: 5, expect: { Beacon: true }, label: 'Flashing begins' },
        { ticks: 200, expect: { Beacon: false }, label: 'Stops after 3 flashes' },
        { set: { Part_Sensor: false }, ticks: 10, expect: { Beacon: false }, label: 'Stays off' },
      ],
    },
  ],
  starter: '',
  buildStarter: () => [],
});

const M7: LadderMission = ladder({
  id: 'm7',
  title: 'Green Wave',
  codename: 'SHIFT-07',
  difficulty: 3,
  reward: 340,
  timeLimit: 0,
  brief:
    'Build the traffic signal for the site entrance: it cycles Red → Green → Yellow → Red continuously while the Enable switch is on. Each phase lasts 2 seconds. Red must be first.',
  fault: 'Signal stuck on red.',
  io: [
    { name: 'Enable', dataType: 'BOOL' },
    { name: 'Red', dataType: 'BOOL' },
    { name: 'Green', dataType: 'BOOL' },
    { name: 'Yellow', dataType: 'BOOL' },
    { name: 'Seq_Timer', dataType: 'TIMER', preset: 2000 },
  ],
  machine: { type: 'trafficLight', label: 'Entrance Signal' },
  objectives: [
    { id: 'o1', text: 'Red is on at the start of the cycle' },
    { id: 'o2', text: 'Then Green, then Yellow, then back to Red' },
    { id: 'o3', text: 'Always exactly one lamp on' },
  ],
  hints: [
    { cost: 50, text: 'One timer drives the whole sequence if you reset it at each phase end.' },
    { cost: 55, text: 'A step counter (0..2) with CRESET, or use the timer done to rotate three latches.' },
  ],
  tests: [
    {
      id: 't1',
      name: 'Sequence starts on red',
      actions: [
        { set: { Enable: true }, ticks: 3, expect: { Red: true, Green: false, Yellow: false }, label: 'Red first' },
      ],
    },
    {
      id: 't2',
      name: 'Green then yellow',
      actions: [
        { set: { Enable: true }, ticks: 110, expect: { Green: true, Red: false, Yellow: false }, label: 'Phase 2' },
        { ticks: 110, expect: { Yellow: true, Green: false, Red: false }, label: 'Phase 3' },
        { ticks: 110, expect: { Red: true, Green: false, Yellow: false }, label: 'Back to red' },
      ],
    },
    {
      id: 't3',
      name: 'Disable turns it off',
      actions: [
        { set: { Enable: true }, ticks: 50 },
        { set: { Enable: false }, ticks: 5, expect: { Red: false, Green: false, Yellow: false }, label: 'All off' },
      ],
    },
  ],
  starter: '',
  buildStarter: () => [],
});

/* ------------------------------------------------------------------ */
/* Shift 3 — Interlocks & structured text                              */
/* ------------------------------------------------------------------ */

const M8: LadderMission = ladder({
  id: 'm8',
  title: 'Interlocked Pumps',
  codename: 'SHIFT-08',
  difficulty: 4,
  reward: 400,
  timeLimit: 0,
  brief:
    'Two parallel pumps feed the same line. Only one may run at a time — whichever is commanded first wins, the other must be blocked until the first stops. Classic mutually-exclusive interlock.',
  fault: 'Both pumps energize together and blow the breaker.',
  io: [
    { name: 'PumpA_Cmd', dataType: 'BOOL' },
    { name: 'PumpB_Cmd', dataType: 'BOOL' },
    { name: 'PumpA', dataType: 'BOOL' },
    { name: 'PumpB', dataType: 'BOOL' },
  ],
  machine: { type: 'motor', label: 'Pump A' },
  objectives: [
    { id: 'o1', text: 'A runs when A is commanded' },
    { id: 'o2', text: 'B cannot run while A runs (and vice versa)' },
    { id: 'o3', text: 'The blocked pump waits its turn' },
  ],
  hints: [
    { cost: 60, text: 'Cross-interlock: put NOT PumpB into the A rung and NOT PumpA into the B rung.' },
    { cost: 65, text: 'A = A_Cmd · NOT B ; B = B_Cmd · NOT A. Order of rungs decides priority.' },
  ],
  tests: [
    {
      id: 't1',
      name: 'Only one at a time',
      actions: [
        { set: { PumpA_Cmd: true, PumpB_Cmd: true }, ticks: 4, expect: { PumpA: true, PumpB: false }, label: 'A wins the race' },
        { set: { PumpA_Cmd: false }, ticks: 4, expect: { PumpA: false, PumpB: true }, label: 'A off → B runs' },
        { set: { PumpB_Cmd: false, PumpA_Cmd: true }, ticks: 4, expect: { PumpB: false, PumpA: true }, label: 'A runs alone' },
      ],
    },
  ],
  starter: '',
  buildStarter: () => [
    makeRung(series(contact('XIC', 'PumpA_Cmd')), [inst('OTE', 'PumpA')]),
    makeRung(series(contact('XIC', 'PumpB_Cmd')), [inst('OTE', 'PumpB')]),
  ],
});

const M9: StMission = st({
  id: 'm9',
  title: 'The Recipe Box',
  codename: 'SHIFT-09',
  difficulty: 4,
  reward: 450,
  timeLimit: 0,
  brief:
    'A mixing line runs one of three recipes selected by an integer. Write Structured Text that fills Target_Time with the right time (ms) and turns Heat on only for the hot recipe (3), otherwise off.',
  fault: 'Recipe selection ignored — always uses recipe 1.',
  io: [
    { name: 'Recipe', dataType: 'INT', note: '1 = cold mix, 2 = standard, 3 = hot mix' },
    { name: 'Target_Time', dataType: 'INT', note: 'Fill with ms for each recipe' },
    { name: 'Heat', dataType: 'BOOL' },
  ],
  objectives: [
    { id: 'o1', text: 'Recipe 1 → 60000 ms, no heat' },
    { id: 'o2', text: 'Recipe 2 → 90000 ms, no heat' },
    { id: 'o3', text: 'Recipe 3 → 120000 ms and Heat on' },
    { id: 'o4', text: 'Use a CASE statement' },
  ],
  hints: [
    { cost: 55, text: 'CASE Recipe OF 1: ...; 2: ...; 3: ...; END_CASE;' },
    { cost: 55, text: 'Set Heat := 0 for recipes 1 and 2, Heat := 1 only for 3.' },
  ],
  tests: [
    {
      id: 't1',
      name: 'Recipe 1',
      actions: [{ set: { Recipe: 1 }, ticks: 3, expect: { Target_Time: 60000, Heat: false } }],
    },
    {
      id: 't2',
      name: 'Recipe 2',
      actions: [{ set: { Recipe: 2 }, ticks: 3, expect: { Target_Time: 90000, Heat: false } }],
    },
    {
      id: 't3',
      name: 'Recipe 3',
      actions: [{ set: { Recipe: 3 }, ticks: 3, expect: { Target_Time: 120000, Heat: true } }],
    },
  ],
  starter: `// Fill in the recipe selection
CASE Recipe OF
  1: Target_Time := 0; Heat := 0;
  2: Target_Time := 0; Heat := 0;
  3: Target_Time := 0; Heat := 1;
END_CASE;
`,
});

const M10: StMission = st({
  id: 'm10',
  title: 'Alarm Averager',
  codename: 'SHIFT-10',
  difficulty: 5,
  reward: 600,
  timeLimit: 0,
  brief:
    'The historian needs statistics. Over a 10-element sample buffer, compute the running Sum, the Average, and raise High_Alarm when the average crosses the trip point. Use a FOR loop.',
  fault: 'Statistics block returns zero for every channel.',
  io: [
    {
      name: 'Sample',
      dataType: 'INT',
      note: 'Array of 10 readings (Sample[0..9])',
    },
    { name: 'Sum', dataType: 'INT' },
    { name: 'Average', dataType: 'INT' },
    { name: 'High_Alarm', dataType: 'BOOL' },
    { name: 'Trip_Point', dataType: 'INT', note: 'Alarm when Average > Trip_Point' },
  ],
  objectives: [
    { id: 'o1', text: 'Sum Sample[0..9]' },
    { id: 'o2', text: 'Average = Sum / 10' },
    { id: 'o3', text: 'High_Alarm when Average > Trip_Point' },
  ],
  hints: [
    { cost: 70, text: 'FOR i := 0 TO 9 DO Sum := Sum + Sample[i]; END_FOR;' },
    { cost: 70, text: 'Reset Sum and Average at the top of every scan before accumulating.' },
  ],
  tests: [
    {
      id: 't1',
      name: 'Average of a known set',
      actions: [
        {
          set: {
            'Sample[0]': 10,
            'Sample[1]': 20,
            'Sample[2]': 30,
            'Sample[3]': 40,
            'Sample[4]': 50,
            'Sample[5]': 60,
            'Sample[6]': 70,
            'Sample[7]': 80,
            'Sample[8]': 90,
            'Sample[9]': 100,
            Trip_Point: 200,
          },
          ticks: 3,
          expect: { Sum: 550, Average: 55, High_Alarm: false },
        },
      ],
    },
    {
      id: 't2',
      name: 'Trip point trips',
      actions: [
        {
          set: {
            'Sample[0]': 80,
            'Sample[1]': 80,
            'Sample[2]': 80,
            'Sample[3]': 80,
            'Sample[4]': 80,
            'Sample[5]': 80,
            'Sample[6]': 80,
            'Sample[7]': 80,
            'Sample[8]': 80,
            'Sample[9]': 80,
            Trip_Point: 60,
          },
          ticks: 3,
          expect: { High_Alarm: true },
        },
      ],
    },
  ],
  starter: `// Sum the samples, then average them
Sum := 0;
FOR I := 0 TO 9 DO
  Sum := Sum;
END_FOR;
Average := 0;
High_Alarm := 0;
`,
});

export const MISSIONS: AnyMission[] = [M1, M2, M3, M4, M5, M6, M7, M8, M9, M10];

export function missionById(id: string): AnyMission | undefined {
  return MISSIONS.find((m) => m.id === id);
}

export function missionArrayTag(mission: { id: string }): { name: string; size: number } | undefined {
  if (mission.id === 'm10') return { name: 'Sample', size: 10 };
  return undefined;
}
