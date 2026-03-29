export function formatSize(bytes: number): string {
  if (bytes === 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

export function formatDate(mtime: string): string {
  if (!mtime) return '—';
  try {
    const d = new Date(mtime);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    if (diff < 60_000) return 'just now';
    if (diff < 3600_000) return `${Math.floor(diff / 60_000)}m ago`;
    if (diff < 86400_000) return `${Math.floor(diff / 3600_000)}h ago`;
    if (diff < 604800_000) return `${Math.floor(diff / 86400_000)}d ago`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return mtime;
  }
}

export function basename(path: string): string {
  const parts = path.replace(/\/+$/, '').split('/');
  return parts[parts.length - 1] || '/';
}

export function dirname(path: string): string {
  const parts = path.replace(/\/+$/, '').split('/');
  parts.pop();
  const dir = parts.join('/');
  return dir || '/';
}

export function joinPath(...parts: string[]): string {
  const joined = parts.join('/').replace(/\/+/g, '/');
  return joined || '/';
}

export function getFileIcon(name: string, isDir: boolean): string {
  if (isDir) return '📁';
  const ext = name.split('.').pop()?.toLowerCase() || '';
  const icons: Record<string, string> = {
    md: '📝', txt: '📄', json: '📋', yaml: '⚙️', yml: '⚙️', toml: '⚙️',
    js: '📜', ts: '📜', jsx: '📜', tsx: '📜', py: '🐍', rs: '🦀', go: '🔷',
    html: '🌐', css: '🎨', sql: '🗃️',
    png: '🖼️', jpg: '🖼️', jpeg: '🖼️', gif: '🖼️', svg: '🖼️', webp: '🖼️',
    csv: '📊', tsv: '📊', parquet: '📊',
    log: '📋', env: '🔒', lock: '🔒',
    sh: '⚡', bash: '⚡', zsh: '⚡',
  };
  return icons[ext] || '📄';
}

export function isTextFile(name: string): boolean {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  const textExts = new Set([
    'txt', 'md', 'json', 'yaml', 'yml', 'toml', 'xml',
    'js', 'ts', 'jsx', 'tsx', 'py', 'rs', 'go', 'rb', 'java', 'c', 'cpp', 'h',
    'html', 'css', 'scss', 'less', 'sql',
    'sh', 'bash', 'zsh', 'fish',
    'csv', 'tsv', 'log', 'env', 'gitignore', 'dockerignore',
    'makefile', 'dockerfile',
    'conf', 'cfg', 'ini', 'properties',
    'jsonl', 'ndjson',
  ]);
  return textExts.has(ext) || name.startsWith('.');
}

export function escapeSql(s: string): string {
  return s.replace(/'/g, "''");
}
