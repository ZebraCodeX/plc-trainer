import { useStore } from '../store/store';
import { demoProject } from '../engine/factory';
import { Guide } from './Guide';
import { LadderSymbol } from './LadderSymbol';

const APP_MAP: { tab: string; what: string }[] = [
  { tab: 'Ladder Logic', what: 'Draw relay-style logic: contacts, coils, timers, counters, compare and math. Watch power flow light up live.' },
  { tab: 'Structured Text', what: 'Type text-based code (IF, CASE, FOR) that runs on the same PLC scan as ladder.' },
  { tab: 'Tag Database', what: 'The PLC memory: define named tags (BOOL, INT, REAL, TIMER, COUNTER …) and see live values.' },
  { tab: 'I/O Configuration', what: 'Add chassis modules (input/output cards), name channels and test them on the simulated I/O panel.' },
  { tab: 'Plant Simulation', what: 'Drag machines (motor, tank, conveyor …) onto a canvas and wire them to your tags.' },
  { tab: 'HMI / SCADA', what: 'Build an operator screen with indicators, buttons, gauges and trend charts bound to tags.' },
  { tab: 'IIoT / MQTT', what: 'Publish tags to MQTT topics, browse the message monitor, and map tags to Modbus registers.' },
  { tab: 'Training', what: 'Load guided scenarios with automatic checks, plus the full instruction reference.' },
];

const ABBREVIATIONS: { code: string; meaning: string }[] = [
  { code: 'XIC', meaning: 'Examine If Closed — contact that passes power when the bit is ON' },
  { code: 'XIO', meaning: 'Examine If Open — contact that passes power when the bit is OFF' },
  { code: 'OTE', meaning: 'Output Energize — coil that follows the rung' },
  { code: 'OTL', meaning: 'Output Latch — coil that latches a bit ON' },
  { code: 'OTU', meaning: 'Output Unlatch — coil that unlatches a bit OFF' },
  { code: 'TON', meaning: 'Timer On Delay — clock that counts up while enabled' },
  { code: 'CTU', meaning: 'Count Up — counter that increments on each pulse' },
  { code: 'MOV', meaning: 'Move — copy a value from source to destination' },
];

