import { useState, useCallback, useEffect, useRef } from 'react';
import { Db9Client, type DatabaseInfo } from '../lib/db9-client';

const DEFAULT_API_URL = import.meta.env.DEV ? '/api' : 'https://api.db9.ai';

export interface ConnectionState {
  client: Db9Client | null;
  databaseId: string;
  databaseName: string;
  connected: boolean;
}

export function useConnection() {
  const [state, setState] = useState<ConnectionState>({
    client: null,
    databaseId: '',
    databaseName: '',
    connected: false,
  });
  const [databases, setDatabases] = useState<DatabaseInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const autoConnectAttempted = useRef(false);

  // Auto-connect from URL params or sessionStorage on mount
  useEffect(() => {
    if (autoConnectAttempted.current) return;
    autoConnectAttempted.current = true;

    const params = new URLSearchParams(window.location.search);
    const urlToken = params.get('token');
    const urlDb = params.get('db');
    const urlApi = params.get('api');

    // If URL has token+db, save to sessionStorage, clean URL, and auto-connect
    if (urlToken && urlDb) {
      const apiUrl = urlApi || DEFAULT_API_URL;
      sessionStorage.setItem('db9_api_url', apiUrl);
      sessionStorage.setItem('db9_token', urlToken);
      sessionStorage.setItem('db9_db', urlDb);
      // Clean URL params
      window.history.replaceState({}, '', window.location.pathname);
      autoConnect(apiUrl, urlToken, urlDb);
      return;
    }

    // Try sessionStorage
    const ssToken = sessionStorage.getItem('db9_token');
    const ssDb = sessionStorage.getItem('db9_db');
    const ssApi = sessionStorage.getItem('db9_api_url');
    if (ssToken && ssDb) {
      autoConnect(ssApi || DEFAULT_API_URL, ssToken, ssDb);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function autoConnect(apiUrl: string, token: string, dbIdOrName: string) {
    setLoading(true);
    setError(null);
    try {
      const client = new Db9Client(apiUrl, token);
      const dbs = await client.listDatabases();
      // Match by id or name
      const db = dbs.find(d => d.id === dbIdOrName || d.name === dbIdOrName);
      if (!db) {
        setError(`Database "${dbIdOrName}" not found`);
        setDatabases(dbs);
        setLoading(false);
        return;
      }
      sessionStorage.setItem('db9_api_url', apiUrl);
      sessionStorage.setItem('db9_token', token);
      sessionStorage.setItem('db9_db', db.id);
      setState({
        client,
        databaseId: db.id,
        databaseName: db.name || db.id,
        connected: true,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  const fetchDatabases = useCallback(async (apiUrl: string, token: string) => {
    setLoading(true);
    setError(null);
    try {
      const client = new Db9Client(apiUrl, token);
      const dbs = await client.listDatabases();
      setDatabases(dbs);
      return dbs;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      setDatabases([]);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const connect = useCallback((apiUrl: string, token: string, db: DatabaseInfo) => {
    const client = new Db9Client(apiUrl, token);
    sessionStorage.setItem('db9_api_url', apiUrl);
    sessionStorage.setItem('db9_token', token);
    sessionStorage.setItem('db9_db', db.id);
    setState({
      client,
      databaseId: db.id,
      databaseName: db.name || db.id,
      connected: true,
    });
    setError(null);
  }, []);

  const disconnect = useCallback(() => {
    sessionStorage.removeItem('db9_token');
    sessionStorage.removeItem('db9_db');
    sessionStorage.removeItem('db9_api_url');
    setState({ client: null, databaseId: '', databaseName: '', connected: false });
    setDatabases([]);
    setError(null);
  }, []);

  return { ...state, databases, loading, error, fetchDatabases, connect, disconnect };
}
