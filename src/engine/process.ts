import type { ProcessType } from './model';

export interface TerminalDef {
  key: string;
  label: string;
  /** 'in' = PLC drives the component. 'out' = component drives the PLC. */
  dir: 'in' | 'out';
  type: 'BOOL' | 'REAL';
}

export interface ProcessDef {
  type: ProcessType;
  label: string;
  terminals: TerminalDef[];
  defaults: Record<string, number | string | boolean>;
}

const T = (key: string, label: string, dir: 'in' | 'out', type: 'BOOL' | 'REAL'): TerminalDef => ({
  key,
  label,
  dir,
  type,
});

export const PROCESS_DEFS: Record<ProcessType, ProcessDef> = {
  motor: {
    type: 'motor',
    label: 'Motor',
    terminals: [T('cmd', 'Run Command', 'in', 'BOOL'), T('fault', 'Fault', 'in', 'BOOL'), T('run', 'Running', 'out', 'BOOL'), T('speed', 'Speed', 'out', 'REAL')],
    defaults: { rpm: 1750, startupDelay: 0.5, rampTime: 1.5 },
  },
  conveyor: {
    type: 'conveyor',
    label: 'Conveyor',
    terminals: [T('run', 'Run', 'in', 'BOOL'), T('boxSensor', 'Box Sensor', 'out', 'BOOL'), T('speed', 'Belt Speed', 'out', 'REAL')],
    defaults: { speed: 0.6, boxInterval: 2, sensorPos: 0.8 },
  },
  tank: {
    type: 'tank',
    label: 'Tank',
    terminals: [T('inlet', 'Inlet Valve', 'in', 'BOOL'), T('outlet', 'Outlet Valve', 'in', 'BOOL'), T('level', 'Level %', 'out', 'REAL'), T('high', 'High Level', 'out', 'BOOL'), T('low', 'Low Level', 'out', 'BOOL')],
    defaults: { capacity: 100, inletRate: 8, outletRate: 6, highPct: 80, lowPct: 20 },
  },
  valve: {
    type: 'valve',
    label: 'Valve',
    terminals: [T('openCmd', 'Open Cmd', 'in', 'BOOL'), T('closeCmd', 'Close Cmd', 'in', 'BOOL'), T('opened', 'Opened', 'out', 'BOOL'), T('closed', 'Closed', 'out', 'BOOL')],
    defaults: { travelTime: 1 },
  },
  pump: {
    type: 'pump',
    label: 'Pump',
    terminals: [T('run', 'Run', 'in', 'BOOL'), T('running', 'Running', 'out', 'BOOL'), T('flow', 'Flow', 'out', 'REAL')],
    defaults: { rate: 12, ramp: 1 },
  },
  trafficLight: {
    type: 'trafficLight',
    label: 'Traffic Light',
    terminals: [T('red', 'Red Lamp', 'in', 'BOOL'), T('yellow', 'Yellow Lamp', 'in', 'BOOL'), T('green', 'Green Lamp', 'in', 'BOOL')],
    defaults: {},
  },
  heater: {
    type: 'heater',
    label: 'Heater',
    terminals: [T('on', 'Heater On', 'in', 'BOOL'), T('temp', 'Temperature', 'out', 'REAL'), T('heaterOn', 'Heating', 'out', 'BOOL')],
    defaults: { ambient: 20, heatRate: 6, coolRate: 1.2, maxTemp: 250 },
  },
  fan: {
    type: 'fan',
    label: 'Fan',
    terminals: [T('run', 'Run', 'in', 'BOOL'), T('running', 'Running', 'out', 'BOOL'), T('airflow', 'Airflow', 'out', 'REAL')],
    defaults: { maxAirflow: 100, ramp: 1.5 },
  },
  sensor: {
    type: 'sensor',
    label: 'Sensor',
    terminals: [T('value', 'Value', 'out', 'REAL')],
    defaults: { min: 0, max: 100, value: 0, unit: '' },
  },
  counter: {
    type: 'counter',
    label: 'Numeric Display',
    terminals: [T('value', 'Value', 'in', 'REAL')],
    defaults: {},
  },
};

export type ProcessState = Record<string, number | number[]>;

export interface ProcessApi {
  read: (ref: string | undefined) => number;
  readBool: (ref: string | undefined) => boolean;
  write: (ref: string | undefined, value: number | boolean) => void;
  /** dt in milliseconds. */
  dt: number;
}

export function initialProcessState(type: ProcessType): ProcessState {
  switch (type) {
    case 'motor':
      return { timer: 0, run: 0, speed: 0 };
    case 'conveyor':
      return { spawnTimer: 99, pulse: 0, belt: 0 };
    case 'tank':
      return { level: 30 };
    case 'valve':
      return { position: 0 };
    case 'pump':
      return { flow: 0 };
    case 'heater':
      return { temp: 20 };
    case 'fan':
      return { airflow: 0 };
    default:
      return {};
  }
}

const num = (v: unknown, fallback: number): number => (typeof v === 'number' ? v : fallback);

