import type { IoModule, ModuleKind } from './model';

export interface ModuleCatalogEntry {
  catalog: string;
  kind: ModuleKind;
  channels: number;
  description: string;
  rawMin: number;
  rawMax: number;
}

export const MODULE_CATALOG: ModuleCatalogEntry[] = [
  { catalog: '1756-IB16', kind: 'DI', channels: 16, description: '16-point 24V DC digital input', rawMin: 0, rawMax: 1 },
  { catalog: '1756-OB16E', kind: 'DO', channels: 16, description: '16-point 24V DC digital output', rawMin: 0, rawMax: 1 },
  { catalog: '1756-IF8', kind: 'AI', channels: 8, description: '8-channel analog input', rawMin: 0, rawMax: 32767 },
  { catalog: '1756-OF8', kind: 'AO', channels: 8, description: '8-channel analog output', rawMin: 0, rawMax: 32767 },
  { catalog: '1756-IR6I', kind: 'AI', channels: 6, description: '6-channel isolated RTD input', rawMin: 0, rawMax: 32767 },
];

export function getCatalog(catalog: string): ModuleCatalogEntry | undefined {
  return MODULE_CATALOG.find((m) => m.catalog === catalog);
}

let moduleSeq = 0;
export function nextModuleId(): string {
  moduleSeq += 1;
  return `mod_${Date.now().toString(36)}_${moduleSeq}`;
}

export function channelTagName(kind: ModuleKind, slot: number, channel: number): string {
  const slotPart = `Local_${slot}`;
  switch (kind) {
    case 'DI':
      return `${slotPart}_In_${channel}`;
    case 'DO':
      return `${slotPart}_Out_${channel}`;
    case 'AI':
      return `${slotPart}_AI_${channel}`;
    case 'AO':
      return `${slotPart}_AO_${channel}`;
  }
}

export function makeModule(catalog: string, slot: number): IoModule {
  const entry = getCatalog(catalog);
  if (!entry) throw new Error(`Unknown catalog ${catalog}`);
  const channels = [];
  for (let c = 0; c < entry.channels; c++) {
    channels.push({ channel: c, tagName: channelTagName(entry.kind, slot, c) });
  }
  return {
    id: nextModuleId(),
    slot,
    catalog,
    kind: entry.kind,
    channels,
    rawMin: entry.rawMin,
    rawMax: entry.rawMax,
    engMin: 0,
    engMax: 100,
  };
}

export function scaleRawToEng(module: IoModule, raw: number): number {
  const span = module.rawMax - module.rawMin || 1;
  const pct = (raw - module.rawMin) / span;
  return module.engMin + pct * (module.engMax - module.engMin);
}

export function scaleEngToRaw(module: IoModule, eng: number): number {
  const span = module.engMax - module.engMin || 1;
  const pct = (eng - module.engMin) / span;
  return Math.round(module.rawMin + pct * (module.rawMax - module.rawMin));
}
