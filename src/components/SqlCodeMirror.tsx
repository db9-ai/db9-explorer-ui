import { useEffect, useRef } from 'react';
import { EditorView, keymap, drawSelection, placeholder as cmPlaceholder } from '@codemirror/view';
import { EditorState, Compartment } from '@codemirror/state';
import { bracketMatching, syntaxHighlighting, defaultHighlightStyle } from '@codemirror/language';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { closeBrackets, closeBracketsKeymap, autocompletion } from '@codemirror/autocomplete';
import { db9EditorTheme, db9HighlightStyle } from '../lib/codemirror-theme';
import { getPostgresLanguage } from '../lib/codemirror-langs';

interface Props {
  value: string;
  onChange: (value: string) => void;
  onExecute: () => void;
  placeholder?: string;
}

const langConf = new Compartment();

export function SqlCodeMirror({ value, onChange, onExecute, placeholder }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  const onExecuteRef = useRef(onExecute);

  onChangeRef.current = onChange;
  onExecuteRef.current = onExecute;

  // Create editor once
  useEffect(() => {
    if (!containerRef.current) return;

    const view = new EditorView({
      state: EditorState.create({
        doc: value,
        extensions: [
          langConf.of([]),
          closeBrackets(),
          keymap.of(closeBracketsKeymap),
          bracketMatching(),
          drawSelection(),
          history(),
          autocompletion(),
          syntaxHighlighting(defaultHighlightStyle, { fallback: true }),

          keymap.of([
            // Cmd+Enter → execute
            {
              key: 'Mod-Enter',
              run: () => {
                onExecuteRef.current();
                return true;
              },
              preventDefault: true,
            },
            ...defaultKeymap,
            ...historyKeymap,
          ]),

          db9EditorTheme,
          db9HighlightStyle,

          ...(placeholder ? [cmPlaceholder(placeholder)] : []),

          EditorView.updateListener.of(update => {
            if (update.docChanged) {
              onChangeRef.current(update.state.doc.toString());
            }
          }),
        ],
      }),
      parent: containerRef.current,
    });

    viewRef.current = view;

    // Load PostgreSQL language async
    getPostgresLanguage().then(lang => {
      if (viewRef.current === view) {
        view.dispatch({ effects: langConf.reconfigure([lang]) });
      }
    });

    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync external value changes
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const current = view.state.doc.toString();
    if (current !== value) {
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: value },
      });
    }
  }, [value]);

  return <div ref={containerRef} className="sql-cm-container" />;
}
