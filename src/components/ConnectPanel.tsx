import { useState, useEffect } from 'react';
import type { DatabaseInfo } from '../lib/db9-client';

interface Props {
  databases: DatabaseInfo[];
  loading: boolean;
  error: string | null;
  onFetchDatabases: (apiUrl: string, token: string) => Promise<DatabaseInfo[]>;
  onConnect: (apiUrl: string, token: string, db: DatabaseInfo) => void;
}

const DEFAULT_API_URL = import.meta.env.DEV ? '/api' : 'https://api.db9.ai';

export function ConnectPanel({ databases, loading, error, onFetchDatabases, onConnect }: Props) {
  const [apiUrl, setApiUrl] = useState(() => {
    const stored = sessionStorage.getItem('db9_api_url');
    if (import.meta.env.DEV && (!stored || stored === 'https://api.db9.ai')) {
      return DEFAULT_API_URL;
    }
    return stored || DEFAULT_API_URL;
  });
  const [token, setToken] = useState(() => sessionStorage.getItem('db9_token') || '');
  const [selectedDbId, setSelectedDbId] = useState('');
  const [fetched, setFetched] = useState(false);

  useEffect(() => {
    if (databases.length > 0 && !selectedDbId) {
      setSelectedDbId(databases[0].id);
    }
  }, [databases, selectedDbId]);

  const handleFetch = async () => {
    sessionStorage.setItem('db9_api_url', apiUrl);
    sessionStorage.setItem('db9_token', token);
    const dbs = await onFetchDatabases(apiUrl, token);
    setFetched(true);
    if (dbs.length > 0) setSelectedDbId(dbs[0].id);
  };

  const handleConnect = () => {
    const db = databases.find(d => d.id === selectedDbId);
    if (db) onConnect(apiUrl, token, db);
  };

  return (
    <div className="connect-screen">
      <div className="connect-card">
        <div className="connect-title">
          <span>db</span><span className="dim">9</span> <span className="dim">FS Explorer</span>
        </div>
        <div className="connect-subtitle">Connect to a database to browse its filesystem</div>

        <div className="form-group">
          <label className="form-label">API URL</label>
          <input
            className="form-input"
            value={apiUrl}
            onChange={e => setApiUrl(e.target.value)}
            placeholder="https://api.db9.ai"
          />
        </div>

        <div className="form-group">
          <label className="form-label">API Token</label>
          <input
            className="form-input"
            type="password"
            value={token}
            onChange={e => { setToken(e.target.value); setFetched(false); }}
            placeholder="db9_..."
            onKeyDown={e => e.key === 'Enter' && !fetched && handleFetch()}
          />
        </div>

        {!fetched || databases.length === 0 ? (
          <button
            className="btn-connect"
            onClick={handleFetch}
            disabled={loading || !token.trim()}
          >
            {loading ? 'Loading...' : 'Fetch Databases'}
          </button>
        ) : (
          <>
            <div className="form-group">
              <label className="form-label">Database</label>
              <select
                className="form-select"
                value={selectedDbId}
                onChange={e => setSelectedDbId(e.target.value)}
              >
                {databases.map(db => (
                  <option key={db.id} value={db.id}>
                    {db.name || db.id}
                  </option>
                ))}
              </select>
            </div>
            <button
              className="btn-connect"
              onClick={handleConnect}
              disabled={!selectedDbId}
            >
              Connect
            </button>
          </>
        )}

        {error && <div className="connect-error">{error}</div>}
      </div>
    </div>
  );
}
