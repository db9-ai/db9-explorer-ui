import { useState, useCallback, useEffect, useRef } from 'react';
import type { Db9Client, FileInfo } from '../lib/db9-client';
import { basename, getFileIcon } from '../lib/utils';

interface Props {
  client: Db9Client;
  databaseId: string;
  selectedPath: string | null;
  onSelectFile: (entry: FileInfo) => void;
  onBack: () => void;
}

interface DirNode {
  children: FileInfo[];
  loading: boolean;
}

/**
 * Always-rooted file tree sidebar for the file viewer.
 * Loads root on mount, auto-expands directories along the selected file's path.
 */
export function ViewerSidebar({
  client, databaseId, selectedPath, onSelectFile, onBack,
}: Props) {
  const [rootEntries, setRootEntries] = useState<FileInfo[]>([]);
  const [expanded, setExpanded] = useState<Map<string, DirNode>>(new Map());
  const [rootLoading, setRootLoading] = useState(true);
  const initRef = useRef(false);

  // Load root entries + auto-expand to selected file on mount
  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    (async () => {
      try {
        const entries = await client.listDir(databaseId, '/');
        setRootEntries(entries);
        setRootLoading(false);

        // Auto-expand directories along the selected file's path
        if (selectedPath) {
          const parts = selectedPath.split('/').filter(Boolean);
          // e.g. "/a/b/c.txt" -> parts = ["a", "b", "c.txt"]
          // We need to expand "/a/" and "/a/b/"
          const dirsToExpand: string[] = [];
          for (let i = 0; i < parts.length - 1; i++) {
            dirsToExpand.push('/' + parts.slice(0, i + 1).join('/') + '/');
          }

          const newExpanded = new Map<string, DirNode>();
          for (const dirPath of dirsToExpand) {
            try {
              const children = await client.listDir(databaseId, dirPath);
              newExpanded.set(dirPath, { children, loading: false });
            } catch {
              // skip if dir can't be loaded
            }
          }
          if (newExpanded.size > 0) {
            setExpanded(newExpanded);
          }
        }
      } catch {
        setRootLoading(false);
      }
    })();
  }, [client, databaseId, selectedPath]);

  const toggleDir = useCallback(async (entry: FileInfo) => {
    const dirPath = entry.path.endsWith('/') ? entry.path : entry.path + '/';

    if (expanded.has(dirPath)) {
      // Collapse
      setExpanded(prev => {
        const next = new Map(prev);
        next.delete(dirPath);
        return next;
      });
      return;
    }

    // Expand — set loading first
    setExpanded(prev => {
      const next = new Map(prev);
      next.set(dirPath, { children: [], loading: true });
      return next;
    });

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

  return (
    <div className="viewer-sidebar">
      <div className="viewer-sidebar-header">
        <button className="viewer-back-btn" onClick={onBack} title="Back to listing">
          ←
        </button>
        <span className="viewer-sidebar-title">/</span>
      </div>
      <div className="viewer-sidebar-list">
        {rootLoading ? (
          <div className="viewer-sidebar-loading" style={{ paddingLeft: 12 }}>Loading…</div>
        ) : (
          rootEntries.map(entry => renderEntry(entry, 0))
        )}
      </div>
    </div>
  );
}
