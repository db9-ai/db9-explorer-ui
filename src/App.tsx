import { Routes, Route, Navigate } from 'react-router-dom';
import { useConnection } from './hooks/useConnection';
import { DatabasePicker } from './components/ConnectPanel';
import { Explorer } from './components/Explorer';

export default function App() {
  const conn = useConnection();

  if (conn.phase === 'loading') {
    return (
      <div className="connect-screen">
        <div className="connect-card">
          <div className="connect-title">
            <span>db<span className="dim">9</span></span>
            <span className="dim">Explorer</span>
          </div>
          <div className="connect-subtitle">Connecting…</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div className="shimmer" style={{ height: 44, borderRadius: 10 }} />
            <div className="shimmer" style={{ height: 44, borderRadius: 10, opacity: 0.6 }} />
          </div>
        </div>
      </div>
    );
  }

  if (conn.phase === 'error') {
    return (
      <div className="connect-screen">
        <div className="connect-card">
          <div className="connect-title">
            <span>db<span className="dim">9</span></span>
            <span className="dim">Explorer</span>
          </div>
          <div className="connect-error">{conn.error}</div>
        </div>
      </div>
    );
  }

  if (conn.phase === 'pick-db') {
    return (
      <DatabasePicker
        databases={conn.databases}
        onPick={conn.pickDatabase}
      />
    );
  }

  const explorer = (
    <Explorer
      client={conn.client}
      databaseId={conn.databaseId}
      databaseName={conn.databaseName}
      onSwitchDatabase={conn.switchDatabase}
    />
  );

  return (
    <Routes>
      <Route path="/sql" element={explorer} />
      <Route path="/view/*" element={explorer} />
      <Route path="/browse/*" element={explorer} />
      <Route path="*" element={<Navigate to="/browse/" replace />} />
    </Routes>
  );
}
