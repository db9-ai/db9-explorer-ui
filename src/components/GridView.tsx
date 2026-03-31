import { useRef } from 'react';
import type { FileInfo } from '../lib/db9-client';
import { basename, getFileIcon } from '../lib/utils';
import { useMarqueeSelection } from '../hooks/useMarqueeSelection';

interface Props {
  entries: FileInfo[];
  selectedPaths: Set<string>;
  onSelect: (entry: FileInfo, e: React.MouseEvent) => void;
  onDoubleClick: (entry: FileInfo) => void;
  onContextMenu: (e: React.MouseEvent, entry: FileInfo) => void;
  onMarqueeSelect: (paths: Set<string>) => void;
}

export function GridView({ entries, selectedPaths, onSelect, onDoubleClick, onContextMenu, onMarqueeSelect }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { marqueeRect } = useMarqueeSelection({
    containerRef,
    itemSelector: '.file-grid-item',
    selectedPaths,
    onSelectionChange: onMarqueeSelect,
  });

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
    <div className="file-grid" ref={containerRef}>
      {entries.map(entry => {
        const name = basename(entry.path);
        const isDir = entry.type === 'dir';
        return (
          <div
            key={entry.path}
            data-path={entry.path}
            className={`file-grid-item ${selectedPaths.has(entry.path) ? 'selected' : ''}`}
            onClick={e => onSelect(entry, e)}
            onDoubleClick={() => onDoubleClick(entry)}
            onContextMenu={e => onContextMenu(e, entry)}
          >
            <div className="file-grid-icon">{getFileIcon(name, isDir)}</div>
            <div className="file-grid-name">{name}</div>
          </div>
        );
      })}
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
