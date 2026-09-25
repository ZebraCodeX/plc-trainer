import { useEffect, useRef } from 'react';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { stExtensions } from '../st/codemirror';

export function StDraftEditor({
  source,
  onChange,
}: {
  source: string;
  onChange: (source: string) => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!hostRef.current) return;
    const state = EditorState.create({
      doc: source,
      extensions: [
        ...stExtensions(
          () => [],
          () => [],
        ),
        EditorView.updateListener.of((u) => {
          if (u.docChanged) onChangeRef.current(u.state.doc.toString());
        }),
      ],
    });
    const view = new EditorView({ state, parent: hostRef.current });
    viewRef.current = view;
    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // only rebuild when the host element mounts
    // eslint-disable-next-line
  }, []);

  return <div className="st-editor game-st-editor" ref={hostRef} />;
}
