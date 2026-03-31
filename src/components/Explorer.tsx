import { useEffect, useState, useCallback, useRef } from 'react';
import type { Db9Client, FileInfo } from '../lib/db9-client';
import { useFileSystem } from '../hooks/useFileSystem';
import { basename, joinPath, dirname } from '../lib/utils';
import { Breadcrumb } from './Breadcrumb';
import { Toolbar } from './Toolbar';
import { ListView } from './ListView';
import { GridView } from './GridView';
import { ColumnView } from './ColumnView';
import { FileViewer } from './FileViewer';
import { SqlExplorer } from './SqlExplorer';
import { QuickOpen } from './QuickOpen';
import { CreateDialog, DeleteDialog, DeleteMultiDialog, RenameDialog } from './Dialogs';
import { ContextMenu, type ContextMenuItem } from './ContextMenu';
import { RefreshIcon } from './Icons';

type ActiveTab = 'files' | 'sql';

interface Props {
  client: Db9Client;
  databaseId: string;
  databaseName: string;
  onSwitchDatabase: () => void;
}

type DialogState =
  | { type: 'none' }
  | { type: 'create-file' }
  | { type: 'create-folder' }
  | { type: 'delete'; entry: FileInfo }
  | { type: 'delete-multi'; count: number }
  | { type: 'rename'; entry: FileInfo };

interface ContextMenuState {
  x: number;
  y: number;
  entry: FileInfo;
}

