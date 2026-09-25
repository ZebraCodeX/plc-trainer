import type { MqttRule } from './model';

export interface MqttMessage {
  topic: string;
  payload: string;
  retain: boolean;
  time: number;
}

export type MqttHandler = (msg: MqttMessage) => void;

export function topicMatches(pattern: string, topic: string): boolean {
  const p = pattern.split('/');
  const t = topic.split('/');
  for (let i = 0; i < p.length; i++) {
    if (p[i] === '#') return true;
    if (i >= t.length) return false;
    if (p[i] !== '+' && p[i] !== t[i]) return false;
  }
  return p.length === t.length;
}

/**
 * In-browser MQTT broker simulation. Supports the topic tree, `+` / `#`
 * wildcards, retained messages and QoS 0/1 semantics (delivery is synchronous).
 */
export class MqttBroker {
  private retained = new Map<string, MqttMessage>();
  private subs = new Map<string, Set<MqttHandler>>();
  log: MqttMessage[] = [];
  maxLog = 500;

  publish(topic: string, payload: string, retain = false, qos: 0 | 1 = 0): void {
    const msg: MqttMessage = { topic, payload, retain, time: Date.now() };
    void qos;
    if (retain) this.retained.set(topic, msg);
    this.appendLog(msg);
    for (const [pattern, handlers] of this.subs) {
      if (topicMatches(pattern, topic)) {
        for (const h of handlers) h(msg);
      }
    }
  }

  subscribe(pattern: string, handler: MqttHandler): () => void {
    let set = this.subs.get(pattern);
    if (!set) {
      set = new Set();
      this.subs.set(pattern, set);
    }
    set.add(handler);
    for (const msg of this.retained.values()) {
      if (topicMatches(pattern, msg.topic)) handler(msg);
    }
    return () => {
      set?.delete(handler);
      if (set && set.size === 0) this.subs.delete(pattern);
    };
  }

  private appendLog(msg: MqttMessage): void {
    this.log.push(msg);
    if (this.log.length > this.maxLog) this.log.splice(0, this.log.length - this.maxLog);
  }

  clearLog(): void {
    this.log = [];
  }
}

export type BrokerStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

/**
 * Bridges PLC tags to MQTT topics. Always publishes to the in-browser broker and,
 * when enabled, to a real broker over WebSockets via mqtt.js (loaded lazily).
 */
export class MqttBridge {
  broker: MqttBroker;
  status: BrokerStatus = 'disconnected';
  lastError = '';
  statusListeners = new Set<(s: BrokerStatus) => void>();
  private last = new Map<string, string>();
  private client: unknown = null;

  constructor(broker: MqttBroker) {
    this.broker = broker;
  }

  private setStatus(s: BrokerStatus): void {
    this.status = s;
    for (const l of this.statusListeners) l(s);
  }

  async connectReal(url: string, clientId: string): Promise<void> {
    this.setStatus('connecting');
    try {
      const mqtt = await import('mqtt');
      const client = mqtt.connect(url, { clientId, reconnectPeriod: 3000 });
      this.client = client;
      client.on('connect', () => this.setStatus('connected'));
      client.on('reconnect', () => this.setStatus('connecting'));
      client.on('close', () => this.setStatus('disconnected'));
      client.on('error', (err: Error) => {
        this.lastError = err.message;
        this.setStatus('error');
      });
    } catch (err) {
      this.lastError = err instanceof Error ? err.message : String(err);
      this.setStatus('error');
    }
  }

  disconnectReal(): void {
    const c = this.client as { end?: (force?: boolean) => void } | null;
    c?.end?.(true);
    this.client = null;
    this.setStatus('disconnected');
  }

  /** Publish tag values to their configured topics, only on change. */
  publishFromRules(rules: MqttRule[], read: (tag: string) => number | boolean | undefined): void {
    for (const rule of rules) {
      const value = read(rule.tag);
      if (value === undefined) continue;
      const payload = typeof value === 'boolean' ? (value ? '1' : '0') : String(value);
      if (this.last.get(rule.id) === payload) continue;
      this.last.set(rule.id, payload);
      this.broker.publish(rule.topic, payload, true, 0);
      const c = this.client as { connected?: boolean; publish?: (t: string, p: string, o?: object, cb?: () => void) => void } | null;
      if (c?.connected && c.publish) {
        c.publish(rule.topic, payload, { retain: true, qos: 0 });
      }
    }
  }
}
