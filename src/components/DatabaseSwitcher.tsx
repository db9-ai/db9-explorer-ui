import { useState, useEffect, useCallback } from 'react';
import type { Db9Client, DatabaseInfo } from '../lib/db9-client';

interface Props {
  client: Db9Client;
  currentDatabaseId: string;
  onSwitch: (db: DatabaseInfo) => void;
  onClose: () => void;
}

export function DatabaseSwitcher({ client, currentDatabaseId, onSwitch, onClose }: Props) {
  const [databases, setDatabases] = useState<DatabaseInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);

  const fetchDatabases = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const dbs = await client.listDatabases();
      setDatabases(dbs);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [client]);

  useEffect(() => {
    fetchDatabases();
  }, [fetchDatabases]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newName.trim();
    if (!name || creating) return;
    setCreating(true);
    setError(null);
    try {
      const db = await client.createDatabase(name);
      onSwitch(db);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setCreating(false);
    }
  };

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog db-switcher" onClick={e => e.stopPropagation()}>
        <div className="dialog-title">Databases</div>

        {loading ? (
          <div className="db-switcher-loading">
            <div className="spinner" />
          </div>
        ) : (
          <div className="db-switcher-list">
            {databases.map(db => (
              <button
                key={db.id}
                className={`db-switcher-item ${db.id === currentDatabaseId ? 'current' : ''}`}
                onClick={() => {
                  if (db.id !== currentDatabaseId) onSwitch(db);
                }}
              >
                <span className="db-switcher-name">{db.name || db.id}</span>
                <span className="db-switcher-meta">
                  {db.id === currentDatabaseId ? (
                    <span className="db-switcher-badge">current</span>
                  ) : (
                    <span className="db-switcher-id">{db.id.slice(0, 8)}</span>
                  )}
                </span>
              </button>
            ))}
          </div>
        )}

        {error && <div className="db-switcher-error">{error}</div>}

        <div className="db-switcher-footer">
          {showCreate ? (
            <form className="db-switcher-create" onSubmit={handleCreate}>
              <input
                type="text"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder="database-name"
                autoFocus
                disabled={creating}
              />
              <button
                type="submit"
                className="btn-sm btn-primary"
                disabled={!newName.trim() || creating}
              >
                {creating ? 'Creating…' : 'Create'}
              </button>
              <button
                type="button"
                className="btn-sm btn-secondary"
                onClick={() => { setShowCreate(false); setNewName(''); }}
                disabled={creating}
              >
                Cancel
              </button>
            </form>
          ) : (
            <button
              className="btn-sm btn-secondary db-switcher-new-btn"
              onClick={() => setShowCreate(true)}
            >
              + New Database
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
