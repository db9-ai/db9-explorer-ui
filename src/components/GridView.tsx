import type { FileInfo } from '../lib/db9-client';
import { basename, getFileIcon } from '../lib/utils';

interface Props {
  entries: FileInfo[];
  selectedPath: string | null;
  onSelect: (entry: FileInfo) => void;
  onDoubleClick: (entry: FileInfo) => void;
  onContextMenu: (e: React.MouseEvent, entry: FileInfo) => void;
}

export function GridView({ entries, selectedPath, onSelect, onDoubleClick, onContextMenu }: Props) {
  if (entries.length === 0) {
    return (
      <div className="file-grid" style={{ display: 'flex' }}>
        <div className="empty-state">
          <div className="empty-state-text">Empty directory</div>
        </div>
      </div>
    );
  }

  return (
    <div className="file-grid">
      {entries.map(entry => {
        const name = basename(entry.path);
        const isDir = entry.type === 'dir';
        return (
          <div
            key={entry.path}
            className={`file-grid-item ${selectedPath === entry.path ? 'selected' : ''}`}
            onClick={() => onSelect(entry)}
            onDoubleClick={() => onDoubleClick(entry)}
            onContextMenu={e => onContextMenu(e, entry)}
          >
            <div className="file-grid-icon">{getFileIcon(name, isDir)}</div>
            <div className="file-grid-name">{name}</div>
          </div>
        );
      })}
    </div>
  );
}
