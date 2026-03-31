import { useState, useEffect, useRef, useCallback } from 'react';
import type { Db9Client, FileInfo } from '../lib/db9-client';
import { basename, getFileIcon } from '../lib/utils';

interface Props {
  client: Db9Client;
  databaseId: string;
  onSelect: (entry: FileInfo) => void;
  onClose: () => void;
}

/** Simple fuzzy match: all query chars appear in order in the target */
function fuzzyMatch(query: string, target: string): { match: boolean; score: number } {
  const q = query.toLowerCase();
  const t = target.toLowerCase();
  let qi = 0;
  let score = 0;
  let prevMatch = false;

  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) {
      // Bonus for consecutive matches and start-of-segment matches
      score += prevMatch ? 10 : 1;
      if (ti === 0 || t[ti - 1] === '/') score += 5;
      prevMatch = true;
      qi++;
    } else {
      prevMatch = false;
    }
  }

  return { match: qi === q.length, score };
}

export function QuickOpen({ client, databaseId, onSelect, onClose }: Props) {
  const [query, setQuery] = useState('');
  const [allFiles, setAllFiles] = useState<FileInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Load all files recursively on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const files = await client.listDirRecursive(databaseId, '/');
        if (!cancelled) {
          setAllFiles(files.filter(f => f.type === 'file'));
          setLoading(false);
        }
      } catch {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [client, databaseId]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Filter and sort results
  const results = query.trim()
    ? allFiles
        .map(f => ({ file: f, ...fuzzyMatch(query, f.path) }))
        .filter(r => r.match)
        .sort((a, b) => b.score - a.score)
        .slice(0, 20)
        .map(r => r.file)
    : allFiles.slice(0, 20);

  // Reset selection index when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Scroll selected item into view
  useEffect(() => {
    const item = listRef.current?.children[selectedIndex] as HTMLElement | undefined;
    item?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => Math.min(prev + 1, results.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => Math.max(prev - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (results[selectedIndex]) {
          onSelect(results[selectedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        onClose();
        break;
    }
  }, [results, selectedIndex, onSelect, onClose]);

  return (
    <div className="quick-open-overlay" onClick={onClose}>
      <div className="quick-open" onClick={e => e.stopPropagation()}>
        <input
          ref={inputRef}
          className="quick-open-input"
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={loading ? 'Loading file index…' : 'Search files by name or path…'}
        />
        <div className="quick-open-results" ref={listRef}>
          {results.length === 0 && !loading && (
            <div className="quick-open-empty">
              {query ? 'No matching files' : 'No files found'}
            </div>
          )}
          {results.map((file, i) => {
            const name = basename(file.path);
            const dir = file.path.slice(0, -name.length);
            return (
              <div
                key={file.path}
                className={`quick-open-item ${i === selectedIndex ? 'selected' : ''}`}
                onClick={() => onSelect(file)}
                onMouseEnter={() => setSelectedIndex(i)}
              >
                <span className="icon">{getFileIcon(name, false)}</span>
                <span className="quick-open-name">{name}</span>
                <span className="quick-open-path">{dir}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
