import { useState, useCallback } from 'react';
import type { Db9Client, FileInfo } from '../lib/db9-client';
import { basename, getFileIcon } from '../lib/utils';

interface Props {
  client: Db9Client;
  databaseId: string;
  entries: FileInfo[];
  currentPath: string;
  selectedPath: string | null;
  onSelectFile: (entry: FileInfo) => void;
  onBack: () => void;
}

interface DirNode {
  children: FileInfo[];
  loading: boolean;
}

export function ViewerSidebar({
  client, databaseId, entries, currentPath, selectedPath, onSelectFile, onBack,
}: Props) {
  const [expanded, setExpanded] = useState<Map<string, DirNode>>(new Map());

  const toggleDir = useCallback(async (entry: FileInfo) => {
    const dirPath = entry.path.endsWith('/') ? entry.path : entry.path + '/';

    setExpanded(prev => {
      const next = new Map(prev);
      if (next.has(dirPath)) {
        next.delete(dirPath);
        return next;
      }
      next.set(dirPath, { children: [], loading: true });
      return next;
    });

    // If we're opening, load children
    if (!expanded.has(dirPath)) {
      try {
        const children = await client.listDir(databaseId, dirPath);
        setExpanded(prev => {
          const next = new Map(prev);
          next.set(dirPath, { children, loading: false });
          return next;
        });
      } catch {
        setExpanded(prev => {
          const next = new Map(prev);
          next.delete(dirPath);
          return next;
        });
      }
    }
  }, [client, databaseId, expanded]);

  const renderEntry = (entry: FileInfo, depth: number) => {
    const name = basename(entry.path);
    const isDir = entry.type === 'dir';
    const isActive = entry.path === selectedPath;
    const dirPath = entry.path.endsWith('/') ? entry.path : entry.path + '/';
    const node = isDir ? expanded.get(dirPath) : null;
    const isOpen = !!node;

    return (
      <div key={entry.path}>
        <div
          className={`viewer-sidebar-item ${isActive ? 'active' : ''} ${isDir ? 'dir' : ''}`}
          style={{ paddingLeft: 12 + depth * 16 }}
          onClick={() => {
            if (isDir) {
              toggleDir(entry);
            } else {
              onSelectFile(entry);
            }
          }}
        >
          {isDir ? (
            <span className={`viewer-sidebar-chevron ${isOpen ? 'open' : ''}`}>▸</span>
          ) : (
            <span className="viewer-sidebar-chevron spacer" />
          )}
          <span className="viewer-sidebar-icon">{getFileIcon(name, isDir)}</span>
          <span className="viewer-sidebar-name">{name}</span>
        </div>
        {isOpen && node && (
          <div className="viewer-sidebar-children">
            {node.loading ? (
              <div className="viewer-sidebar-loading" style={{ paddingLeft: 12 + (depth + 1) * 16 }}>
                Loading…
              </div>
            ) : (
              node.children.map(child => renderEntry(child, depth + 1))
            )}
          </div>
        )}
      </div>
    );
  };

  const dirName = currentPath === '/' ? '/' : basename(currentPath.replace(/\/$/, ''));

  return (
    <div className="viewer-sidebar">
      <div className="viewer-sidebar-header">
        <button className="viewer-back-btn" onClick={onBack} title="Back to listing">
          ←
        </button>
        <span className="viewer-sidebar-title">{dirName}</span>
      </div>
      <div className="viewer-sidebar-list">
        {entries.map(entry => renderEntry(entry, 0))}
      </div>
    </div>
  );
}
