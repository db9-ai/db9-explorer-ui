import { useState, useEffect, useRef, useCallback } from 'react';
import { Db9Client, type DatabaseInfo } from '../lib/db9-client';

export type ConnectionPhase = 'loading' | 'pick-db' | 'connected' | 'error';

export interface ConnectionState {
  phase: ConnectionPhase;
  client: Db9Client;
  databases: DatabaseInfo[];
  databaseId: string;
  databaseName: string;
  error: string | null;
}

/**
 * Resolves the database to connect to.
 *
 * Priority:
 *  1. `?db=<name-or-id>` URL parameter (set by `db9 explore [DB]`)
 *  2. Show database picker if multiple databases exist
 *  3. Auto-connect if exactly one database exists
 */
export function useConnection() {
  const client = useRef(new Db9Client()).current;

  const [state, setState] = useState<ConnectionState>({
    phase: 'loading',
    client,
    databases: [],
    databaseId: '',
    databaseName: '',
    error: null,
  });

  const initAttempted = useRef(false);

  useEffect(() => {
    if (initAttempted.current) return;
    initAttempted.current = true;
    bootstrap();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function bootstrap() {
    const params = new URLSearchParams(window.location.search);
    const dbParam = params.get('db');

    // Clean URL params
    if (dbParam) {
      window.history.replaceState({}, '', window.location.pathname);
    }

    try {
      // If ?db= is provided, try to connect directly
      if (dbParam) {
        const db = await client.getDatabase(dbParam);
        setState(s => ({
          ...s,
          phase: 'connected',
          databaseId: db.id,
          databaseName: db.name || db.id,
          error: null,
        }));
        return;
      }

      // Otherwise list databases and pick
      const dbs = await client.listDatabases();
      if (dbs.length === 0) {
        setState(s => ({ ...s, phase: 'error', error: 'No active databases found.' }));
        return;
      }
      if (dbs.length === 1) {
        setState(s => ({
          ...s,
          phase: 'connected',
          databases: dbs,
          databaseId: dbs[0].id,
          databaseName: dbs[0].name || dbs[0].id,
        }));
        return;
      }
      // Multiple databases — let user pick
      setState(s => ({ ...s, phase: 'pick-db', databases: dbs }));
    } catch (err) {
      setState(s => ({
        ...s,
        phase: 'error',
        error: err instanceof Error ? err.message : String(err),
      }));
    }
  }

  const pickDatabase = useCallback((db: DatabaseInfo) => {
    setState(s => ({
      ...s,
      phase: 'connected',
      databaseId: db.id,
      databaseName: db.name || db.id,
    }));
  }, []);

  const switchDatabase = useCallback(async () => {
    try {
      const dbs = await client.listDatabases();
      setState(s => ({ ...s, phase: 'pick-db', databases: dbs, error: null }));
    } catch (err) {
      setState(s => ({
        ...s,
        error: err instanceof Error ? err.message : String(err),
      }));
    }
  }, [client]);

  return { ...state, pickDatabase, switchDatabase };
}
