import { useState, useRef, useCallback, useEffect } from 'react';
import type { Db9Client, SqlResult } from '../lib/db9-client';
import { SchemaSidebar } from './SchemaSidebar';
import { SqlCodeMirror } from './SqlCodeMirror';

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

const HISTORY_KEY = 'db9-sql-history';
const MAX_HISTORY = 200;

function loadHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return [];
}

function saveHistory(entries: HistoryEntry[]) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(entries.slice(0, MAX_HISTORY)));
  } catch { /* ignore */ }
}

export function SqlExplorer({ client, databaseId }: Props) {
  const [query, setQuery] = useState('SELECT 1;');
  const [result, setResult] = useState<SqlResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>(loadHistory);
  const [showHistory, setShowHistory] = useState(false);
  const [historyFilter, setHistoryFilter] = useState('');
  const historyFilterRef = useRef<HTMLInputElement>(null);

  // Persist history to localStorage
  useEffect(() => {
    saveHistory(history);
  }, [history]);

  // Focus filter when history opens
  useEffect(() => {
    if (showHistory) {
      historyFilterRef.current?.focus();
    } else {
      setHistoryFilter('');
    }
  }, [showHistory]);

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
        }, ...prev].slice(0, MAX_HISTORY));
      } else {
        setResult(res);
        setHistory(prev => [{
          query: trimmed, timestamp: Date.now(), success: true, rowCount: res.row_count, durationMs,
        }, ...prev].slice(0, MAX_HISTORY));
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      setHistory(prev => [{
        query: trimmed, timestamp: Date.now(), success: false, error: msg,
        durationMs: Math.round(performance.now() - start),
      }, ...prev].slice(0, MAX_HISTORY));
    } finally {
      setRunning(false);
    }
  }, [client, databaseId, query, running]);

  const loadFromHistory = useCallback((entry: HistoryEntry) => {
    setQuery(entry.query);
    setShowHistory(false);
  }, []);

  const handleInsertQuery = useCallback((sql: string) => {
    setQuery(sql);
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
          <SqlCodeMirror
            value={query}
            onChange={setQuery}
            onExecute={executeQuery}
            placeholder="SELECT * FROM ..."
          />
        </div>

        {/* History dropdown */}
        {showHistory && (
          <div className="sql-history">
            <div className="sql-history-header">
              <input
                ref={historyFilterRef}
                className="sql-history-filter"
                type="text"
                value={historyFilter}
                onChange={e => setHistoryFilter(e.target.value)}
                placeholder="Filter history…"
              />
              {history.length > 0 && (
                <button
                  className="btn-sm btn-secondary"
                  style={{ fontSize: 10, flexShrink: 0 }}
                  onClick={() => { setHistory([]); setHistoryFilter(''); }}
                >
                  Clear
                </button>
              )}
            </div>
            {history.length === 0 ? (
              <div className="sql-history-empty">No queries yet</div>
            ) : (
              (() => {
                const filtered = historyFilter.trim()
                  ? history.filter(e =>
                      e.query.toLowerCase().includes(historyFilter.toLowerCase())
                    )
                  : history;
                return filtered.length === 0 ? (
                  <div className="sql-history-empty">No matching queries</div>
                ) : (
                  filtered.map((entry, i) => (
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
                  ))
                );
              })()
            )}
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
