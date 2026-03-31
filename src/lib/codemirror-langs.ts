import { LanguageSupport, StreamLanguage } from '@codemirror/language';

type LangLoader = () => Promise<LanguageSupport>;

const shellLang = (): Promise<LanguageSupport> =>
  import('@codemirror/legacy-modes/mode/shell').then(m =>
    new LanguageSupport(StreamLanguage.define(m.shell))
  );

/**
 * Maps file extensions to CodeMirror language support loaders.
 * Each loader uses a dynamic import() so Vite code-splits the parsers.
 */
const LANG_MAP: Record<string, LangLoader> = {
  // JavaScript / TypeScript
  js:   () => import('@codemirror/lang-javascript').then(m => m.javascript()),
  mjs:  () => import('@codemirror/lang-javascript').then(m => m.javascript()),
  cjs:  () => import('@codemirror/lang-javascript').then(m => m.javascript()),
  jsx:  () => import('@codemirror/lang-javascript').then(m => m.javascript({ jsx: true })),
  ts:   () => import('@codemirror/lang-javascript').then(m => m.javascript({ typescript: true })),
  tsx:  () => import('@codemirror/lang-javascript').then(m => m.javascript({ jsx: true, typescript: true })),

  // Python
  py:   () => import('@codemirror/lang-python').then(m => m.python()),

  // SQL (PostgreSQL dialect)
  sql:  () => import('@codemirror/lang-sql').then(m => m.sql({ dialect: m.PostgreSQL })),

  // JSON
  json:  () => import('@codemirror/lang-json').then(m => m.json()),
  jsonl: () => import('@codemirror/lang-json').then(m => m.json()),

  // Markdown
  md:       () => import('@codemirror/lang-markdown').then(m => m.markdown()),
  markdown: () => import('@codemirror/lang-markdown').then(m => m.markdown()),

  // HTML / XML
  html: () => import('@codemirror/lang-html').then(m => m.html()),
  htm:  () => import('@codemirror/lang-html').then(m => m.html()),
  xml:  () => import('@codemirror/lang-html').then(m => m.html()),
  svg:  () => import('@codemirror/lang-html').then(m => m.html()),

  // CSS
  css:  () => import('@codemirror/lang-css').then(m => m.css()),
  scss: () => import('@codemirror/lang-css').then(m => m.css()),
  less: () => import('@codemirror/lang-css').then(m => m.css()),

  // Go
  go: () => import('@codemirror/lang-go').then(m => m.go()),

  // Rust
  rs: () => import('@codemirror/lang-rust').then(m => m.rust()),

  // YAML
  yaml: () => import('@codemirror/lang-yaml').then(m => m.yaml()),
  yml:  () => import('@codemirror/lang-yaml').then(m => m.yaml()),

  // Java
  java: () => import('@codemirror/lang-java').then(m => m.java()),

  // C / C++
  c:   () => import('@codemirror/lang-cpp').then(m => m.cpp()),
  cpp: () => import('@codemirror/lang-cpp').then(m => m.cpp()),
  cc:  () => import('@codemirror/lang-cpp').then(m => m.cpp()),
  h:   () => import('@codemirror/lang-cpp').then(m => m.cpp()),
  hpp: () => import('@codemirror/lang-cpp').then(m => m.cpp()),

  // TOML (via legacy mode)
  toml: () => import('@codemirror/legacy-modes/mode/toml').then(m =>
    new LanguageSupport(StreamLanguage.define(m.toml))
  ),

  // Shell (via legacy mode)
  sh:   shellLang,
  bash: shellLang,
  zsh:  shellLang,
};

/**
 * Returns PostgreSQL SQL language support (for the SQL editor).
 */
export function getPostgresLanguage(): Promise<LanguageSupport> {
  return import('@codemirror/lang-sql').then(m =>
    m.sql({ dialect: m.PostgreSQL, upperCaseKeywords: true })
  );
}

/**
 * Returns a LanguageSupport for the given filename, or null if unknown.
 */
export async function getLanguageSupport(filename: string): Promise<LanguageSupport | null> {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  const loader = LANG_MAP[ext];
  if (!loader) return null;
  try {
    return await loader();
  } catch {
    return null;
  }
}
