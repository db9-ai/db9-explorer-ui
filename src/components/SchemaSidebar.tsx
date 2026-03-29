import { useState, useEffect, useCallback } from 'react';
import type { Db9Client } from '../lib/db9-client';

interface Props {
  client: Db9Client;
  databaseId: string;
  onInsertQuery: (sql: string) => void;
}

interface ColumnDef {
  name: string;
  type: string;
  nullable: boolean;
  defaultValue?: string;
}

interface TableDef {
  schema: string;
  name: string;
  columns: ColumnDef[];
}

export function SchemaSidebar({ client, databaseId, onInsertQuery }: Props) {
  const [tables, setTables] = useState<TableDef[]>([]);
  const [expandedTable, setExpandedTable] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadSchema = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Query pg_catalog for tables and columns
      const res = await client.sql(databaseId, `
        SELECT
          t.table_schema,
          t.table_name,
          c.column_name,
          c.data_type,
          c.is_nullable,
          c.column_default
        FROM information_schema.tables t
        JOIN information_schema.columns c
          ON c.table_schema = t.table_schema AND c.table_name = t.table_name
        WHERE t.table_schema NOT IN ('pg_catalog', 'information_schema', 'extensions')
          AND t.table_type = 'BASE TABLE'
        ORDER BY t.table_schema, t.table_name, c.ordinal_position
      `);

      if (res.error) {
        const msg = typeof res.error === 'string' ? res.error : res.error.message;
        setError(msg);
        return;
      }

      // Group into tables
      const tableMap = new Map<string, TableDef>();
      for (const row of res.rows) {
        const schema = row[0] as string;
        const tableName = row[1] as string;
        const key = `${schema}.${tableName}`;

        if (!tableMap.has(key)) {
          tableMap.set(key, { schema, name: tableName, columns: [] });
        }
        tableMap.get(key)!.columns.push({
          name: row[2] as string,
          type: row[3] as string,
          nullable: (row[4] as string) === 'YES',
          defaultValue: row[5] as string | undefined,
        });
      }

      setTables(Array.from(tableMap.values()));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [client, databaseId]);

  useEffect(() => { loadSchema(); }, [loadSchema]);

  const toggleTable = (key: string) => {
    setExpandedTable(prev => prev === key ? null : key);
  };

  const handleSelectStar = (t: TableDef) => {
    const ref = t.schema === 'public' ? `"${t.name}"` : `"${t.schema}"."${t.name}"`;
    onInsertQuery(`SELECT * FROM ${ref} LIMIT 100;`);
  };

  return (
    <div className="schema-sidebar">
      <div className="schema-header">
        <span>Schema</span>
        <button className="schema-refresh" onClick={loadSchema} title="Refresh">↻</button>
      </div>
      <div className="schema-content">
        {loading && (
          <div className="schema-loading">Loading schema...</div>
        )}
        {error && (
          <div className="schema-error">{error}</div>
        )}
        {!loading && !error && tables.length === 0 && (
          <div className="schema-empty">No tables found</div>
        )}
        {tables.map(t => {
          const key = `${t.schema}.${t.name}`;
          const isOpen = expandedTable === key;
          return (
            <div key={key} className="schema-table">
              <div
                className={`schema-table-header ${isOpen ? 'open' : ''}`}
                onClick={() => toggleTable(key)}
              >
                <span className={`tree-chevron ${isOpen ? 'open' : ''}`}>▸</span>
                <span className="schema-table-icon">⊞</span>
                <span className="schema-table-name">{t.name}</span>
                {t.schema !== 'public' && (
                  <span className="schema-table-schema">{t.schema}</span>
                )}
                <button
                  className="schema-select-btn"
                  onClick={e => { e.stopPropagation(); handleSelectStar(t); }}
                  title="SELECT * FROM ..."
                >
                  ▶
                </button>
              </div>
              {isOpen && (
                <div className="schema-columns">
                  {t.columns.map(col => (
                    <div key={col.name} className="schema-column">
                      <span className="schema-col-name">{col.name}</span>
                      <span className="schema-col-type">{shortType(col.type)}</span>
                      {!col.nullable && <span className="schema-col-nn" title="NOT NULL">NN</span>}
                      {col.defaultValue && <span className="schema-col-default" title={col.defaultValue}>D</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const TYPE_SHORT: Record<string, string> = {
  'timestamp with time zone': 'timestamptz',
  'timestamp without time zone': 'timestamp',
  'character varying': 'varchar',
  'character': 'char',
  'double precision': 'float8',
  'boolean': 'bool',
  'integer': 'int4',
  'bigint': 'int8',
  'smallint': 'int2',
  'real': 'float4',
  'USER-DEFINED': 'custom',
};

function shortType(t: string): string {
  return TYPE_SHORT[t] || t;
}
