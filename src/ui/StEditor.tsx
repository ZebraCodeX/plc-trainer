import { useEffect, useMemo, useRef, useState } from 'react';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { useStore } from '../store/store';
import { stExtensions } from '../st/codemirror';
import { makeRoutine } from '../engine/factory';
import { Guide } from './Guide';

const TEMPLATE = `// Structured Text routine
// Available: IF/ELSIF/ELSE, CASE, FOR, WHILE, REPEAT and the
// AB instruction set: TON/TOF/RTO, CTU/CTD, MOV, ADD, SUB, MUL, DIV, CPT ...

IF Start_PB AND NOT Stop_PB THEN
  Run := 1;
END_IF;
`;

export function StEditor() {
  const { project, applyEdit, ui, setUi } = useStore();
  const engine = useStore((s) => s.engine);
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const [errors, setErrors] = useState<string[]>([]);

  const program = project.programs[0];
  const routines = program?.routines ?? [];
  const routine =
    routines.find((r) => r.id === ui.selectedRoutineId && r.type === 'st') ??
    routines.find((r) => r.type === 'st');

  const tagSuggestions = useMemo(
    () => project.tags.map((t) => ({ name: t.name, dataType: t.dataType })),
    [project.tags],
  );
  const routineNames = useMemo(() => routines.map((r) => r.name), [routines]);

  const sourceRef = useRef(routine?.stSource ?? '');
  const commitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!routine || !hostRef.current) return;
    const state = EditorState.create({
      doc: routine.stSource || TEMPLATE,
      extensions: [
        ...stExtensions(
          () => tagSuggestions,
          () => routineNames,
        ),
        EditorView.updateListener.of((u) => {
          if (u.docChanged) {
            sourceRef.current = u.state.doc.toString();
            setErrors(engine.validateSt(routine.id, sourceRef.current));
            if (commitTimer.current) clearTimeout(commitTimer.current);
            commitTimer.current = setTimeout(() => {
              applyEdit((p) => {
                const rt = p.programs.flatMap((pr) => pr.routines).find((r) => r.id === routine.id);
                if (rt) rt.stSource = sourceRef.current;
              }, 'content');
            }, 400);
          }
        }),
      ],
    });
    const view = new EditorView({ state, parent: hostRef.current });
    viewRef.current = view;
    return () => {
      if (commitTimer.current) clearTimeout(commitTimer.current);
      view.destroy();
      viewRef.current = null;
    };
  }, [routine?.id]);

  function newStRoutine() {
    const rt = makeRoutine(`ST_${routines.length + 1}`, 'st');
    rt.stSource = TEMPLATE;
    applyEdit((p) => {
      p.programs[0].routines.push(rt);
    }, 'content');
    setUi({ selectedRoutineId: rt.id });
  }

  function convertCurrent() {
    if (!routine) return;
    applyEdit((p) => {
      const rt = p.programs.flatMap((pr) => pr.routines).find((r) => r.id === routine.id);
      if (rt) {
        rt.type = 'st';
        if (!rt.stSource) rt.stSource = TEMPLATE;
      }
    }, 'content');
  }

  if (!program) return <div className="empty-state">No program. Create one from the Training tab.</div>;

  return (
    <div className="col">
      <div className="toolbar">
        <h3 style={{ margin: 0 }}>Structured Text</h3>
        <select
          value={routine?.id ?? ''}
          onChange={(e) => setUi({ selectedRoutineId: e.target.value })}
        >
          {routines
            .filter((r) => r.type === 'st')
            .map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
        </select>
        <button onClick={newStRoutine}>+ New ST routine</button>
        {routine && <button onClick={convertCurrent} disabled={routine.type === 'st'}>Convert current to ST</button>}
        <span className="muted small">Ctrl+Space for tag completion</span>
        {errors.length > 0 ? (
          <span className="pill" style={{ color: 'var(--red)' }}>{errors.length} error(s)</span>
        ) : (
          <span className="pill" style={{ color: 'var(--green)' }}>Syntax OK</span>
        )}
      </div>

      <Guide title="How structured text works" defaultOpen>
        <ul className="bullets">
          <li>
            Structured Text is text-based code that runs on the same scan as ladder. Press{' '}
            <b>Ctrl+Space</b> for tag and instruction completion.
          </li>
          <li>
            Use <span className="mono">:=</span> to assign, and <span className="mono">IF … THEN …
            ELSIF … ELSE … END_IF;</span>, <span className="mono">CASE</span>,{' '}
            <span className="mono">FOR</span>, <span className="mono">WHILE</span> and{' '}
            <span className="mono">REPEAT</span> for control flow.
          </li>
          <li>
            Operators: <span className="mono">AND OR NOT XOR</span>, comparisons{' '}
            <span className="mono">= &lt;&gt; &lt; &gt; &lt;= &gt;=</span>, and math{' '}
            <span className="mono">+ − * / MOD **</span>.
          </li>
          <li>
            Timers/counters: <span className="mono">TON(Timer, Enable, Preset)</span>,{' '}
            <span className="mono">CTU(Counter, Enable, Preset)</span>,{' '}
            <span className="mono">RES(Tag)</span>. Read status with{' '}
            <span className="mono">Timer.DN</span>.
          </li>
          <li>Every routine in the project runs in order; the MainRoutine runs first each scan.</li>
        </ul>
      </Guide>

      {!routine ? (
        <div className="empty-state">
          No Structured Text routine yet. Click “+ New ST routine”.
        </div>
      ) : (
        <>
          <div className="st-editor" ref={hostRef} />
          {errors.length > 0 && (
            <div className="panel" style={{ borderColor: 'var(--red)' }}>
              {errors.map((e, i) => (
                <div key={i} style={{ color: 'var(--red)' }} className="mono small">
                  {e}
                </div>
              ))}
            </div>
          )}
          <div className="panel">
            <h3>Instruction reference</h3>
            <span className="muted small">
              Timers/counters: <span className="mono">TON(Timer, Enable, Preset)</span>,{' '}
              <span className="mono">CTU(Counter, Enable, Preset)</span>,{' '}
              <span className="mono">RES(Tag)</span>. Math/move:{' '}
              <span className="mono">MOV(Src, Dest)</span>,{' '}
              <span className="mono">Dest := A + B;</span>.
            </span>
          </div>
        </>
      )}
    </div>
  );
}
