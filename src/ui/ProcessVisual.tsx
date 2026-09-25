import { useEngine, useScanCount } from '../store/hooks';
import type { ProcessComponent } from '../engine/model';

interface Props {
  comp: ProcessComponent;
}

function useReads(comp: ProcessComponent) {
  const engine = useEngine();
  useScanCount();
  const state = engine.getProcessState(comp.id) ?? {};
  const read = (key: string) => {
    const ref = comp.bindings[key];
    return ref ? engine.db.readScalar(ref) : undefined;
  };
  return {
    bool: (key: string) => read(key) === true,
    num: (key: string) => (typeof read(key) === 'number' ? (read(key) as number) : 0),
    state,
    engine,
  };
}

/**
 * Pseudo-3D isometric machinery rendered with layered CSS + SVG. Each visual is
 * driven entirely by the bound tags, so the animation reflects the program.
 */
export function ProcessVisual({ comp }: Props) {
  const { bool, num, state, engine } = useReads(comp);

  switch (comp.type) {
    case 'motor':
      return <MotorVisual running={bool('run')} rpm={num('speed')} />;
    case 'conveyor':
      return <ConveyorVisual moving={bool('run')} box={bool('boxSensor')} />;
    case 'tank':
      return (
        <TankVisual
          level={num('level')}
          inlet={bool('inlet')}
          outlet={bool('outlet')}
          high={bool('high')}
          low={bool('low')}
        />
      );
    case 'valve':
      return <ValveVisual opened={bool('opened')} closed={bool('closed')} />;
    case 'pump':
      return <PumpVisual running={bool('running')} flow={num('flow')} />;
    case 'trafficLight':
      return <TrafficLightVisual red={bool('red')} yellow={bool('yellow')} green={bool('green')} />;
    case 'heater':
      return <HeaterVisual on={bool('heaterOn')} temp={num('temp')} />;
    case 'fan':
      return <FanVisual running={bool('running')} airflow={num('airflow')} />;
    case 'sensor': {
      const min = Number(comp.props.min ?? 0);
      const max = Number(comp.props.max ?? 100);
      const val = Number(state.value ?? 0);
      const pct = ((val - min) / (max - min || 1)) * 100;
      return (
        <div className="pv pv-sensor">
          <div className="pv-sensor-arc">
            <div className="pv-sensor-needle" style={{ transform: `rotate(${-90 + (pct / 100) * 180}deg)` }} />
          </div>
          <input
            type="range"
            min={min}
            max={max}
            value={val}
            onChange={(e) => engine.setProcessValue(comp.id, 'value', Number(e.target.value))}
            className="pv-slider"
          />
          <span className="pv-readout mono">{val.toFixed(0)}</span>
        </div>
      );
    }
    case 'counter':
      return (
        <div className="pv pv-counter">
          <div className="pv-sevenseg mono">{num('value').toFixed(0).padStart(3, '0')}</div>
        </div>
      );
    default:
      return null;
  }
}

/* ------------------------------------------------------------------ */

function MotorVisual({ running, rpm }: { running: boolean; rpm: number }) {
  return (
    <div className="pv pv-motor">
      <div className="pv3d-motor">
        <div className={`pv3d-motor-body ${running ? 'running' : ''}`}>
          <div className="pv3d-motor-fin" />
          <div className="pv3d-motor-fin" />
          <div className="pv3d-motor-fin" />
          <div className="pv3d-motor-cap" />
        </div>
        <div className={`pv3d-motor-shaft ${running ? 'spin' : ''}`} />
        <div className="pv3d-motor-base" />
      </div>
      <div className="pv-row">
        <span className={`pv-led ${running ? 'green' : ''}`} />
        <span className="pv-readout mono">{rpm.toFixed(0)} RPM</span>
      </div>
    </div>
  );
}

function PumpVisual({ running, flow }: { running: boolean; flow: number }) {
  return (
    <div className="pv pv-pump">
      <div className={`pv3d-pump ${running ? 'running' : ''}`}>
        <div className="pv3d-pump-volute">
          <div className="pv3d-pump-impeller" />
        </div>
        <div className="pv3d-pump-inlet" />
        <div className="pv3d-pump-outlet" />
      </div>
      <div className="pv-row">
        <span className={`pv-led ${running ? 'green' : ''}`} />
        <span className="pv-readout mono">{flow.toFixed(1)} L/s</span>
      </div>
    </div>
  );
}

