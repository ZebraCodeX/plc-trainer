import { useEffect, useMemo, useRef, useState } from 'react';
import { useGame } from '../game/store';
import { missionById } from '../game/missions';
import { buildMissionProject, runTest, type TestResult } from '../game/engine';
import { PlcEngine } from '../engine/engine';
import { useScanCount } from '../store/hooks';
import { LadderRungEditor } from './LadderRungEditor';
import { StDraftEditor } from './StDraftEditor';
import { GameMachine } from './GameMachine';
import { Icon } from '../ui/icons';

export function GameArena() {
  const { run, draft, setDraft, closeRun, submit, progress } = useGame();
  const mission = run ? missionById(run.missionId) : undefined;
  const [results, setResults] = useState<TestResult[]>([]);
  const [checking, setChecking] = useState(false);
  const [showHints, setShowHints] = useState(false);
  const [consoleLines, setConsoleLines] = useState<string[]>([]);
  const [elapsed, setElapsed] = useState(0);

  const engine = useMemo(() => (mission && draft ? new PlcEngine(buildMissionProject(mission, draft)) : null), [mission, draft]);
  const scan = useScanCount();
  const liveEngineRef = useRef<PlcEngine | null>(engine);

  useEffect(() => {
    liveEngineRef.current = engine;
    engine?.start();
    return () => engine?.stop();
  }, [engine]);

  useEffect(() => {
    if (!run || run.status !== 'briefing') return;
    const started = Date.now();
    const timer = setInterval(() => setElapsed(Date.now() - started), 200);
    return () => clearInterval(timer);
  }, [run]);

  if (!run || !mission || !draft) return null;

  const isSt = draft.kind === 'st';

  function checkLogic(): TestResult[] {
    if (!mission || !draft) return [];
    return mission.tests.map((t) => runTest(mission, draft, t));
  }

  function preview() {
    setChecking(true);
    const res = checkLogic();
    setResults(res);
    const lines: string[] = [];
    for (const r of res) {
      lines.push(`▶ TEST ${r.name}: ${r.pass ? 'PASS' : 'FAIL'}`);
      for (const l of r.log.slice(-6)) lines.push(`   ${l}`);
    }
    setConsoleLines(lines);
    setChecking(false);
  }

  function deploy() {
    const res = checkLogic();
    setResults(res);
    const outcome = submit();
    const lines: string[] = [];
    for (const r of res) lines.push(`▶ TEST ${r.name}: ${r.pass ? 'PASS' : 'FAIL'}`);
    setConsoleLines(lines);
    void outcome;
  }

  const hintsUnlocked = progress.hintsUnlocked[mission.id] ?? [];

  return (
    <div className="arena">
      <div className="arena-topbar">
        <button className="icon-btn" onClick={closeRun} title="Back to mission board">
          <Icon name="undo" />
        </button>
        <div className="arena-title">
          <span className="mission-code mono">{mission.codename}</span>
          <b>{mission.title}</b>
          <span className="mission-diff small">
            {'◆'.repeat(mission.difficulty)}
            <span className="muted">{'◇'.repeat(5 - mission.difficulty)}</span>
          </span>
        </div>
        <div className="spacer" />
        {mission.timeLimit > 0 && (
          <div className={`arena-timer ${elapsed > mission.timeLimit * 1000 ? 'over' : ''}`}>
            <Icon name="gauge" size={15} />
            {Math.floor(elapsed / 1000)}s / {mission.timeLimit}s
          </div>
        )}
        <button className="btn-reset" onClick={() => setShowHints((v) => !v)}>
          <Icon name="help" size={15} /> Hints ({mission.hints.length - hintsUnlocked.length} left)
        </button>
        <button className="btn-reset" onClick={preview} disabled={checking}>
          <Icon name="book" size={15} /> {checking ? 'Testing…' : 'Run tests'}
        </button>
        <button className="btn-run" onClick={deploy}>
          <Icon name="play" size={15} /> Deploy
        </button>
      </div>

      <div className="arena-body">
        <div className="arena-left">
          <div className="arena-panel">
            <h3>Machine</h3>
            <GameMachine mission={mission} engine={engine} scan={scan} />
          </div>

          <div className="arena-panel">
            <h3>Mission brief</h3>
            <p className="small">{mission.brief}</p>
            <div className="fault-pill">
              <span className="fault-dot" />
              <span className="small">{mission.fault}</span>
            </div>
            <h3 style={{ marginTop: 12 }}>Objectives</h3>
            <ul className="objective-list">
              {mission.objectives.map((o) => (
                <li key={o.id}>{o.text}</li>
              ))}
            </ul>
          </div>

          <div className="arena-panel">
            <h3>I/O points</h3>
            <table>
              <thead>
                <tr>
                  <th>Tag</th>
                  <th>Type</th>
                  <th>Value</th>
                </tr>
              </thead>
              <tbody>
                {mission.io.map((t) => (
                  <IoRow key={t.name} name={t.name} type={t.dataType} engine={engine} scan={scan} note={t.note} />
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="arena-center">
          <div className="arena-panel arena-editor">
            <div className="arena-editor-head">
              <h3>{isSt ? 'Structured Text' : 'Ladder Logic'}</h3>
              <span className="muted small">
                {isSt ? 'Edit the code, then Run tests' : 'Build and edit the rungs, then Run tests'}
              </span>
            </div>
            {isSt ? (
              <StDraftEditor
                source={draft.source ?? ''}
                onChange={(source) => setDraft({ kind: 'st', source })}
              />
            ) : (
              <LadderRungEditor
                rungs={draft.rungs ?? []}
                io={mission.io.map((t) => t.name)}
                onChange={(rungs) => setDraft({ kind: 'ladder', rungs })}
              />
            )}
          </div>

          <div className="arena-panel console-panel">
            <h3>Test console</h3>
            <div className="console">
              {consoleLines.length === 0 && (
                <div className="muted small">
                  Press <b>Run tests</b> to simulate the machine against the mission behaviour, or{' '}
                  <b>Deploy</b> to commit your fix.
                </div>
              )}
              {consoleLines.map((l, i) => (
                <div
                  key={i}
                  className={`console-line ${l.includes('PASS') ? 'ok' : l.includes('FAIL') ? 'err' : ''}`}
                >
                  {l}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="arena-right">
          <div className="arena-panel">
            <h3>Behaviour tests</h3>
            <div className="test-list">
              {mission.tests.map((t) => {
                const r = results.find((x) => x.id === t.id);
                return (
                  <div key={t.id} className={`test-row ${r ? (r.pass ? 'pass' : 'fail') : ''}`}>
                    <span className="test-status">{r ? (r.pass ? '✓' : '✕') : '•'}</span>
                    <div>
                      <div className="small">{t.name}</div>
                      <div className="muted small">{t.actions.length} step(s)</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {showHints && (
            <div className="arena-panel">
              <h3>Hints</h3>
              {mission.hints.map((h, i) => {
                const unlocked = hintsUnlocked.includes(String(i));
                return (
                  <div key={i} className="hint">
                    {unlocked ? (
                      <p className="small">{h.text}</p>
                    ) : (
                      <button
                        className="hint-unlock"
                        onClick={() => useGame.setState((s) => ({
                          progress: {
                            ...s.progress,
                            hintsUnlocked: {
                              ...s.progress.hintsUnlocked,
                              [mission.id]: [...(s.progress.hintsUnlocked[mission.id] ?? []), String(i)],
                            },
                          },
                        }))}
                      >
                        <Icon name="help" size={14} /> Unlock hint (−{h.cost} XP)
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <div className="arena-panel">
            <h3>Scoring</h3>
            <div className="muted small">
              Base <b>+{mission.reward} XP</b>. No hints and quick fixes earn up to{' '}
              <b>3 ★</b>. Repeat clears give a 25% bonus.
            </div>
          </div>
        </div>
      </div>

      {run.status === 'won' && (
        <MissionResultOverlay
          title="Line restored!"
          detail={`${mission.title} cleared. +${run.score} XP`}
          results={results}
          onClose={closeRun}
        />
      )}
      {run.status === 'lost' && (
        <MissionResultOverlay
          title="Machine still faulted"
          detail="Some behaviour tests failed. Read the console, adjust the logic and deploy again."
          results={results}
          lost
          onRetry={() => useGame.setState((s) => (s.run ? { run: { ...s.run, status: 'running' } } : {}))}
          onClose={closeRun}
        />
      )}
    </div>
  );
}

function IoRow({
  name,
  type,
  engine,
  scan,
  note,
}: {
  name: string;
  type: string;
  engine: PlcEngine | null;
  scan: number;
  note?: string;
}) {
  void scan;
  const value = engine?.db.readScalar(name);
  return (
    <tr title={note}>
      <td className="mono small">{name}</td>
      <td>
        <span className={`badge ${type}`}>{type}</span>
      </td>
      <td className="mono">
        <span className={`io-value ${value === true ? 'on' : ''}`}>
          {typeof value === 'boolean' ? (value ? '1' : '0') : value ?? '--'}
        </span>
      </td>
    </tr>
  );
}

function MissionResultOverlay({
  title,
  detail,
  results,
  lost,
  onRetry,
  onClose,
}: {
  title: string;
  detail: string;
  results: TestResult[];
  lost?: boolean;
  onRetry?: () => void;
  onClose: () => void;
}) {
  return (
    <div className="arena-overlay">
      <div className={`arena-result ${lost ? 'lost' : 'won'}`}>
        <div className="arena-result-icon">{lost ? '✕' : '🏆'}</div>
        <h2>{title}</h2>
        <p className="muted">{detail}</p>
        <div className="arena-result-tests">
          {results.map((r) => (
            <div key={r.id} className={`test-row ${r.pass ? 'pass' : 'fail'}`}>
              <span className="test-status">{r.pass ? '✓' : '✕'}</span>
              <span className="small">{r.name}</span>
            </div>
          ))}
        </div>
        <div className="row" style={{ justifyContent: 'center', marginTop: 16 }}>
          {lost && onRetry && (
            <button className="primary" onClick={onRetry}>
              Keep editing
            </button>
          )}
          <button onClick={onClose}>Mission board</button>
        </div>
      </div>
    </div>
  );
}

