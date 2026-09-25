import type { ModbusArea, ModbusMapping } from './model';

export interface ModbusRegister {
  area: ModbusArea;
  address: number;
  mapping: ModbusMapping;
}

export const AREA_LABELS: Record<ModbusArea, string> = {
  coil: 'Coil (0x)',
  discrete: 'Discrete Input (1x)',
  holding: 'Holding Register (4x)',
  input: 'Input Register (3x)',
};

export const AREA_BASE: Record<ModbusArea, number> = {
  coil: 1,
  discrete: 10001,
  input: 30001,
  holding: 40001,
};

export function absoluteAddress(m: ModbusMapping): number {
  return AREA_BASE[m.area] + m.address;
}

/** Simulated Modbus client: reads/writes tags through the mapping table. */
export class ModbusSim {
  constructor(private mappings: ModbusMapping[]) {}

  setMappings(m: ModbusMapping[]): void {
    this.mappings = m;
  }

  findByAddress(absolute: number): ModbusMapping | undefined {
    return this.mappings.find((m) => absoluteAddress(m) === absolute);
  }

  read(
    absolute: number,
    readTag: (ref: string) => number | boolean | undefined,
  ): number | undefined {
    const m = this.findByAddress(absolute);
    if (!m) return undefined;
    const v = readTag(m.tag);
    if (v === undefined) return undefined;
    return typeof v === 'boolean' ? (v ? 1 : 0) : v;
  }

  write(absolute: number, value: number, writeTag: (ref: string, v: number) => void): boolean {
    const m = this.findByAddress(absolute);
    if (!m) return false;
    writeTag(m.tag, value);
    return true;
  }

  /** Next free address for an area. */
  nextAddress(area: ModbusArea): number {
    const used = this.mappings.filter((m) => m.area === area).map((m) => m.address);
    return used.length ? Math.max(...used) + 1 : 0;
  }
}
