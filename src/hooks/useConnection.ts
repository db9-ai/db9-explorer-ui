import { useState, useEffect, useRef, useCallback } from 'react';
import { Db9Client, type DatabaseInfo } from '../lib/db9-client';

const TOKEN_KEY = 'db9_token';

/** Check if running under `db9 explore` CLI (session secret injected). */
function hasSessionSecret(): boolean {
  const secret = (window as unknown as Record<string, unknown>).__DB9_SESSION_SECRET__;
  return typeof secret === 'string' && secret !== '__DB9_LOCAL_SECRET__';
}

export type ConnectionPhase = 'login' | 'loading' | 'pick-db' | 'connected' | 'error';

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

  // Determine initial phase:
  // - Dev mode (Vite proxy handles auth) → skip login
  // - CLI mode (session secret injected) → skip login
  // - Saved token in sessionStorage → restore token, skip login
  // - Otherwise → show login screen
  const initialPhase = (() => {
    if (hasSessionSecret()) return 'loading' as const;
    const saved = sessionStorage.getItem(TOKEN_KEY);
    if (saved) {
      client.setToken(saved);
      return 'loading' as const;
    }
    return 'login' as const;
  })();

  const [state, setState] = useState<ConnectionState>({
    phase: initialPhase,
    client,
    databases: [],
    databaseId: '',
    databaseName: '',
    error: null,
  });

  const initAttempted = useRef(false);

  useEffect(() => {
    if (initAttempted.current) return;
    if (state.phase === 'login') return; // wait for token
    initAttempted.current = true;
    bootstrap();
  }, [state.phase]); // eslint-disable-line react-hooks/exhaustive-deps

  function applyDbList(dbs: DatabaseInfo[]) {
    if (dbs.length === 0) {
      setState(s => ({ ...s, phase: 'error', error: 'No active databases found.' }));
    } else if (dbs.length === 1) {
      setState(s => ({
        ...s,
        phase: 'connected',
        databases: dbs,
        databaseId: dbs[0].id,
        databaseName: dbs[0].name || dbs[0].id,
      }));
    } else {
      setState(s => ({ ...s, phase: 'pick-db', databases: dbs }));
    }
  }

  async function bootstrap() {
    const params = new URLSearchParams(window.location.search);
    const dbParam = params.get('db');

    // Clean URL params
    if (dbParam) {
      window.history.replaceState({}, '', window.location.pathname + window.location.hash);
    }

    // Try to read dbId from hash URL: /#/<dbId>/browse/...
    const hashPath = window.location.hash.replace(/^#/, '');
    const hashDbId = hashPath.split('/').filter(Boolean)[0] || '';

    // Priority: ?db= param > hash URL dbId
    const targetDb = dbParam || hashDbId;

    try {
      if (targetDb) {
        const db = await client.getDatabase(targetDb);
        setState(s => ({
          ...s,
          phase: 'connected',
          databaseId: db.id,
          databaseName: db.name || db.id,
          error: null,
        }));
        return;
      }

      // No target — list databases and pick
      const dbs = await client.listDatabases();
      applyDbList(dbs);
    } catch (err) {
      // If hash dbId lookup failed, fall back to listing databases
      if (hashDbId && !dbParam) {
        try {
          const dbs = await client.listDatabases();
          applyDbList(dbs);
          return;
        } catch { /* fall through */ }
      }
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

  const submitToken = useCallback((token: string) => {
    sessionStorage.setItem(TOKEN_KEY, token);
    client.setToken(token);
    initAttempted.current = false;
    setState(s => ({ ...s, phase: 'loading', error: null }));
  }, [client]);

  const logout = useCallback(() => {
    sessionStorage.removeItem(TOKEN_KEY);
    client.setToken(null);
    initAttempted.current = false;
    setState(s => ({
      ...s,
      phase: 'login',
      databases: [],
      databaseId: '',
      databaseName: '',
      error: null,
    }));
  }, [client]);

  return { ...state, pickDatabase, switchDatabase, submitToken, logout };
}
