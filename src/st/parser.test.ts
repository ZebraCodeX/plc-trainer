import { describe, it, expect } from 'vitest';
import { parseSt } from './parser';
import { evalExpression } from '../engine/expr';
import { MqttBroker, topicMatches } from '../engine/mqtt';
import { ModbusSim } from '../engine/modbus';
import type { ModbusMapping } from '../engine/model';

describe('ST parser', () => {
  it('parses without diagnostics', () => {
    const src = `
      IF a > 3 THEN
        x := 1;
      ELSIF a = 3 THEN
        x := 2;
      ELSE
        x := 0;
      END_IF;
      CASE mode OF
        1: y := 10;
        2,3: y := 20;
        ELSE y := 0;
      END_CASE;
      FOR i := 1 TO 10 BY 2 DO
        z := z + i;
      END_FOR;
      WHILE a < 5 DO a := a + 1; END_WHILE;
    `;
    const { program, diagnostics } = parseSt(src);
    expect(diagnostics.filter((d) => d.severity === 'error')).toHaveLength(0);
    expect(program.body.length).toBe(4);
  });

  it('reports an error for unbalanced IF', () => {
    const { diagnostics } = parseSt('IF a THEN x := 1;');
    expect(diagnostics.length).toBeGreaterThan(0);
  });
});

describe('expressions', () => {
  it('evaluates arithmetic with functions', () => {
    const v = evalExpression('SQRT(16) + 2 * (3 - 1)', { resolve: () => 0 });
    expect(v).toBe(8);
  });

  it('resolves identifiers', () => {
    const v = evalExpression('a * 2 + b', { resolve: (n) => (n === 'a' ? 3 : 4) });
    expect(v).toBe(10);
  });
});

describe('MQTT broker', () => {
  it('matches wildcards', () => {
    expect(topicMatches('plant/+/temp', 'plant/line1/temp')).toBe(true);
    expect(topicMatches('plant/#', 'plant/line1/temp')).toBe(true);
    expect(topicMatches('plant/+/temp', 'plant/line1/hum')).toBe(false);
  });

  it('delivers retained and live messages', () => {
    const broker = new MqttBroker();
    const received: string[] = [];
    broker.publish('a/b', '1', true);
    const unsub = broker.subscribe('a/#', (m) => received.push(m.payload));
    broker.publish('a/c', '2');
    unsub();
    broker.publish('a/d', '3');
    expect(received).toEqual(['1', '2']);
  });
});

describe('Modbus simulation', () => {
  const mappings: ModbusMapping[] = [
    { id: 'm1', tag: 'Run', area: 'coil', address: 0 },
    { id: 'm2', tag: 'Level', area: 'holding', address: 0 },
  ];

  it('reads and writes through the map', () => {
    const sim = new ModbusSim(mappings);
    const store: Record<string, number | boolean> = { Run: false, Level: 42 };
    expect(sim.read(1, (r) => store[r])).toBe(0);
    expect(sim.read(40001, (r) => store[r])).toBe(42);
    sim.write(1, 1, (r, v) => (store[r] = v));
    expect(store.Run).toBe(1);
    expect(sim.read(99999, () => 0)).toBeUndefined();
  });
});
