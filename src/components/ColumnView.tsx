import type { FileInfo } from '../lib/db9-client';
import type { ColumnEntry } from '../hooks/useFileSystem';
import { basename, getFileIcon } from '../lib/utils';

interface Props {
  columns: ColumnEntry[];
  selectedPaths: Set<string>;
  onSelect: (entry: FileInfo, e: React.MouseEvent) => void;
  onContextMenu: (e: React.MouseEvent, entry: FileInfo) => void;
}

export function ColumnView({ columns, selectedPaths, onSelect, onContextMenu }: Props) {
  return (
    <div className="column-view">
      {columns.map((col, i) => (
        <div className="column-pane" key={col.path + i}>
          {col.entries.length === 0 ? (
            <div style={{ padding: '12px', fontSize: 12, color: 'var(--text-muted)' }}>
              Empty
            </div>
          ) : (
            col.entries.map(entry => {
              const name = basename(entry.path);
              const isDir = entry.type === 'dir';
              return (
                <div
                  key={entry.path}
                  className={`column-item ${isDir ? 'dir' : ''} ${selectedPaths.has(entry.path) ? 'selected' : ''}`}
                  onClick={e => onSelect(entry, e)}
                  onContextMenu={e => onContextMenu(e, entry)}
                >
                  <span className="icon">{getFileIcon(name, isDir)}</span>
                  <span className="name">{name}</span>
                  {isDir && <span className="arrow">›</span>}
                </div>
              );
            })
          )}
        </div>
      ))}
    </div>
  );
}
