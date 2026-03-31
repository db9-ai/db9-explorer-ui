import { useRef } from 'react';
import type { FileInfo } from '../lib/db9-client';
import { basename, formatSize, formatDate, getFileIcon } from '../lib/utils';
import { useMarqueeSelection } from '../hooks/useMarqueeSelection';

interface Props {
  entries: FileInfo[];
  selectedPaths: Set<string>;
  onSelect: (entry: FileInfo, e: React.MouseEvent) => void;
  onDoubleClick: (entry: FileInfo) => void;
  onContextMenu: (e: React.MouseEvent, entry: FileInfo) => void;
  onMarqueeSelect: (paths: Set<string>) => void;
}

export function ListView({ entries, selectedPaths, onSelect, onDoubleClick, onContextMenu, onMarqueeSelect }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { marqueeRect } = useMarqueeSelection({
    containerRef,
    itemSelector: '.file-list-row',
    selectedPaths,
    onSelectionChange: onMarqueeSelect,
  });

  return (
    <div className="file-list" ref={containerRef}>
      <div className="file-list-header">
        <span>Name</span>
        <span className="right">Size</span>
        <span className="col-modified">Modified</span>
        <span className="col-type">Type</span>
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
              data-path={entry.path}
              className={`file-list-row ${selectedPaths.has(entry.path) ? 'selected' : ''}`}
              onClick={e => onSelect(entry, e)}
              onDoubleClick={() => onDoubleClick(entry)}
              onContextMenu={e => onContextMenu(e, entry)}
            >
              <div className={`file-list-name ${isDir ? 'dir' : ''}`}>
                <span className="icon">{getFileIcon(name, isDir)}</span>
                <span className="name">{name}</span>
              </div>
              <div className="file-list-cell right">{isDir ? '—' : formatSize(entry.size)}</div>
              <div className="file-list-cell col-modified">{formatDate(entry.mtime)}</div>
              <div className="file-list-cell col-type">{isDir ? 'Folder' : name.split('.').pop() || 'File'}</div>
            </div>
          );
        })
      )}
      {marqueeRect && (
        <div
          className="marquee-rect"
          style={{
            left: marqueeRect.x,
            top: marqueeRect.y,
            width: marqueeRect.width,
            height: marqueeRect.height,
          }}
        />
      )}
    </div>
  );
}
