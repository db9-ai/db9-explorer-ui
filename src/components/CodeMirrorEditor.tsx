import { useEffect, useRef } from 'react';
import { EditorView, lineNumbers, highlightActiveLine, highlightActiveLineGutter, keymap, drawSelection } from '@codemirror/view';
import { EditorState, Compartment } from '@codemirror/state';
import { bracketMatching, foldGutter, indentOnInput, syntaxHighlighting, defaultHighlightStyle } from '@codemirror/language';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search';
import { closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete';
import { vim, Vim } from '@replit/codemirror-vim';
import { db9EditorTheme, db9HighlightStyle } from '../lib/codemirror-theme';
import { getLanguageSupport } from '../lib/codemirror-langs';

interface Props {
  content: string;
  filename: string;
  readOnly: boolean;
  vimMode: boolean;
  onChange?: (value: string) => void;
  onSave?: () => void;
}

// Compartments for dynamic reconfiguration
const languageConf = new Compartment();
const readOnlyConf = new Compartment();
const vimConf = new Compartment();

export function CodeMirrorEditor({ content, filename, readOnly, vimMode, onChange, onSave }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  const onSaveRef = useRef(onSave);

  // Keep refs in sync
  onChangeRef.current = onChange;
  onSaveRef.current = onSave;

  // Create editor on mount
  useEffect(() => {
    if (!containerRef.current) return;

    // Register :w ex-command for vim
    Vim.defineEx('write', 'w', () => {
      onSaveRef.current?.();
    });

    const view = new EditorView({
      state: EditorState.create({
        doc: content,
        extensions: [
          // Vim compartment (must be first for keybinding priority)
          vimConf.of(vimMode ? vim() : []),

          // Read-only compartment
          readOnlyConf.of(readOnly
            ? [EditorState.readOnly.of(true), EditorView.editable.of(false)]
            : [closeBrackets(), keymap.of(closeBracketsKeymap)]
          ),

          // Language compartment (placeholder, loaded async)
          languageConf.of([]),

          // Base extensions
          lineNumbers(),
          highlightActiveLine(),
          highlightActiveLineGutter(),
          drawSelection(),
          bracketMatching(),
          foldGutter(),
          indentOnInput(),
          highlightSelectionMatches(),
          history(),
          syntaxHighlighting(defaultHighlightStyle, { fallback: true }),

          // Keymaps
          keymap.of([
            // Cmd+S → save
            {
              key: 'Mod-s',
              run: () => {
                onSaveRef.current?.();
                return true;
              },
              preventDefault: true,
            },
            ...defaultKeymap,
            ...historyKeymap,
            ...searchKeymap,
            indentWithTab,
          ]),

          // Theme
          db9EditorTheme,
          db9HighlightStyle,

          // Change listener
          EditorView.updateListener.of(update => {
            if (update.docChanged) {
              onChangeRef.current?.(update.state.doc.toString());
            }
          }),
        ],
      }),
      parent: containerRef.current,
    });

    viewRef.current = view;

    // Load language async
    getLanguageSupport(filename).then(lang => {
      if (viewRef.current === view) {
        view.dispatch({ effects: languageConf.reconfigure(lang ? [lang] : []) });
      }
    });

    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync content when file changes (external change)
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const currentDoc = view.state.doc.toString();
    if (currentDoc !== content) {
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: content },
      });
    }
  }, [content]);

  // Swap language when filename changes
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    let cancelled = false;
    getLanguageSupport(filename).then(lang => {
      if (!cancelled && viewRef.current === view) {
        view.dispatch({ effects: languageConf.reconfigure(lang ? [lang] : []) });
      }
    });
    return () => { cancelled = true; };
  }, [filename]);

  // Toggle read-only
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({
      effects: readOnlyConf.reconfigure(readOnly
        ? [EditorState.readOnly.of(true), EditorView.editable.of(false)]
        : [closeBrackets(), keymap.of(closeBracketsKeymap)]
      ),
    });
    // Focus when switching to editable
    if (!readOnly) {
      view.focus();
    }
  }, [readOnly]);

  // Toggle vim mode
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({
      effects: vimConf.reconfigure(vimMode ? vim() : []),
    });
  }, [vimMode]);

  return <div ref={containerRef} className="cm-container" />;
}