function FanVisual({ running, airflow }: { running: boolean; airflow: number }) {
  return (
    <div className="pv pv-fan">
      <div className="pv3d-fan">
        <div className={`pv3d-fan-blades ${running ? 'spin-fast' : ''}`}>
          <span />
          <span />
          <span />
          <span />
        </div>
        <div className="pv3d-fan-hub" />
      </div>
      <div className="pv-row">
        <span className={`pv-led ${running ? 'green' : ''}`} />
        <span className="pv-readout mono">{airflow.toFixed(0)} CFM</span>
      </div>
    </div>
  );
}

function ConveyorVisual({ moving, box }: { moving: boolean; box: boolean }) {
  return (
    <div className="pv pv-conveyor">
      <div className="pv3d-conveyor">
        <div className="pv3d-belt">
          <div className={`pv3d-belt-track ${moving ? 'run' : ''}`} />
          {box && <div className="pv3d-box" />}
        </div>
        <div className="pv3d-roller left" />
        <div className="pv3d-roller right" />
      </div>
      <div className="pv-row">
        <span className="pv-readout mono">{moving ? 'RUN' : 'STOP'}</span>
        {box && <span className="pv-tag">part</span>}
      </div>
    </div>
  );
}

function TankVisual({
  level,
  inlet,
  outlet,
  high,
  low,
}: {
  level: number;
  inlet: boolean;
  outlet: boolean;
  high: boolean;
  low: boolean;
}) {
  const clamped = Math.max(0, Math.min(100, level));
  const color = high ? '#ef5350' : low ? '#f5b301' : 'linear-gradient(180deg,#4fc3f7,#1c7fbf)';
  return (
    <div className="pv pv-tank">
      <div className="pv3d-tank">
        <div className="pv3d-tank-shell">
          <div className="pv3d-tank-liquid" style={{ height: `${clamped}%`, background: color }}>
            <div className="pv3d-tank-wave" />
          </div>
          <div className="pv3d-tank-high" />
          <div className="pv3d-tank-low" />
        </div>
        <div className={`pv3d-pipe in ${inlet ? 'flowing' : ''}`} />
        <div className={`pv3d-pipe out ${outlet ? 'flowing' : ''}`} />
        <div className="pv3d-tank-leg left" />
        <div className="pv3d-tank-leg right" />
      </div>
      <div className="pv-row">
        <span className="pv-readout mono">{clamped.toFixed(0)}%</span>
        {high && <span className="pv-tag red">HIGH</span>}
        {low && <span className="pv-tag amber">LOW</span>}
      </div>
    </div>
  );
}

function ValveVisual({ opened, closed }: { opened: boolean; closed: boolean }) {
  return (
    <div className="pv pv-valve">
      <div className={`pv3d-valve ${opened ? 'open' : ''} ${closed ? 'closed' : ''}`}>
        <div className="pv3d-valve-body" />
        <div className="pv3d-valve-handle" />
        <div className="pv3d-valve-pipe left" />
        <div className="pv3d-valve-pipe right" />
      </div>
      <span className="pv-readout mono">{opened ? 'OPEN' : closed ? 'CLOSED' : 'MOVING'}</span>
    </div>
  );
}

function TrafficLightVisual({ red, yellow, green }: { red: boolean; yellow: boolean; green: boolean }) {
  return (
    <div className="pv pv-traffic">
      <div className="pv3d-traffic">
        <span className={`pv-lamp red ${red ? 'on' : ''}`} />
        <span className={`pv-lamp amber ${yellow ? 'on' : ''}`} />
        <span className={`pv-lamp green ${green ? 'on' : ''}`} />
      </div>
    </div>
  );
}

function HeaterVisual({ on, temp }: { on: boolean; temp: number }) {
  const pct = Math.max(0, Math.min(100, (temp / 250) * 100));
  return (
    <div className="pv pv-heater">
      <div className={`pv3d-heater ${on ? 'on' : ''}`}>
        <div className="pv3d-heater-coils">
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className={on ? 'hot' : ''} />
          ))}
        </div>
        <div className="pv3d-heater-temp" style={{ height: `${pct}%` }} />
      </div>
      <span className="pv-readout mono">{temp.toFixed(1)} °C</span>
    </div>
  );
}