export function HomeView({ onNewProject }: { onNewProject: () => void }) {
  const { project, applyEdit, loadProject, setUi } = useStore();

  return (
    <div className="col">
      <div className="hero">
        <div>
          <h1>PLC Trainer</h1>
          <p className="muted">
            A hands-on simulator for <b>PLC programming</b>, <b>electrical control</b>,{' '}
            <b>automation</b> and <b>IIoT</b>. Learn by building — no real hardware required.
          </p>
          <div className="row" style={{ marginTop: 12 }}>
            <button className="primary" onClick={() => loadProject(demoProject())}>
              ▶ Open the example project
            </button>
            <button onClick={onNewProject}>+ New project</button>
            <button onClick={() => setUi({ activeTab: 'training' })}>🎓 Start a lesson</button>
          </div>
        </div>
      </div>

      <Guide title="Getting started in 5 minutes" defaultOpen>
        <ol className="steps">
          <li>
            <b>Open the example</b> (button above) or start a <b>New project</b> and give it a name.
            A project contains the tags, programs, I/O, plant and HMI.
          </li>
          <li>
            Go to <b>Tag Database</b> and define the bits and numbers you need (e.g. a{' '}
            <span className="mono">Start_PB</span> button and a <span className="mono">Motor_Cmd</span> coil).
          </li>
          <li>
            Open <b>Ladder Logic</b>. Click an instruction in the palette, then click a <span className="mono">+</span>{' '}
            slot on a rung — or drag the chip straight onto a slot. Click any element to edit its tag.
          </li>
          <li>
            Press <b>▶ Run</b> in the header. Watch the power flow turn green and the tag values
            update each scan.
          </li>
          <li>
            Add hardware in <b>I/O Configuration</b>, wire machines in <b>Plant Simulation</b>, then
            build an operator view in <b>HMI / SCADA</b> or publish tags in <b>IIoT / MQTT</b>.
          </li>
        </ol>
      </Guide>

      <Guide title="How the PLC simulator works">
        <p className="muted">
          A real PLC runs a repeating <b>scan cycle</b>. This app does exactly the same, at the scan
          time shown in the header (default 20 ms):
        </p>
        <div className="scan-cycle">
          <span className="scan-node">1 · Read inputs</span>
          <span className="scan-arrow">→</span>
          <span className="scan-node">2 · Execute programs (ladder + ST)</span>
          <span className="scan-arrow">→</span>
          <span className="scan-node">3 · Update timers/counters</span>
          <span className="scan-arrow">→</span>
          <span className="scan-node">4 · Write outputs</span>
          <span className="scan-arrow">↻</span>
        </div>
        <ul className="bullets">
          <li>
            <b>Tags</b> are the PLC memory. Everything — ladder, ST, I/O, plant and HMI — reads and
            writes the same tag database.
          </li>
          <li>
            <b>Ladder and Structured Text</b> are two ways to write the same program; both compile to
            the same runnable instructions.
          </li>
          <li>
            <b>I/O tags</b> are the physical inputs and outputs. Switches and sensors write inputs;
            the program drives outputs, which light lamps and move machines.
          </li>
          <li>
            <b>Timers and counters</b> are structured tags — you can read their status bits like{' '}
            <span className="mono">Run_Timer.DN</span> or <span className="mono">Run_Timer.ACC</span>.
          </li>
        </ul>
      </Guide>

      <Guide title="What each tab is for">
        <table>
          <thead>
            <tr>
              <th style={{ width: 180 }}>Tab</th>
              <th>What you do there</th>
            </tr>
          </thead>
          <tbody>
            {APP_MAP.map((row) => (
              <tr key={row.tab}>
                <td>
                  <b>{row.tab}</b>
                </td>
                <td className="muted">{row.what}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Guide>

      <div className="grid2">
        <div className="panel">
          <h3>Your first ladder rung</h3>
          <p className="muted small">
            A “seal-in” start/stop circuit — the most common pattern in industrial control. The
            parallel contact keeps the coil on after the button is released.
          </p>
          <div className="row" style={{ gap: 8, marginTop: 8 }}>
            <LadderSymbol op="XIC" />
            <span className="muted">Start_PB</span>
          </div>
          <div className="row" style={{ gap: 8 }}>
            <LadderSymbol op="XIO" />
            <span className="muted">Stop_PB</span>
          </div>
          <div className="row" style={{ gap: 8 }}>
            <LadderSymbol op="OTE" />
            <span className="muted">Motor_Cmd</span>
          </div>
          <p className="muted small" style={{ marginTop: 8 }}>
            Read it as: <i>if Start is pressed and Stop is not pressed, energize Motor_Cmd.</i> Add
            a parallel XIC <span className="mono">Motor_Cmd</span> branch to seal it in.
          </p>
        </div>

        <div className="panel">
          <h3>Common instruction shortcuts</h3>
          <table>
            <tbody>
              {ABBREVIATIONS.map((a) => (
                <tr key={a.code}>
                  <td className="mono" style={{ width: 60, color: 'var(--accent)', fontWeight: 700 }}>
                    {a.code}
                  </td>
                  <td className="muted small">{a.meaning}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="muted small" style={{ marginTop: 8 }}>
            See every instruction with symbols and usage in the <b>Training</b> tab.
          </p>
        </div>
      </div>

      <div className="panel">
        <h3>Project</h3>
        <div className="row">
          <label className="col" style={{ gap: 3, flex: 1 }}>
            <span className="muted small">Project name (used when you export the file)</span>
            <input
              value={project.name}
              onChange={(e) =>
                applyEdit((p) => {
                  p.name = e.target.value;
                }, 'content')
              }
            />
          </label>
          <label className="col" style={{ gap: 3, flex: 2 }}>
            <span className="muted small">Description</span>
            <input
              value={project.description ?? ''}
              onChange={(e) =>
                applyEdit((p) => {
                  p.description = e.target.value;
                }, 'content')
              }
            />
          </label>
        </div>
        <p className="muted small" style={{ marginTop: 8 }}>
          Your work is saved automatically in this browser. Use <b>Export</b> / <b>Import</b> in the
          header to save or share a project as a JSON file.
        </p>
      </div>
    </div>
  );
}
