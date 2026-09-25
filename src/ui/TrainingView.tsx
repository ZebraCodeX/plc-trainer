import { useState } from 'react';
import { useStore } from '../store/store';
import { PlcEngine } from '../engine/engine';
import { allLessons } from '../lessons/lessons';
import type { Lesson, Objective } from '../engine/model';

interface Result {
  objectiveId: string;
  pass: boolean;
  actual: string;
}

function gradeObjective(project: ReturnType<typeof useStore.getState>['project'], objective: Objective): Result {
  const engine = new PlcEngine(project);
  for (const input of objective.inputs ?? []) {
    engine.db.writeScalar(input.ref, input.value);
  }
  const steps = objective.steps ?? 25;
  for (let i = 0; i < steps; i++) engine.step();

  const value = engine.db.readScalar(objective.ref);
  if (objective.kind === 'tagBoolean') {
    const actual = value === true ? 'TRUE' : value === false ? 'FALSE' : String(value);
    return { objectiveId: objective.id, pass: value === objective.expected, actual };
  }
  const n = typeof value === 'number' ? value : value === true ? 1 : 0;
  const tolerance = objective.tolerance ?? 0.001;
  const pass = Math.abs(n - Number(objective.expected ?? 0)) <= tolerance;
  return { objectiveId: objective.id, pass, actual: String(n) };
}

export function TrainingView() {
  const { project, loadProject } = useStore();
  const lessons = allLessons();
  const [results, setResults] = useState<Record<string, Result[]>>({});

  function load(pack: { lesson: Lesson; project: typeof project }) {
    loadProject(structuredClone(pack.project));
    setResults((r) => ({ ...r, [pack.lesson.id]: [] }));
  }

  function runChecks(lesson: Lesson) {
    const res = lesson.objectives.map((o) => gradeObjective(project, o));
    setResults((r) => ({ ...r, [lesson.id]: res }));
  }

  return (
    <div className="col">
      <div className="toolbar">
        <h3 style={{ margin: 0 }}>Training Scenarios</h3>
        <span className="muted small">
          Load a scenario, program it in the editors, then run the automatic checks.
        </span>
      </div>

      {lessons.map(({ lesson }) => {
        const res = results[lesson.id] ?? [];
        const passed = res.filter((r) => r.pass).length;
        return (
          <div key={lesson.id} className="lesson-card">
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <div>
                <h4>
                  {lesson.title}{' '}
                  <span className="badge">{lesson.difficulty}</span>
                </h4>
                <div className="muted small" style={{ maxWidth: 720 }}>
                  {lesson.summary}
                </div>
              </div>
              <div className="row">
                <button
                  onClick={() => {
                    const pack = lessons.find((l) => l.lesson.id === lesson.id)!;
                    load(pack);
                  }}
                >
                  Load scenario
                </button>
                <button className="primary" onClick={() => runChecks(lesson)}>
                  Run checks
                </button>
              </div>
            </div>

            {res.length > 0 && (
              <div style={{ marginTop: 8 }}>
                <div className="muted small">
                  {passed}/{res.length} objectives passed
                </div>
                {lesson.objectives.map((o) => {
                  const r = res.find((x) => x.objectiveId === o.id);
                  const cls = r ? (r.pass ? 'objective pass' : 'objective fail') : 'objective';
                  return (
                    <div key={o.id} className={cls}>
                      <span className="status">{r ? (r.pass ? '✓' : '✕') : '•'}</span>
                      <span>{o.description}</span>
                      {r && !r.pass && <span className="muted small">(got {r.actual})</span>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      <div className="panel">
        <h3>How the checks work</h3>
        <div className="muted small">
          Each check loads a clean copy of your current project, forces the listed inputs, scans the
          program for a number of cycles, then verifies the expected tag state. Use it to confirm your
          logic before moving on. The Tag, I/O, Plant and IIoT tabs all contribute to the same project
          file you can export and share.
        </div>
      </div>
    </div>
  );
}
