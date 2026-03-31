import { EditorView } from '@codemirror/view';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags } from '@lezer/highlight';

/**
 * Structural theme — backgrounds, gutters, cursors, selections.
 * Uses CSS custom properties from global.css so it stays in sync.
 */
export const db9EditorTheme = EditorView.theme({
  '&': {
    backgroundColor: 'var(--background)',
    color: 'var(--foreground)',
    fontFamily: 'var(--font-mono)',
    fontSize: '13px',
    height: '100%',
  },
  '.cm-content': {
    caretColor: 'var(--foreground)',
    lineHeight: '1.7',
    padding: '12px 0',
    fontFeatureSettings: '"liga" 1, "calt" 1',
  },
  '.cm-cursor, .cm-dropCursor': {
    borderLeftColor: 'var(--foreground)',
    borderLeftWidth: '1.5px',
  },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground': {
    backgroundColor: 'var(--selection-bg) !important',
  },
  '.cm-activeLine': {
    backgroundColor: 'hsl(0 0% 100% / 0.02)',
  },
  '.cm-gutters': {
    backgroundColor: 'var(--background)',
    color: 'hsl(0 0% 33%)',
    border: 'none',
    fontFamily: 'var(--font-mono)',
    fontSize: '13px',
  },
  '.cm-lineNumbers .cm-gutterElement': {
    padding: '0 16px 0 8px',
    minWidth: '48px',
  },
  '.cm-activeLineGutter': {
    backgroundColor: 'transparent',
    color: 'var(--muted-foreground)',
  },
  '.cm-foldGutter .cm-gutterElement': {
    padding: '0 4px',
    color: 'hsl(0 0% 33%)',
    cursor: 'pointer',
  },
  '.cm-foldGutter .cm-gutterElement:hover': {
    color: 'var(--muted-foreground)',
  },
  '.cm-foldPlaceholder': {
    backgroundColor: 'hsl(0 0% 15%)',
    color: 'var(--muted-foreground)',
    border: 'none',
    padding: '0 6px',
    borderRadius: '3px',
    margin: '0 4px',
  },
  '&.cm-focused': {
    outline: 'none',
  },
  '.cm-matchingBracket': {
    backgroundColor: 'hsl(210 30% 20%)',
    outline: '1px solid hsl(210 30% 35%)',
  },
  '.cm-nonmatchingBracket': {
    backgroundColor: 'hsl(0 30% 20%)',
    outline: '1px solid hsl(0 30% 35%)',
  },
  '.cm-searchMatch': {
    backgroundColor: 'hsl(45 80% 30% / 0.4)',
    outline: '1px solid hsl(45 80% 40% / 0.5)',
  },
  '.cm-searchMatch.cm-searchMatch-selected': {
    backgroundColor: 'hsl(45 80% 40% / 0.6)',
  },
  '.cm-selectionMatch': {
    backgroundColor: 'hsl(210 20% 15%)',
  },
  // Vim fat cursor (normal mode)
  '.cm-fat-cursor': {
    background: 'hsl(0 0% 92% / 0.7) !important',
    color: 'var(--background) !important',
  },
  '&:not(.cm-focused) .cm-fat-cursor': {
    background: 'none !important',
    outline: '1px solid hsl(0 0% 92% / 0.5)',
    color: 'transparent !important',
  },
  // Panels (search, vim command line)
  '.cm-panels': {
    backgroundColor: 'var(--card)',
    color: 'var(--foreground)',
    fontFamily: 'var(--font-mono)',
    fontSize: '12px',
  },
  '.cm-panels.cm-panels-top': {
    borderBottom: '1px solid var(--border-subtle)',
  },
  '.cm-panels.cm-panels-bottom': {
    borderTop: '1px solid var(--border-subtle)',
  },
  '.cm-panel input, .cm-panel button': {
    fontFamily: 'var(--font-mono)',
    fontSize: '12px',
    color: 'var(--foreground)',
    background: 'var(--background)',
    border: '1px solid var(--border)',
    borderRadius: '4px',
    padding: '2px 6px',
  },
  '.cm-panel button:hover': {
    background: 'hsl(0 0% 15%)',
  },
  '.cm-panel label': {
    color: 'var(--muted-foreground)',
  },
  // Tooltip
  '.cm-tooltip': {
    backgroundColor: 'var(--card)',
    border: '1px solid var(--border)',
    color: 'var(--foreground)',
    borderRadius: '6px',
    boxShadow: '0 4px 12px hsl(0 0% 0% / 0.5)',
  },
  '.cm-tooltip-autocomplete > ul > li': {
    padding: '4px 8px',
  },
  '.cm-tooltip-autocomplete > ul > li[aria-selected]': {
    backgroundColor: 'var(--selection-bg)',
    color: 'var(--foreground)',
  },
}, { dark: true });

