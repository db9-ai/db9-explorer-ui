import { useState, useRef, useCallback, useEffect } from 'react';
import type { Db9Client, SqlResult } from '../lib/db9-client';
import { SchemaSidebar } from './SchemaSidebar';

interface Props {
  client: Db9Client;
  databaseId: string;
}

interface HistoryEntry {
  query: string;
  timestamp: number;
  success: boolean;
  rowCount?: number;
  error?: string;
  durationMs?: number;
}

export function SqlExplorer({ client, databaseId }: Props) {
  const [query, setQuery] = useState('SELECT 1;');
  const [result, setResult] = useState<SqlResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.max(120, Math.min(el.scrollHeight, 400)) + 'px';
  }, [query]);

  const executeQuery = useCallback(async () => {
    const trimmed = query.trim();
    if (!trimmed || running) return;

    setRunning(true);
    setError(null);
    setResult(null);
    const start = performance.now();

    try {
      const res = await client.sql(databaseId, trimmed);
      const durationMs = Math.round(performance.now() - start);

      if (res.error) {
        const msg = typeof res.error === 'string' ? res.error : res.error.message;
        setError(msg);
        setHistory(prev => [{
          query: trimmed, timestamp: Date.now(), success: false, error: msg, durationMs,
        }, ...prev].slice(0, 50));
      } else {
        setResult(res);
        setHistory(prev => [{
          query: trimmed, timestamp: Date.now(), success: true, rowCount: res.row_count, durationMs,
        }, ...prev].slice(0, 50));
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      setHistory(prev => [{
        query: trimmed, timestamp: Date.now(), success: false, error: msg,
        durationMs: Math.round(performance.now() - start),
      }, ...prev].slice(0, 50));
    } finally {
      setRunning(false);
    }
  }, [client, databaseId, query, running]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      executeQuery();
    }
  }, [executeQuery]);

  const loadFromHistory = useCallback((entry: HistoryEntry) => {
    setQuery(entry.query);
    setShowHistory(false);
    textareaRef.current?.focus();
  }, []);

  const handleInsertQuery = useCallback((sql: string) => {
    setQuery(sql);
    textareaRef.current?.focus();
  }, []);

  return (
    <div className="sql-layout">
      <SchemaSidebar
        client={client}
        databaseId={databaseId}
        onInsertQuery={handleInsertQuery}
      />
      <div className="sql-explorer">
        {/* Editor */}
        <div className="sql-editor-section">
          <div className="sql-editor-header">
            <span className="sql-editor-label">Query</span>
            <div className="sql-editor-actions">
              <button
                className={`toolbar-btn ${showHistory ? 'active' : ''}`}
                onClick={() => setShowHistory(!showHistory)}
              >
                History ({history.length})
              </button>
              <button
                className="btn-sm btn-primary"
                onClick={executeQuery}
                disabled={running || !query.trim()}
              >
                {running ? 'Running...' : 'Run'}
                <span className="sql-shortcut">⌘↵</span>
              </button>
            </div>
          </div>
          <textarea
            ref={textareaRef}
            className="sql-textarea"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="SELECT * FROM ..."
            spellCheck={false}
          />
        </div>

        {/* History dropdown */}
        {showHistory && history.length > 0 && (
          <div className="sql-history">
            <div className="sql-history-header">Recent Queries</div>
            {history.map((entry, i) => (
              <div
                key={i}
                className="sql-history-item"
                onClick={() => loadFromHistory(entry)}
              >
                <div className="sql-history-query">{entry.query}</div>
                <div className="sql-history-meta">
                  <span className={entry.success ? 'sql-ok' : 'sql-err'}>
                    {entry.success ? `${entry.rowCount} rows` : 'error'}
                  </span>
                  {entry.durationMs !== undefined && (
                    <span>{entry.durationMs}ms</span>
                  )}
                  <span>{formatTimeAgo(entry.timestamp)}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="sql-error">
            <span className="sql-error-label">ERROR</span>
            {error}
          </div>
        )}

        {/* Results */}
        {result && !error && (
          <div className="sql-results">
            <div className="sql-results-header">
              <span>{result.command} — {result.row_count} row{result.row_count !== 1 ? 's' : ''}</span>
              <span className="sql-results-cols">{result.columns.length} column{result.columns.length !== 1 ? 's' : ''}</span>
            </div>
            {result.columns.length > 0 && result.rows.length > 0 ? (
              <div className="sql-table-wrap">
                <table className="sql-table">
                  <thead>
                    <tr>
                      {result.columns.map((col, i) => (
                        <th key={i}>
                          <span className="sql-col-name">{col.name}</span>
                          <span className="sql-col-type">{col.type}</span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {result.rows.map((row, ri) => (
                      <tr key={ri}>
                        {row.map((cell, ci) => (
                          <td key={ci}>{formatCell(cell)}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="sql-empty-result">
                Query executed successfully. No rows returned.
              </div>
            )}
          </div>
        )}

        {!result && !error && !running && (
          <div className="sql-placeholder">
            Write a SQL query and press <kbd>⌘</kbd>+<kbd>Enter</kbd> to execute
          </div>
        )}
      </div>
    </div>
  );
}

function formatCell(value: unknown): string {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function formatTimeAgo(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60_000) return 'just now';
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86400_000) return `${Math.floor(diff / 3600_000)}h ago`;
  return new Date(ts).toLocaleDateString();
}