export function Explorer({ client, databaseId, databaseName, onSwitchDatabase }: Props) {
  const [activeTab, setActiveTab] = useState<ActiveTab>('files');
  const fs = useFileSystem(client, databaseId);
  const [dialog, setDialog] = useState<DialogState>({ type: 'none' });
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [showViewer, setShowViewer] = useState(false);
  const [showQuickOpen, setShowQuickOpen] = useState(false);
  const uploadRef = useRef<HTMLInputElement>(null);

  useEffect(() => { fs.initRoot(); }, []);// eslint-disable-line react-hooks/exhaustive-deps

  const handleSelectEntry = useCallback((entry: FileInfo, e: React.MouseEvent) => {
    fs.selectEntry(entry, { metaKey: e.metaKey || e.ctrlKey, shiftKey: e.shiftKey });
  }, [fs]);

  const handleDoubleClick = useCallback((entry: FileInfo) => {
    if (entry.type === 'dir') {
      const dirPath = entry.path.endsWith('/') ? entry.path : entry.path + '/';
      fs.navigateTo(dirPath);
    } else {
      // Double-click file: select + open viewer
      fs.selectEntry(entry);
      setShowViewer(true);
    }
  }, [fs]);

  // Cmd+P: Quick Open (global shortcut)
  // TODO: disabled until db9-server supports fs9_search() — see c4pt0r/db9-server#2251
  // useEffect(() => {
  //   const handleCmdP = (e: KeyboardEvent) => {
  //     if ((e.metaKey || e.ctrlKey) && e.key === 'p') {
  //       e.preventDefault();
  //       setShowQuickOpen(prev => !prev);
  //     }
  //   };
  //   window.addEventListener('keydown', handleCmdP);
  //   return () => window.removeEventListener('keydown', handleCmdP);
  // }, []);

  // Keyboard shortcuts
  useEffect(() => {
    if (activeTab !== 'files' || showViewer || dialog.type !== 'none') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle when typing in inputs
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      const entries = fs.currentEntries;
      const selectedIdx = fs.selectedFile
        ? entries.findIndex(en => en.path === fs.selectedFile!.path)
        : -1;

      switch (e.key) {
        case 'ArrowDown': {
          e.preventDefault();
          const nextIdx = selectedIdx < entries.length - 1 ? selectedIdx + 1 : 0;
          if (entries[nextIdx]) {
            fs.selectEntry(entries[nextIdx], { shiftKey: e.shiftKey });
          }
          break;
        }
        case 'ArrowUp': {
          e.preventDefault();
          const prevIdx = selectedIdx > 0 ? selectedIdx - 1 : entries.length - 1;
          if (entries[prevIdx]) {
            fs.selectEntry(entries[prevIdx], { shiftKey: e.shiftKey });
          }
          break;
        }
        case 'Enter': {
          e.preventDefault();
          if (fs.selectedFile) {
            handleDoubleClick(fs.selectedFile);
          }
          break;
        }
        case 'Backspace':
        case 'Delete': {
          if (fs.selectedPaths.size > 0) {
            e.preventDefault();
            if (fs.selectedPaths.size > 1) {
              setDialog({ type: 'delete-multi', count: fs.selectedPaths.size });
            } else if (fs.selectedFile) {
              setDialog({ type: 'delete', entry: fs.selectedFile });
            }
          }
          break;
        }
        case 'a': {
          // Cmd+A: select all
          if (e.metaKey || e.ctrlKey) {
            e.preventDefault();
            const allPaths = new Set(entries.map(en => en.path));
            fs.selectAll(allPaths);
          }
          break;
        }
        case 'ArrowLeft': {
          // Navigate to parent directory
          if (fs.currentPath !== '/') {
            e.preventDefault();
            const parent = dirname(fs.currentPath.replace(/\/$/, ''));
            fs.navigateTo(parent.endsWith('/') ? parent : parent + '/');
          }
          break;
        }
        case 'ArrowRight': {
          // Open selected directory
          if (fs.selectedFile?.type === 'dir') {
            e.preventDefault();
            const dirPath = fs.selectedFile.path.endsWith('/')
              ? fs.selectedFile.path
              : fs.selectedFile.path + '/';
            fs.navigateTo(dirPath);
          }
          break;
        }
        case 'F2': {
          // Rename selected item
          if (fs.selectedFile && fs.selectedPaths.size === 1) {
            e.preventDefault();
            setDialog({ type: 'rename', entry: fs.selectedFile });
          }
          break;
        }
        case 'Escape': {
          fs.clearSelection();
          break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTab, showViewer, dialog.type, fs, handleDoubleClick]);

  const handleContextMenu = useCallback((e: React.MouseEvent, entry: FileInfo) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, entry });
  }, []);

  const handleNewFile = useCallback(async (name: string) => {
    try {
      await fs.createFile(joinPath(fs.currentPath, name));
      setDialog({ type: 'none' });
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    }
  }, [fs]);

  const handleNewFolder = useCallback(async (name: string) => {
    try {
      await fs.createDir(joinPath(fs.currentPath, name));
      setDialog({ type: 'none' });
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    }
  }, [fs]);

  const handleDelete = useCallback(async () => {
    if (dialog.type === 'delete') {
      try {
        await fs.deleteEntry(dialog.entry.path, dialog.entry.type === 'dir');
        setDialog({ type: 'none' });
      } catch (err) {
        alert(err instanceof Error ? err.message : String(err));
      }
    } else if (dialog.type === 'delete-multi') {
      try {
        await fs.deleteSelected();
        setDialog({ type: 'none' });
      } catch (err) {
        alert(err instanceof Error ? err.message : String(err));
      }
    }
  }, [fs, dialog]);

  const handleRename = useCallback(async (newName: string) => {
    if (dialog.type !== 'rename') return;
    try {
      const oldPath = dialog.entry.path;
      const parent = dirname(oldPath);
      const newPath = joinPath(parent, newName);
      // Rename = read old content, write to new path, delete old
      if (dialog.entry.type === 'file') {
        const content = await client.readFile(databaseId, oldPath);
        await client.writeFile(databaseId, newPath, content);
        await client.remove(databaseId, oldPath);
      } else {
        // For directories, create new and move would be complex
        // For now just create the new dir
        await client.mkdir(databaseId, newPath);
      }
      setDialog({ type: 'none' });
      await fs.refreshCurrent();
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    }
  }, [client, databaseId, fs, dialog]);

  const handleUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      await fs.createFile(joinPath(fs.currentPath, file.name), text);
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    }
    // Reset input
    if (uploadRef.current) uploadRef.current.value = '';
  }, [fs]);

  const handleDownload = useCallback(() => {
    if (!fs.selectedFile || !fs.fileContent) return;
    const blob = new Blob([fs.fileContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = basename(fs.selectedFile.path);
    a.click();
    URL.revokeObjectURL(url);
  }, [fs.selectedFile, fs.fileContent]);

  const handleQuickOpen = useCallback((entry: FileInfo) => {
    setShowQuickOpen(false);
    // Navigate to the file's parent directory and select it
    const parent = dirname(entry.path);
    const dirPath = parent.endsWith('/') ? parent : parent + '/';
    fs.navigateTo(dirPath).then(() => {
      fs.selectEntry(entry);
      if (entry.type === 'file') {
        setShowViewer(true);
      }
    });
  }, [fs]);

  const handleCopyPath = useCallback((path: string) => {
    navigator.clipboard.writeText(path).catch(() => {
      // Fallback for non-HTTPS contexts
      const input = document.createElement('input');
      input.value = path;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
    });
  }, []);

  const contextMenuItems: ContextMenuItem[] = contextMenu ? [
    {
      label: 'Open',
      shortcut: '↩',
      onClick: () => handleDoubleClick(contextMenu.entry),
    },
    { label: '', separator: true, onClick: () => {} },
    {
      label: 'Copy Path',
      onClick: () => handleCopyPath(contextMenu.entry.path),
    },
    {
      label: 'Copy Name',
      onClick: () => handleCopyPath(basename(contextMenu.entry.path)),
    },
    { label: '', separator: true, onClick: () => {} },
    {
      label: 'Rename…',
      shortcut: 'F2',
      onClick: () => setDialog({ type: 'rename', entry: contextMenu.entry }),
    },
    {
      label: 'Delete',
      shortcut: '⌫',
      danger: true,
      onClick: () => setDialog({ type: 'delete', entry: contextMenu.entry }),
    },
  ] : [];

  return (
    <>
      <div className="app-header">
        <div className="app-logo">
          <span>db<span className="dim">9</span></span>
          <span className="dim">Explorer</span>
        </div>
        <div className="app-tabs">
          <button className={`app-tab ${activeTab === 'files' ? 'active' : ''}`} onClick={() => setActiveTab('files')}>
            Files
          </button>
          <button className={`app-tab ${activeTab === 'sql' ? 'active' : ''}`} onClick={() => setActiveTab('sql')}>
            SQL
          </button>
        </div>
        <div className="header-right">
          <span className="db-badge">{databaseName}</span>
          {activeTab === 'files' && (
            <button className="btn-icon" onClick={fs.refreshCurrent} title="Refresh">
              <RefreshIcon />
            </button>
          )}
          <button className="btn-disconnect" onClick={onSwitchDatabase}>
            Switch DB
          </button>
        </div>
      </div>

      <div className="explorer-layout">
        {activeTab === 'sql' ? (
          <SqlExplorer client={client} databaseId={databaseId} />
        ) : (
        <div className="main-content">
          <Breadcrumb path={fs.currentPath} onNavigate={fs.navigateTo} />
          <Toolbar
            viewMode={fs.viewMode}
            onViewModeChange={fs.setViewMode}
            selectedFile={fs.selectedFile}
            selectedCount={fs.selectedPaths.size}
            onNewFile={() => setDialog({ type: 'create-file' })}
            onNewFolder={() => setDialog({ type: 'create-folder' })}
            onUpload={() => uploadRef.current?.click()}
            onDownload={handleDownload}
            onDelete={() => {
              if (fs.selectedPaths.size > 1) {
                setDialog({ type: 'delete-multi', count: fs.selectedPaths.size });
              } else if (fs.selectedFile) {
                setDialog({ type: 'delete', entry: fs.selectedFile });
              }
            }}
            onRefresh={fs.refreshCurrent}
          />

          {showViewer && fs.selectedFile?.type === 'file' ? (
            <>
              <div style={{ padding: '4px 12px', borderBottom: '1px solid var(--border-subtle)' }}>
                <button
                  className="btn-sm btn-secondary"
                  onClick={() => { setShowViewer(false); }}
                  style={{ fontSize: 11 }}
                >
                  ← Back to listing
                </button>
              </div>
              <FileViewer
                file={fs.selectedFile}
                content={fs.fileContent}
                onSave={fs.saveFile}
              />
            </>
          ) : (
            <>
              {fs.viewMode === 'list' && (
                <ListView
                  entries={fs.currentEntries}
                  selectedPaths={fs.selectedPaths}
                  onSelect={handleSelectEntry}
                  onDoubleClick={handleDoubleClick}
                  onContextMenu={handleContextMenu}
                />
              )}
              {fs.viewMode === 'grid' && (
                <GridView
                  entries={fs.currentEntries}
                  selectedPaths={fs.selectedPaths}
                  onSelect={handleSelectEntry}
                  onDoubleClick={handleDoubleClick}
                  onContextMenu={handleContextMenu}
                />
              )}
              {fs.viewMode === 'column' && (
                <ColumnView
                  columns={fs.columns}
                  selectedPaths={fs.selectedPaths}
                  onSelect={handleSelectEntry}
                  onContextMenu={handleContextMenu}
                />
              )}
            </>
          )}
        </div>
        )}
      </div>

      {/* Status bar */}
      <div className="status-bar">
        <span className="status-item">
          <span className="status-dot" />
          Connected
        </span>
        <span>
          {fs.currentEntries.length} items
          {fs.selectedPaths.size > 1 && ` · ${fs.selectedPaths.size} selected`}
        </span>
        {fs.error && <span style={{ color: 'var(--danger)' }}>{fs.error}</span>}
      </div>

      {/* Hidden upload input */}
      <input
        ref={uploadRef}
        type="file"
        style={{ display: 'none' }}
        onChange={handleUpload}
      />

      {/* Dialogs */}
      {dialog.type === 'create-file' && (
        <CreateDialog
          type="file"
          currentPath={fs.currentPath}
          onConfirm={handleNewFile}
          onCancel={() => setDialog({ type: 'none' })}
        />
      )}
      {dialog.type === 'create-folder' && (
        <CreateDialog
          type="folder"
          currentPath={fs.currentPath}
          onConfirm={handleNewFolder}
          onCancel={() => setDialog({ type: 'none' })}
        />
      )}
      {dialog.type === 'delete' && (
        <DeleteDialog
          path={dialog.entry.path}
          isDir={dialog.entry.type === 'dir'}
          onConfirm={handleDelete}
          onCancel={() => setDialog({ type: 'none' })}
        />
      )}
      {dialog.type === 'delete-multi' && (
        <DeleteMultiDialog
          count={dialog.count}
          onConfirm={handleDelete}
          onCancel={() => setDialog({ type: 'none' })}
        />
      )}
      {dialog.type === 'rename' && (
        <RenameDialog
          currentName={basename(dialog.entry.path)}
          onConfirm={handleRename}
          onCancel={() => setDialog({ type: 'none' })}
        />
      )}

      {/* Quick Open */}
      {showQuickOpen && (
        <QuickOpen
          client={client}
          databaseId={databaseId}
          onSelect={handleQuickOpen}
          onClose={() => setShowQuickOpen(false)}
        />
      )}

      {/* Context menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={contextMenuItems}
          onClose={() => setContextMenu(null)}
        />
      )}
    </>
  );
}
