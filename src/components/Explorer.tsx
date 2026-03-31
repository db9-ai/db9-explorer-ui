import { useEffect, useState, useCallback, useRef } from 'react';
import { useLocation, useNavigate, useBlocker } from 'react-router-dom';
import type { Db9Client, FileInfo } from '../lib/db9-client';
import { useFileSystem } from '../hooks/useFileSystem';
import { basename, joinPath, dirname, isTextFile, formatSize } from '../lib/utils';
import { useDropZone, type UploadProgress } from '../hooks/useDropZone';
import { ViewerSidebar } from './ViewerSidebar';
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
import { DatabaseSwitcher } from './DatabaseSwitcher';
import type { DatabaseInfo } from '../lib/db9-client';
import { RefreshIcon } from './Icons';

const MAX_UPLOAD_SIZE = 1024 * 1024; // 1 MB per file

interface Props {
  client: Db9Client;
  databaseId: string;
  databaseName: string;
  onConnectDatabase: (db: DatabaseInfo) => void;
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

export function Explorer({ client, databaseId, databaseName, onConnectDatabase }: Props) {
  const location = useLocation();
  const navigate = useNavigate();
  const fs = useFileSystem(client, databaseId);
  const [dialog, setDialog] = useState<DialogState>({ type: 'none' });
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [showQuickOpen, setShowQuickOpen] = useState(false);
  const [showDbSwitcher, setShowDbSwitcher] = useState(false);
  const [editorDirty, setEditorDirty] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);
  const uploadRef = useRef<HTMLInputElement>(null);
  const mainContentRef = useRef<HTMLDivElement>(null);

  // --- Derive state from URL ---
  const activeTab = location.pathname.startsWith(`/${databaseId}/sql`) ? 'sql' as const : 'files' as const;
  const showViewer = location.pathname.startsWith(`/${databaseId}/view/`);

  // --- Drag-and-drop upload ---
  const handleDropUpload = useCallback(async (files: File[]) => {
    const errors: string[] = [];
    const validFiles: File[] = [];

    for (const file of files) {
      if (file.size > MAX_UPLOAD_SIZE) {
        errors.push(`${file.name}: too large (${formatSize(file.size)}, max 1 MB). Use db9 CLI for large files.`);
        continue;
      }
      if (!isTextFile(file.name)) {
        errors.push(`${file.name}: binary files not supported in browser. Use db9 CLI.`);
        continue;
      }
      validFiles.push(file);
    }

    if (validFiles.length === 0 && errors.length > 0) {
      alert(errors.join('\n'));
      return;
    }

    const progress: UploadProgress = {
      total: validFiles.length,
      completed: 0,
      current: validFiles[0]?.name || '',
      errors,
    };
    setUploadProgress({ ...progress });

    for (const file of validFiles) {
      progress.current = file.name;
      setUploadProgress({ ...progress });
      try {
        const text = await file.text();
        await fs.createFile(joinPath(fs.currentPath, file.name), text);
        progress.completed++;
      } catch (err) {
        progress.errors.push(`${file.name}: ${err instanceof Error ? err.message : String(err)}`);
        progress.completed++;
      }
      setUploadProgress({ ...progress });
    }

    // Show errors if any, then clear
    if (progress.errors.length > 0) {
      alert(`Upload complete (${progress.completed - progress.errors.length}/${progress.total} succeeded)\n\n${progress.errors.join('\n')}`);
    }
    setUploadProgress(null);
  }, [fs]);

  const { isDragOver } = useDropZone({
    containerRef: mainContentRef,
    onUpload: handleDropUpload,
    enabled: activeTab === 'files' && !showViewer,
  });

  // URL prefix for this database
  const dbPrefix = `/${databaseId}`;

  // Extract fs path from URL (strip /:dbId/browse/ or /:dbId/view/)
  const getPathFromUrl = useCallback((): string => {
    const browsePrefix = `${dbPrefix}/browse/`;
    const viewPrefix = `${dbPrefix}/view/`;
    if (location.pathname.startsWith(browsePrefix)) {
      return '/' + location.pathname.slice(browsePrefix.length);
    }
    if (location.pathname.startsWith(viewPrefix)) {
      return '/' + location.pathname.slice(viewPrefix.length);
    }
    return '/';
  }, [location.pathname, dbPrefix]);

  const currentFsPath = getPathFromUrl();

