import { useConnection } from './hooks/useConnection';
import { ConnectPanel } from './components/ConnectPanel';
import { Explorer } from './components/Explorer';

export default function App() {
  const conn = useConnection();

  if (!conn.connected || !conn.client) {
    return (
      <ConnectPanel
        databases={conn.databases}
        loading={conn.loading}
        error={conn.error}
        onFetchDatabases={conn.fetchDatabases}
        onConnect={conn.connect}
      />
    );
  }

  return (
    <Explorer
      client={conn.client}
      databaseId={conn.databaseId}
      databaseName={conn.databaseName}
      onDisconnect={conn.disconnect}
    />
  );
}
