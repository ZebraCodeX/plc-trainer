import type { PlcEngine } from '../engine/engine';
import type { AnyMission } from './mission-types';

/**
 * Lightweight machine visual for the arena. Reads live tags from the running
 * mission engine and animates the relevant component.
 */
export function GameMachine({
  mission,
  engine,
  scan,
}: {
  mission: AnyMission;
  engine: PlcEngine | null;
  scan: number;
}) {
  void scan;
  if (!engine) return null;
  const read = (needles: string[]): boolean | number => {
    const names = mission.io.map((t) => t.name);
    const name = names.find((n) => needles.some((x) => n.toLowerCase().includes(x)));
    if (!name) return false;
    const v = engine.db.readScalar(name);
    return v ?? false;
  };
  const bool = (n: string[]) => read(n) === true;
  const num = (n: string[]) => (typeof read(n) === 'number' ? (read(n) as number) : 0);

  const type = mission.machine?.type;

  if (type === 'motor') {
    const running = bool(['running', 'motor', 'pump']) || bool(['cmd']);
    const speed = num(['speed']);
    return (
      <div className="machine-view">
        <div className="machine-motor">
          <div className={`machine-rotor ${running ? 'spin' : ''}`}>⚙</div>
          <div>
            <div className="machine-label">{mission.machine?.label ?? 'Motor'}</div>
            <div className={`machine-state ${running ? 'on' : ''}`}>
              {running ? 'RUNNING' : 'STOPPED'}
            </div>
            {speed > 0 && <div className="mono small">{speed.toFixed(0)} RPM</div>}
          </div>
        </div>
      </div>
    );
  }

  if (type === 'conveyor') {
    const running = bool(['cmd', 'run', 'conveyor']);
    return (
      <div className="machine-view">
        <div className="machine-label">{mission.machine?.label ?? 'Conveyor'}</div>
        <div className={`machine-belt ${running ? 'run' : ''}`}>▶▶▶▶▶▶▶▶</div>
        <div className={`machine-state ${running ? 'on' : ''}`}>
          {running ? 'MOVING' : 'STOPPED'}
        </div>
      </div>
    );
  }

  if (type === 'tank') {
    const level = num(['level']);
    const inlet = bool(['inlet']);
    return (
      <div className="machine-view">
        <div className="machine-label">{mission.machine?.label ?? 'Tank'}</div>
        <div className="machine-tank">
          <div className="machine-tank-fill" style={{ height: `${Math.max(0, Math.min(100, level))}%` }} />
        </div>
        <div className="row" style={{ gap: 6 }}>
          <span className={`pill ${inlet ? 'on' : ''}`}>Inlet {inlet ? 'OPEN' : 'closed'}</span>
          <span className="mono small">{level.toFixed(0)}%</span>
        </div>
      </div>
    );
  }

  if (type === 'trafficLight') {
    const red = bool(['red']);
    const green = bool(['green']);
    const yellow = bool(['yellow', 'amber']);
    return (
      <div className="machine-view">
        <div className="machine-label">{mission.machine?.label ?? 'Signal'}</div>
        <div className="machine-light">
          <span className={`lamp red ${red ? 'on' : ''}`} />
          <span className={`lamp amber ${yellow ? 'on' : ''}`} />
          <span className={`lamp ${green ? 'on' : ''}`} />
        </div>
      </div>
    );
  }

  const on = bool(['heat', 'on']);
  return (
    <div className="machine-view">
      <div className="machine-label">{mission.machine?.label ?? 'Machine'}</div>
      <span className={`lamp red ${on ? 'on' : ''}`} />
      <div className={`machine-state ${on ? 'on' : ''}`}>{on ? 'ACTIVE' : 'IDLE'}</div>
    </div>
  );
}
