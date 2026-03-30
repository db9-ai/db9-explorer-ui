import type { DatabaseInfo } from '../lib/db9-client';

interface Props {
  databases: DatabaseInfo[];
  onPick: (db: DatabaseInfo) => void;
}

/**
 * Lightweight database picker — shown only when no `?db=` param
 * is provided and the user has multiple databases.
 *
 * No token / API URL inputs — the local proxy handles auth.
 */
export function DatabasePicker({ databases, onPick }: Props) {
  return (
    <div className="connect-screen">
      <div className="connect-card">
        <div className="connect-title">
          <span>db<span className="dim">9</span></span>
          <span className="dim">Explorer</span>
        </div>
        <div className="connect-subtitle">Select a database</div>

        <div className="db-picker-list">
          {databases.map(db => (
            <button
              key={db.id}
              className="db-picker-item"
              onClick={() => onPick(db)}
            >
              <span className="db-picker-name">{db.name || db.id}</span>
              <span className="db-picker-id">{db.id.slice(0, 8)}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
