import { escapeSql } from './utils';

export interface SqlResult {
  columns: { name: string; type: string }[];
  rows: unknown[][];
  row_count: number;
  command: string;
  error?: string | { message: string; code?: string };
}

export interface FileInfo {
  path: string;
  type: 'file' | 'dir';
  size: number;
  mode: number;
  mtime: string;
}

export interface DatabaseInfo {
  id: string;
  name: string;
  state: string;
}

export class Db9Error extends Error {
  statusCode?: number;
  constructor(message: string, statusCode?: number) {
    super(message);
    this.name = 'Db9Error';
    this.statusCode = statusCode;
  }
}

export class Db9Client {
  private apiUrl: string;
  private token: string;

  constructor(apiUrl: string, token: string) {
    this.apiUrl = apiUrl.replace(/\/+$/, '');
    this.token = token;
  }

  private async fetch<T>(path: string, init?: RequestInit): Promise<T> {
    const resp = await fetch(`${this.apiUrl}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.token}`,
        ...(init?.headers || {}),
      },
    });
    if (!resp.ok) {
      let msg = resp.statusText;
      try {
        const body = await resp.json();
        msg = body.message || body.error || msg;
      } catch { /* ignore */ }
      throw new Db9Error(msg, resp.status);
    }
    return resp.json();
  }

  async listDatabases(): Promise<DatabaseInfo[]> {
    const dbs = await this.fetch<DatabaseInfo[]>('/customer/databases');
    return dbs.filter(db => db.state === 'ACTIVE');
  }

  async sql(databaseId: string, query: string): Promise<SqlResult> {
    return this.fetch<SqlResult>(`/customer/databases/${encodeURIComponent(databaseId)}/sql`, {
      method: 'POST',
      body: JSON.stringify({ query }),
    });
  }

  private parseSqlError(result: SqlResult): string {
    if (!result.error) return '';
    if (typeof result.error === 'string') return result.error;
    return result.error.message;
  }

  async listDir(databaseId: string, path: string): Promise<FileInfo[]> {
    const safePath = escapeSql(path.endsWith('/') ? path : path + '/');
    const result = await this.sql(databaseId,
      `SELECT path, type, size, mode, mtime FROM extensions.fs9('${safePath}') ORDER BY type DESC, path ASC`
    );
    const err = this.parseSqlError(result);
    if (err) throw new Db9Error(err);
    return result.rows.map(row => ({
      path: row[0] as string,
      type: row[1] as 'file' | 'dir',
      size: Number(row[2]),
      mode: Number(row[3]),
      mtime: row[4] as string,
    }));
  }

  async readFile(databaseId: string, path: string): Promise<string> {
    const safePath = escapeSql(path);
    const result = await this.sql(databaseId, `SELECT fs9_read('${safePath}')`);
    const err = this.parseSqlError(result);
    if (err) throw new Db9Error(err);
    if (result.rows.length === 0) return '';
    return (result.rows[0][0] as string) ?? '';
  }

  async writeFile(databaseId: string, path: string, content: string): Promise<void> {
    const safePath = escapeSql(path);
    const safeContent = escapeSql(content);
    const result = await this.sql(databaseId,
      `SELECT fs9_write('${safePath}', '${safeContent}')`
    );
    const err = this.parseSqlError(result);
    if (err) throw new Db9Error(err);
  }

  async mkdir(databaseId: string, path: string): Promise<void> {
    const safePath = escapeSql(path);
    const result = await this.sql(databaseId,
      `SELECT fs9_mkdir('${safePath}', true)`
    );
    const err = this.parseSqlError(result);
    if (err) throw new Db9Error(err);
  }

  async remove(databaseId: string, path: string, recursive = false): Promise<void> {
    const safePath = escapeSql(path);
    const result = await this.sql(databaseId,
      `SELECT fs9_remove('${safePath}', ${recursive})`
    );
    const err = this.parseSqlError(result);
    if (err) throw new Db9Error(err);
  }

  async exists(databaseId: string, path: string): Promise<boolean> {
    const safePath = escapeSql(path);
    const result = await this.sql(databaseId,
      `SELECT fs9_exists('${safePath}')`
    );
    const err = this.parseSqlError(result);
    if (err) throw new Db9Error(err);
    if (result.rows.length === 0) return false;
    const val = result.rows[0][0];
    return val === true || val === 't' || val === 'true';
  }

  async stat(databaseId: string, path: string): Promise<{ size: number; mtime: string }> {
    const safePath = escapeSql(path);
    const result = await this.sql(databaseId,
      `SELECT fs9_size('${safePath}'), fs9_mtime('${safePath}')`
    );
    const err = this.parseSqlError(result);
    if (err) throw new Db9Error(err);
    return {
      size: Number(result.rows[0]?.[0] ?? 0),
      mtime: (result.rows[0]?.[1] as string) ?? '',
    };
  }
}