export function tickProcess(
  type: ProcessType,
  props: Record<string, number | string | boolean>,
  bind: Record<string, string>,
  s: ProcessState,
  api: ProcessApi,
): void {
  const ds = api.dt / 1000;

  switch (type) {
    case 'motor': {
      const rpm = num(props.rpm, 1750);
      const delay = num(props.startupDelay, 0.5);
      const ramp = Math.max(num(props.rampTime, 1.5), 0.01);
      const cmd = api.readBool(bind.cmd);
      const fault = api.readBool(bind.fault);
      if (fault) {
        s.run = 0;
        s.timer = 0;
      } else if (cmd) {
        s.timer = num(s.timer, 0) + ds;
        if (num(s.timer, 0) >= delay) s.run = 1;
      } else {
        s.run = 0;
        s.timer = 0;
      }
      const target = s.run ? rpm : 0;
      const step = (rpm / ramp) * ds;
      const cur = num(s.speed, 0);
      s.speed = Math.abs(target - cur) <= step ? target : cur + Math.sign(target - cur) * step;
      api.write(bind.run, !!s.run);
      api.write(bind.speed, Math.round(num(s.speed, 0)));
      break;
    }
    case 'conveyor': {
      const speed = num(props.speed, 0.6);
      const interval = Math.max(num(props.boxInterval, 2), 0.2);
      const run = api.readBool(bind.run);
      s.pulse = 0;
      if (run) {
        s.belt = (num(s.belt, 0) + 1) % 4;
        s.spawnTimer = num(s.spawnTimer, 0) + ds;
        if (num(s.spawnTimer, 0) >= interval) {
          s.spawnTimer = 0;
          s.pulse = 1;
        }
      }
      api.write(bind.boxSensor, !!s.pulse);
      api.write(bind.speed, run ? speed : 0);
      break;
    }
    case 'tank': {
      const cap = Math.max(num(props.capacity, 100), 1);
      const inRate = num(props.inletRate, 8);
      const outRate = num(props.outletRate, 6);
      const high = num(props.highPct, 80);
      const low = num(props.lowPct, 20);
      let level = num(s.level, 0);
      if (api.readBool(bind.inlet)) level += (inRate / cap) * 100 * ds;
      if (api.readBool(bind.outlet)) level -= (outRate / cap) * 100 * ds;
      level = Math.max(0, Math.min(100, level));
      s.level = level;
      api.write(bind.level, Math.round(level * 10) / 10);
      api.write(bind.high, level >= high);
      api.write(bind.low, level <= low);
      break;
    }
    case 'valve': {
      const travel = Math.max(num(props.travelTime, 1), 0.05);
      const open = api.readBool(bind.openCmd);
      const close = api.readBool(bind.closeCmd);
      let pos = num(s.position, 0);
      if (open && !close) pos += ds / travel;
      else if (close && !open) pos -= ds / travel;
      pos = Math.max(0, Math.min(1, pos));
      s.position = pos;
      api.write(bind.opened, pos >= 0.999);
      api.write(bind.closed, pos <= 0.001);
      break;
    }
    case 'pump': {
      const rate = num(props.rate, 12);
      const ramp = Math.max(num(props.ramp, 1), 0.01);
      const run = api.readBool(bind.run);
      const target = run ? rate : 0;
      const step = (rate / ramp) * ds;
      const cur = num(s.flow, 0);
      s.flow = Math.abs(target - cur) <= step ? target : cur + Math.sign(target - cur) * step;
      api.write(bind.flow, Math.round(num(s.flow, 0) * 10) / 10);
      api.write(bind.running, num(s.flow, 0) > 0.1);
      break;
    }
    case 'trafficLight':
      break;
    case 'heater': {
      const ambient = num(props.ambient, 20);
      const heat = num(props.heatRate, 6);
      const cool = num(props.coolRate, 1.2);
      const max = num(props.maxTemp, 250);
      const on = api.readBool(bind.on);
      let temp = num(s.temp, ambient);
      temp += (on ? heat : -cool) * ds;
      temp = Math.max(ambient, Math.min(max, temp));
      s.temp = temp;
      api.write(bind.temp, Math.round(temp * 10) / 10);
      api.write(bind.heaterOn, on);
      break;
    }
    case 'fan': {
      const max = num(props.maxAirflow, 100);
      const ramp = Math.max(num(props.ramp, 1.5), 0.01);
      const run = api.readBool(bind.run);
      const target = run ? max : 0;
      const step = (max / ramp) * ds;
      const cur = num(s.airflow, 0);
      s.airflow = Math.abs(target - cur) <= step ? target : cur + Math.sign(target - cur) * step;
      api.write(bind.airflow, Math.round(num(s.airflow, 0)));
      api.write(bind.running, num(s.airflow, 0) > 1);
      break;
    }
    case 'sensor': {
      api.write(bind.value, num(s.value, num(props.value, 0)));
      break;
    }
    case 'counter': {
      break;
    }
  }
}