/**
 * Syntax highlight colors — muted palette harmonizing with dark theme.
 */
export const db9HighlightStyle = syntaxHighlighting(HighlightStyle.define([
  // Keywords & control flow
  { tag: tags.keyword,                    color: 'hsl(280, 40%, 68%)' },
  { tag: tags.controlKeyword,             color: 'hsl(280, 40%, 68%)' },
  { tag: tags.moduleKeyword,              color: 'hsl(280, 40%, 68%)' },
  { tag: tags.operatorKeyword,            color: 'hsl(280, 40%, 68%)' },

  // Operators & punctuation
  { tag: tags.operator,                   color: 'hsl(210, 50%, 65%)' },

  // Literals
  { tag: tags.string,                     color: 'hsl(150, 40%, 55%)' },
  { tag: tags.special(tags.string),       color: 'hsl(150, 50%, 60%)' },
  { tag: tags.number,                     color: 'hsl(30, 60%, 60%)' },
  { tag: tags.bool,                       color: 'hsl(30, 60%, 60%)' },
  { tag: tags.null,                       color: 'hsl(30, 60%, 60%)' },
  { tag: tags.regexp,                     color: 'hsl(0, 50%, 65%)' },

  // Comments
  { tag: tags.comment,                    color: 'hsl(0 0% 38%)', fontStyle: 'italic' },
  { tag: tags.lineComment,                color: 'hsl(0 0% 38%)', fontStyle: 'italic' },
  { tag: tags.blockComment,               color: 'hsl(0 0% 38%)', fontStyle: 'italic' },

  // Variables & properties
  { tag: tags.variableName,               color: 'hsl(200, 50%, 70%)' },
  { tag: tags.definition(tags.variableName), color: 'hsl(200, 50%, 75%)' },
  { tag: tags.propertyName,               color: 'hsl(200, 40%, 70%)' },
  { tag: tags.definition(tags.propertyName), color: 'hsl(200, 40%, 70%)' },

  // Functions
  { tag: tags.function(tags.variableName), color: 'hsl(45, 60%, 65%)' },
  { tag: tags.function(tags.propertyName), color: 'hsl(45, 60%, 65%)' },

  // Types & classes
  { tag: tags.typeName,                   color: 'hsl(170, 40%, 60%)' },
  { tag: tags.className,                  color: 'hsl(170, 40%, 60%)' },
  { tag: tags.namespace,                  color: 'hsl(170, 40%, 60%)' },

  // HTML/JSX tags & attributes
  { tag: tags.tagName,                    color: 'hsl(0, 50%, 65%)' },
  { tag: tags.attributeName,              color: 'hsl(200, 40%, 70%)' },
  { tag: tags.attributeValue,             color: 'hsl(150, 40%, 55%)' },

  // Markdown
  { tag: tags.heading,                    color: 'var(--foreground)', fontWeight: 'bold' },
  { tag: tags.heading1,                   color: 'var(--foreground)', fontWeight: 'bold', fontSize: '1.3em' },
  { tag: tags.heading2,                   color: 'var(--foreground)', fontWeight: 'bold', fontSize: '1.15em' },
  { tag: tags.link,                       color: 'hsl(210, 50%, 55%)', textDecoration: 'underline' },
  { tag: tags.url,                        color: 'hsl(210, 50%, 55%)' },
  { tag: tags.emphasis,                   fontStyle: 'italic' },
  { tag: tags.strong,                     fontWeight: 'bold' },
  { tag: tags.strikethrough,              textDecoration: 'line-through' },

  // Meta & annotations
  { tag: tags.meta,                       color: 'hsl(0 0% 55%)' },
  { tag: tags.annotation,                 color: 'hsl(0 0% 55%)' },
  { tag: tags.processingInstruction,      color: 'hsl(0 0% 55%)' },

  // Special
  { tag: tags.self,                       color: 'hsl(280, 40%, 68%)' },
  { tag: tags.atom,                       color: 'hsl(30, 60%, 60%)' },
  { tag: tags.labelName,                  color: 'hsl(200, 40%, 70%)' },
  { tag: tags.inserted,                   color: 'hsl(150, 40%, 55%)' },
  { tag: tags.deleted,                    color: 'hsl(0, 50%, 60%)' },
  { tag: tags.changed,                    color: 'hsl(45, 60%, 65%)' },
  { tag: tags.invalid,                    color: 'hsl(0, 60%, 55%)' },
]));
