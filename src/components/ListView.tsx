import type { FileInfo } from '../lib/db9-client';
import { basename, formatSize, formatDate, getFileIcon } from '../lib/utils';

interface Props {
  entries: FileInfo[];
  selectedPath: string | null;
  onSelect: (entry: FileInfo) => void;
  onDoubleClick: (entry: FileInfo) => void;
  onContextMenu: (e: React.MouseEvent, entry: FileInfo) => void;
}

export function ListView({ entries, selectedPath, onSelect, onDoubleClick, onContextMenu }: Props) {
  return (
    <div className="file-list">
      <div className="file-list-header">
        <span>Name</span>
        <span className="right">Size</span>
        <span>Modified</span>
        <span>Type</span>
      </div>
      {entries.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-text">Empty directory</div>
        </div>
      ) : (
        entries.map(entry => {
          const name = basename(entry.path);
          const isDir = entry.type === 'dir';
          return (
            <div
              key={entry.path}
              className={`file-list-row ${selectedPath === entry.path ? 'selected' : ''}`}
              onClick={() => onSelect(entry)}
              onDoubleClick={() => onDoubleClick(entry)}
              onContextMenu={e => onContextMenu(e, entry)}
            >
              <div className={`file-list-name ${isDir ? 'dir' : ''}`}>
                <span className="icon">{getFileIcon(name, isDir)}</span>
                <span className="name">{name}</span>
              </div>
              <div className="file-list-cell right">{isDir ? '—' : formatSize(entry.size)}</div>
              <div className="file-list-cell">{formatDate(entry.mtime)}</div>
              <div className="file-list-cell">{isDir ? 'Folder' : name.split('.').pop() || 'File'}</div>
            </div>
          );
        })
      )}
    </div>
  );
}