  // --- Navigation helpers (push to router) ---
  const navigateToDir = useCallback((dirPath: string) => {
    const clean = dirPath.startsWith('/') ? dirPath : '/' + dirPath;
    navigate(dbPrefix + '/browse' + clean);
  }, [navigate, dbPrefix]);

  const navigateToFile = useCallback((filePath: string) => {
    const clean = filePath.startsWith('/') ? filePath : '/' + filePath;
    navigate(dbPrefix + '/view' + clean);
  }, [navigate, dbPrefix]);

  // --- Block navigation when editor is dirty ---
  const blocker = useBlocker(editorDirty);

  useEffect(() => {
    if (blocker.state === 'blocked') {
      const proceed = window.confirm('You have unsaved changes. Discard them?');
      if (proceed) {
        blocker.proceed();
      } else {
        blocker.reset();
      }
    }
  }, [blocker]);

  // Browser beforeunload guard
  useEffect(() => {
    if (!editorDirty) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [editorDirty]);

  // --- Sync fs state from URL ---
  const prevPathRef = useRef<string | null>(null);

  useEffect(() => {
    if (activeTab !== 'files') return;
    const fsPath = currentFsPath;

    if (showViewer) {
      // Viewing a file — select it, load content
      const parentDir = dirname(fsPath);
      const dirPath = parentDir.endsWith('/') ? parentDir : parentDir + '/';

      if (prevPathRef.current !== dirPath) {
        fs.navigateTo(dirPath).then(() => {
          const entry: FileInfo = { path: fsPath, type: 'file', size: 0, mode: 0, mtime: '' };
          fs.selectEntry(entry);
        });
      } else {
        const entry: FileInfo = { path: fsPath, type: 'file', size: 0, mode: 0, mtime: '' };
        fs.selectEntry(entry);
      }
      prevPathRef.current = dirPath;
    } else {
      // Browsing a directory
      const dirPath = fsPath.endsWith('/') ? fsPath : fsPath + '/';
      if (prevPathRef.current !== dirPath) {
        fs.navigateTo(dirPath);
        prevPathRef.current = dirPath;
      }
    }
  }, [currentFsPath, showViewer, activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

  // Init root on mount and when database changes
  useEffect(() => {
    fs.initRoot();
    if (activeTab === 'files' && !showViewer) {
      navigate(dbPrefix + '/browse/', { replace: true });
    }
  }, [databaseId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSelectEntry = useCallback((entry: FileInfo, e: React.MouseEvent) => {
    fs.selectEntry(entry, { metaKey: e.metaKey || e.ctrlKey, shiftKey: e.shiftKey });
  }, [fs]);

  const handleMarqueeSelect = useCallback((paths: Set<string>) => {
    fs.selectAll(paths);
  }, [fs]);

  const handleDoubleClick = useCallback((entry: FileInfo) => {
    if (entry.type === 'dir') {
      const dirPath = entry.path.endsWith('/') ? entry.path : entry.path + '/';
      navigateToDir(dirPath);
    } else {
      fs.selectEntry(entry);
      navigateToFile(entry.path);
    }
  }, [fs, navigateToDir, navigateToFile]);

  // Keyboard shortcuts
  useEffect(() => {
    if (activeTab !== 'files' || showViewer || dialog.type !== 'none') return;

    const handleKeyDown = (e: KeyboardEvent) => {
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
          if (e.metaKey || e.ctrlKey) {
            e.preventDefault();
            const allPaths = new Set(entries.map(en => en.path));
            fs.selectAll(allPaths);
          }
          break;
        }
        case 'ArrowLeft': {
          if (fs.currentPath !== '/') {
            e.preventDefault();
            const parent = dirname(fs.currentPath.replace(/\/$/, ''));
            navigateToDir(parent.endsWith('/') ? parent : parent + '/');
          }
          break;
        }
        case 'ArrowRight': {
          if (fs.selectedFile?.type === 'dir') {
            e.preventDefault();
            const dirPath = fs.selectedFile.path.endsWith('/')
              ? fs.selectedFile.path
              : fs.selectedFile.path + '/';
            navigateToDir(dirPath);
          }
          break;
        }
        case 'F2': {
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
  }, [activeTab, showViewer, dialog.type, fs, handleDoubleClick, navigateToDir]);

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
      if (dialog.entry.type === 'file') {
        const content = await client.readFile(databaseId, oldPath);
        await client.writeFile(databaseId, newPath, content);
        await client.remove(databaseId, oldPath);
      } else {
        await client.mkdir(databaseId, newPath);
      }
      setDialog({ type: 'none' });
      // Clear all caches so sidebar/tree reflect the rename
      fs.clearCache();
      await fs.refreshCurrent();
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    }
  }, [client, databaseId, fs, dialog]);

  const handleUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      await handleDropUpload(files);
    }
    if (uploadRef.current) uploadRef.current.value = '';
  }, [handleDropUpload]);

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
    if (entry.type === 'file') {
      navigateToFile(entry.path);
    } else {
      const dirPath = entry.path.endsWith('/') ? entry.path : entry.path + '/';
      navigateToDir(dirPath);
    }
  }, [navigateToDir, navigateToFile]);

  const handleCopyPath = useCallback((path: string) => {
    navigator.clipboard.writeText(path).catch(() => {
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
          <button
            className={`app-tab ${activeTab === 'files' ? 'active' : ''}`}
            onClick={() => navigateToDir(fs.currentPath)}
          >
            Files
          </button>
          <button
            className={`app-tab ${activeTab === 'sql' ? 'active' : ''}`}
            onClick={() => navigate(dbPrefix + '/sql')}
          >
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
          <button className="btn-disconnect" onClick={() => setShowDbSwitcher(true)}>
            Switch DB
          </button>
        </div>
      </div>

      <div className="explorer-layout">
        {activeTab === 'sql' ? (
          <SqlExplorer client={client} databaseId={databaseId} />
        ) : (
        <div className="main-content" ref={mainContentRef}>
          <Breadcrumb path={fs.currentPath} onNavigate={navigateToDir} />
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
            <div className="viewer-with-sidebar">
              <ViewerSidebar
                client={client}
                databaseId={databaseId}
                selectedPath={fs.selectedFile.path}
                onSelectFile={(entry) => {
                  if (entry.type === 'file') {
                    navigateToFile(entry.path);
                  } else {
                    const dirPath = entry.path.endsWith('/') ? entry.path : entry.path + '/';
                    navigateToDir(dirPath);
                  }
                }}
                onBack={() => navigateToDir(fs.currentPath)}
              />
              <FileViewer
                file={fs.selectedFile}
                content={fs.fileContent}
                onSave={fs.saveFile}
                onDirtyChange={setEditorDirty}
              />
            </div>
          ) : fs.loading ? (
            <div className="empty-state">
              <div className="spinner" />
            </div>
          ) : (
            <>
              {fs.viewMode === 'list' && (
                <ListView
                  entries={fs.currentEntries}
                  selectedPaths={fs.selectedPaths}
                  onSelect={handleSelectEntry}
                  onDoubleClick={handleDoubleClick}
                  onContextMenu={handleContextMenu}
                  onMarqueeSelect={handleMarqueeSelect}
                />
              )}
              {fs.viewMode === 'grid' && (
                <GridView
                  entries={fs.currentEntries}
                  selectedPaths={fs.selectedPaths}
                  onSelect={handleSelectEntry}
                  onDoubleClick={handleDoubleClick}
                  onContextMenu={handleContextMenu}
                  onMarqueeSelect={handleMarqueeSelect}
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

          {/* Drag-over overlay */}
          {isDragOver && (
            <div className="drop-overlay">
              <div className="drop-overlay-content">
                <div className="drop-overlay-icon">+</div>
                <div className="drop-overlay-text">Drop files to upload</div>
                <div className="drop-overlay-hint">Text files only, max 1 MB each</div>
              </div>
            </div>
          )}

          {/* Upload progress */}
          {uploadProgress && (
            <div className="upload-progress">
              <div className="upload-progress-bar">
                <div
                  className="upload-progress-fill"
                  style={{ width: `${(uploadProgress.completed / uploadProgress.total) * 100}%` }}
                />
              </div>
              <div className="upload-progress-text">
                Uploading {uploadProgress.current} ({uploadProgress.completed}/{uploadProgress.total})
              </div>
            </div>
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
        multiple
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

      {/* Database Switcher */}
      {showDbSwitcher && (
        <DatabaseSwitcher
          client={client}
          currentDatabaseId={databaseId}
          onSwitch={(db) => {
            setShowDbSwitcher(false);
            onConnectDatabase(db);
          }}
          onClose={() => setShowDbSwitcher(false)}
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
