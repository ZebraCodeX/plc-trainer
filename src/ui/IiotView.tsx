import { useEffect, useMemo, useState } from 'react';
import { useStore } from '../store/store';
import { useScanCount } from '../store/hooks';
import { bridge, broker } from '../store/bridge';
import { ModbusSim, AREA_LABELS, AREA_BASE, absoluteAddress } from '../engine/modbus';
import type { ModbusArea } from '../engine/model';
import type { MqttMessage } from '../engine/mqtt';
import { uid } from '../engine/uid';
import { TagInput } from './TagInput';
import { Guide } from './Guide';

const AREAS: ModbusArea[] = ['coil', 'discrete', 'input', 'holding'];

export function IiotView() {
  const { project, applyEdit, engine } = useStore();
  useScanCount();
  const [pattern, setPattern] = useState('#');
  const [messages, setMessages] = useState<MqttMessage[]>([]);
  const [status, setStatus] = useState(bridge.status);
  const [modbusAddr, setModbusAddr] = useState(1);
  const [modbusWrite, setModbusWrite] = useState(1);
  const [modbusResult, setModbusResult] = useState('—');

  const sim = useMemo(() => new ModbusSim(project.iiot.modbus), [project.iiot.modbus]);

  useEffect(() => {
    setMessages([...broker.log].slice(-200));
    const unsub = broker.subscribe(pattern, (msg) => {
      setMessages((prev) => [...prev.slice(-199), msg]);
    });
    return unsub;
  }, [pattern]);

  useEffect(() => {
    const listener = (s: typeof status) => setStatus(s);
    bridge.statusListeners.add(listener);
    return () => {
      bridge.statusListeners.delete(listener);
    };
  }, []);

  function addRule() {
    applyEdit((p) => {
      p.iiot.mqttPublish.push({ id: uid('mq'), tag: '', topic: `plc/${project.name.toLowerCase().replace(/\s+/g, '_')}/tag` });
      p.iiot.mqttEnabled = true;
    }, 'content');
  }

  function updateRule(id: string, patch: Partial<{ tag: string; topic: string }>) {
    applyEdit((p) => {
      const r = p.iiot.mqttPublish.find((x) => x.id === id);
      if (r) Object.assign(r, patch);
    }, 'content');
  }

  function removeRule(id: string) {
    applyEdit((p) => {
      p.iiot.mqttPublish = p.iiot.mqttPublish.filter((r) => r.id !== id);
    }, 'content');
  }

  function addMapping() {
    applyEdit((p) => {
      p.iiot.modbus.push({ id: uid('mb'), tag: '', area: 'holding', address: sim.nextAddress('holding') });
    }, 'content');
  }

  function updateMapping(id: string, patch: Partial<{ tag: string; area: ModbusArea; address: number }>) {
    applyEdit((p) => {
      const m = p.iiot.modbus.find((x) => x.id === id);
      if (m) Object.assign(m, patch);
    }, 'content');
  }

  function removeMapping(id: string) {
    applyEdit((p) => {
      p.iiot.modbus = p.iiot.modbus.filter((m) => m.id !== id);
    }, 'content');
  }

  function doRead() {
    const v = sim.read(modbusAddr, (ref) => engine.db.readScalar(ref));
    setModbusResult(v === undefined ? 'no mapping / tag' : String(v));
  }

  function doWrite() {
    const ok = sim.write(modbusAddr, modbusWrite, (ref, val) => engine.db.writeScalar(ref, val));
    setModbusResult(ok ? `wrote ${modbusWrite}` : 'no mapping');
  }

  return (
    <div className="col">
      <div className="toolbar">
        <h3 style={{ margin: 0 }}>IIoT Gateway</h3>
        <label className="pill">
          <input
            type="checkbox"
            checked={project.iiot.mqttEnabled}
            onChange={(e) =>
              applyEdit((p) => {
                p.iiot.mqttEnabled = e.target.checked;
              }, 'content')
            }
          />
          Publish tags to MQTT
        </label>
        <label className="pill">
          <input
            type="checkbox"
            checked={project.iiot.useRealBroker}
            onChange={(e) =>
              applyEdit((p) => {
                p.iiot.useRealBroker = e.target.checked;
              }, 'content')
            }
          />
          Use real broker
        </label>
      </div>

      <Guide title="How the IIoT gateway works" defaultOpen>
        <ul className="bullets">
          <li>
            <b>MQTT Publish Rules</b> link a tag to a topic. Whenever the tag changes, its value is
            published. Topics use <span className="mono">/</span> levels, e.g.{' '}
            <span className="mono">plant/line1/motor/speed</span>.
          </li>
          <li>
            The app runs a <b>built-in broker</b> so it works offline. Toggle <b>Use real broker</b>{' '}
            and Connect to publish to your own broker (e.g. Mosquitto/HiveMQ) over WebSockets.
          </li>
          <li>
            The <b>MQTT Monitor</b> subscribes to a topic filter. Use <span className="mono">+</span>{' '}
            for one level and <span className="mono">#</span> for many, e.g.{' '}
            <span className="mono">plant/#</span>. Retained messages are shown on subscribe.
          </li>
          <li>
            <b>Modbus Register Map</b> exposes tags as coils (0x), discrete inputs (1x), input
            registers (3x) or holding registers (4x). Use the <b>Client Simulator</b> to read/write
            by absolute address.
          </li>
        </ul>
      </Guide>

      <div className="grid2">
        <div className="panel">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <h3 style={{ margin: 0 }}>MQTT Publish Rules</h3>
            <button onClick={addRule}>+ Rule</button>
          </div>
          <span className="muted small">Tag values are published to the topic whenever they change.</span>
          <table style={{ marginTop: 8 }}>
            <thead>
              <tr>
                <th>Tag</th>
                <th>Topic</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {project.iiot.mqttPublish.map((r) => (
                <tr key={r.id}>
                  <td>
                    <TagInput value={r.tag} onChange={(v) => updateRule(r.id, { tag: v })} width={130} />
                  </td>
                  <td>
                    <input
                      className="mono"
                      style={{ width: '100%' }}
                      value={r.topic}
                      onChange={(e) => updateRule(r.id, { topic: e.target.value })}
                    />
                  </td>
                  <td>
                    <button className="danger" onClick={() => removeRule(r.id)}>
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="panel">
          <h3>Broker Connection</h3>
          <div className="row">
            <span className="pill">
              <span
                className={`dot ${
                  status === 'connected' ? 'on' : status === 'error' ? 'err' : ''
                }`}
              />
              local sim: {broker.log.length} msgs
            </span>
            <span className="pill">real: {status}</span>
          </div>
          <label className="col" style={{ gap: 3, marginTop: 8 }}>
            <span className="muted small">Broker URL (WebSocket)</span>
            <input
              className="mono"
              value={project.iiot.brokerUrl}
              onChange={(e) =>
                applyEdit((p) => {
                  p.iiot.brokerUrl = e.target.value;
                }, 'content')
              }
            />
          </label>
          <label className="col" style={{ gap: 3, marginTop: 8 }}>
            <span className="muted small">Client ID</span>
            <input
              className="mono"
              value={project.iiot.clientId}
              onChange={(e) =>
                applyEdit((p) => {
                  p.iiot.clientId = e.target.value;
                }, 'content')
              }
            />
          </label>
          <div className="row" style={{ marginTop: 8 }}>
            <button
              className="primary"
              onClick={() => bridge.connectReal(project.iiot.brokerUrl, project.iiot.clientId)}
            >
              Connect
            </button>
            <button onClick={() => bridge.disconnectReal()}>Disconnect</button>
          </div>
          {bridge.lastError && <div className="small" style={{ color: 'var(--red)' }}>{bridge.lastError}</div>}
          <div className="muted small" style={{ marginTop: 6 }}>
            The built-in broker always works offline. The real broker uses mqtt.js over WebSockets.
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <h3 style={{ margin: 0 }}>MQTT Monitor</h3>
          <div className="row">
            <label className="pill">
              Topic filter
              <input
                className="mono"
                style={{ width: 200 }}
                value={pattern}
                onChange={(e) => setPattern(e.target.value)}
              />
            </label>
            <button onClick={() => broker.clearLog()}>Clear</button>
          </div>
        </div>
        <div className="mqtt-log">
          {messages.length === 0 && <div className="muted">No messages. Run the PLC with publish rules configured.</div>}
          {messages.map((m, i) => (
            <div key={i}>
              <span className="muted">{new Date(m.time).toLocaleTimeString()} </span>
              <span className="topic">{m.topic}</span> = <span className="payload">{m.payload}</span>
              {m.retain && <span className="badge" style={{ marginLeft: 6 }}>retained</span>}
            </div>
          ))}
        </div>
      </div>

      <div className="grid2">
        <div className="panel">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <h3 style={{ margin: 0 }}>Modbus Register Map</h3>
            <button onClick={addMapping}>+ Mapping</button>
          </div>
          <table>
            <thead>
              <tr>
                <th>Area</th>
                <th>Addr</th>
                <th>Absolute</th>
                <th>Tag</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {project.iiot.modbus.map((m) => (
                <tr key={m.id}>
                  <td>
                    <select
                      value={m.area}
                      onChange={(e) => updateMapping(m.id, { area: e.target.value as ModbusArea })}
                    >
                      {AREAS.map((a) => (
                        <option key={a} value={a}>
                          {AREA_LABELS[a]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <input
                      type="number"
                      style={{ width: 70 }}
                      value={m.address}
                      onChange={(e) => updateMapping(m.id, { address: Number(e.target.value) })}
                    />
                  </td>
                  <td className="mono">{absoluteAddress(m)}</td>
                  <td>
                    <TagInput value={m.tag} onChange={(v) => updateMapping(m.id, { tag: v })} width={130} />
                  </td>
                  <td>
                    <button className="danger" onClick={() => removeMapping(m.id)}>
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {project.iiot.modbus.length === 0 && (
            <div className="muted small">Add mappings to expose PLC tags as Modbus registers.</div>
          )}
        </div>

        <div className="panel">
          <h3>Modbus Client Simulator</h3>
          <div className="row">
            <label className="pill">
              Address
              <input
                type="number"
                style={{ width: 90 }}
                value={modbusAddr}
                onChange={(e) => setModbusAddr(Number(e.target.value))}
              />
            </label>
            <button onClick={doRead}>Read</button>
            <label className="pill">
              Write
              <input
                type="number"
                style={{ width: 80 }}
                value={modbusWrite}
                onChange={(e) => setModbusWrite(Number(e.target.value))}
              />
            </label>
            <button onClick={doWrite}>Write</button>
          </div>
          <div style={{ marginTop: 8 }}>
            Result: <span className="tag-value mono">{modbusResult}</span>
          </div>
          <table style={{ marginTop: 8 }}>
            <thead>
              <tr>
                <th>Base</th>
                <th>Range</th>
              </tr>
            </thead>
            <tbody>
              {AREAS.map((a) => (
                <tr key={a}>
                  <td>{AREA_LABELS[a]}</td>
                  <td className="mono">
                    {AREA_BASE[a]} – {AREA_BASE[a] + 9999}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
