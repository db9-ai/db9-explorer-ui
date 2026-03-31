import { useState, useCallback, useRef } from 'react';
import type { Db9Client, FileInfo } from '../lib/db9-client';

export type ViewMode = 'list' | 'grid' | 'column';

export interface TreeNode {
  info: FileInfo;
  children: TreeNode[] | null; // null = not loaded
  expanded: boolean;
  loading: boolean;
}

export interface ColumnEntry {
  path: string;
  entries: FileInfo[];
}

export interface SelectModifiers {
  metaKey?: boolean;   // Cmd on Mac
  shiftKey?: boolean;
}

export function useFileSystem(client: Db9Client | null, databaseId: string) {
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [currentPath, setCurrentPath] = useState('/');
  const [currentEntries, setCurrentEntries] = useState<FileInfo[]>([]);
  const [selectedFile, setSelectedFile] = useState<FileInfo | null>(null);
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [columns, setColumns] = useState<ColumnEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const entriesCacheRef = useRef<Map<string, FileInfo[]>>(new Map());
  const lastClickedPathRef = useRef<string | null>(null);

  const clearError = useCallback(() => setError(null), []);

  const loadDirectory = useCallback(async (path: string) => {
    if (!client) return [];
    const cached = entriesCacheRef.current.get(path);
    if (cached) return cached;
    const entries = await client.listDir(databaseId, path);
    entriesCacheRef.current.set(path, entries);
    return entries;
  }, [client, databaseId]);

  const navigateTo = useCallback(async (path: string) => {
    if (!client) return;
    setLoading(true);
    setError(null);
    try {
      const entries = await loadDirectory(path);
      setCurrentPath(path);
      setCurrentEntries(entries);
      setSelectedFile(null);
      setSelectedPaths(new Set());
      setFileContent(null);
      lastClickedPathRef.current = null;
      if (viewMode === 'column') {
        setColumns([{ path, entries }]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [client, loadDirectory, viewMode]);

  const refreshCurrent = useCallback(async () => {
    entriesCacheRef.current.delete(currentPath);
    await navigateTo(currentPath);
  }, [currentPath, navigateTo]);

  // Resolve the ordered entries list for the current context (for shift-click range)
  const getOrderedEntries = useCallback((): FileInfo[] => {
    if (viewMode === 'column') {
      // Flatten all column entries
      return columns.flatMap(c => c.entries);
    }
    return currentEntries;
  }, [viewMode, columns, currentEntries]);

  const selectEntry = useCallback(async (entry: FileInfo, modifiers?: SelectModifiers) => {
    if (!client) return;

    const { metaKey = false, shiftKey = false } = modifiers || {};

    // --- Compute new selectedPaths ---
    if (shiftKey && lastClickedPathRef.current) {
      // Shift+Click: range select from last clicked to current
      const ordered = getOrderedEntries();
      const lastIdx = ordered.findIndex(e => e.path === lastClickedPathRef.current);
      const curIdx = ordered.findIndex(e => e.path === entry.path);
      if (lastIdx >= 0 && curIdx >= 0) {
        const start = Math.min(lastIdx, curIdx);
        const end = Math.max(lastIdx, curIdx);
        const rangePaths = ordered.slice(start, end + 1).map(e => e.path);
        if (metaKey) {
          // Shift+Cmd: add range to existing selection
          setSelectedPaths(prev => {
            const next = new Set(prev);
            rangePaths.forEach(p => next.add(p));
            return next;
          });
        } else {
          // Shift only: replace selection with range
          setSelectedPaths(new Set(rangePaths));
        }
      }
      // Don't update lastClickedPathRef on shift-click (Finder behavior)
    } else if (metaKey) {
      // Cmd+Click: toggle individual item
      setSelectedPaths(prev => {
        const next = new Set(prev);
        if (next.has(entry.path)) {
          next.delete(entry.path);
        } else {
          next.add(entry.path);
        }
        return next;
      });
      lastClickedPathRef.current = entry.path;
    } else {
      // Plain click: select only this item
      setSelectedPaths(new Set([entry.path]));
      lastClickedPathRef.current = entry.path;
    }

    // --- Set selectedFile (last-clicked item for content preview) ---
    setSelectedFile(entry);

    // --- Column view: expand directory on click ---
    if (entry.type === 'dir') {
      const dirPath = entry.path.endsWith('/') ? entry.path : entry.path + '/';
      if (viewMode === 'column') {
        try {
          const entries = await loadDirectory(dirPath);
          setColumns(prev => {
            const idx = prev.findIndex(c =>
              c.entries.some(e => e.path === entry.path)
            );
            const next = idx >= 0 ? prev.slice(0, idx + 1) : [...prev];
            next.push({ path: dirPath, entries });
            return next;
          });
        } catch (err) {
          setError(err instanceof Error ? err.message : String(err));
        }
      }
      setFileContent(null);
    } else {
      // File: load content only if this is the sole selection
      setFileContent(null);
      setError(null);
      // We check the resulting selection size after state updates
      // For simplicity, load content for the clicked file regardless;
      // the UI can decide whether to show the viewer based on selection count
      try {
        const content = await client.readFile(databaseId, entry.path);
        setFileContent(content);
      } catch (err) {
        setFileContent(null);
        setError(err instanceof Error ? err.message : String(err));
      }
    }
  }, [client, databaseId, viewMode, loadDirectory, getOrderedEntries, columns, currentEntries]);

  const expandTreeNode = useCallback(async (path: string) => {
    if (!client) return;
    const dirPath = path.endsWith('/') ? path : path + '/';
    try {
      const entries = await loadDirectory(dirPath);
      setTree(prev => updateTreeExpand(prev, path, entries));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [client, loadDirectory]);

  const collapseTreeNode = useCallback((path: string) => {
    setTree(prev => updateTreeCollapse(prev, path));
  }, []);

  const initRoot = useCallback(async () => {
    if (!client) return;
    setLoading(true);
    setError(null);
    entriesCacheRef.current.clear();
    try {
      const entries = await client.listDir(databaseId, '/');
      setCurrentPath('/');
      setCurrentEntries(entries);
      setSelectedPaths(new Set());
      setColumns([{ path: '/', entries }]);
      setTree(entries.map(e => ({
        info: e,
        children: null,
        expanded: false,
        loading: false,
      })));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [client, databaseId]);

  const saveFile = useCallback(async (path: string, content: string) => {
    if (!client) return;
    await client.writeFile(databaseId, path, content);
    setFileContent(content);
    entriesCacheRef.current.delete(currentPath);
  }, [client, databaseId, currentPath]);

  const createFile = useCallback(async (path: string, content = '') => {
    if (!client) return;
    await client.writeFile(databaseId, path, content);
    entriesCacheRef.current.delete(currentPath);
    await refreshCurrent();
  }, [client, databaseId, currentPath, refreshCurrent]);

  const createDir = useCallback(async (path: string) => {
    if (!client) return;
    await client.mkdir(databaseId, path);
    entriesCacheRef.current.delete(currentPath);
    await refreshCurrent();
  }, [client, databaseId, currentPath, refreshCurrent]);

  const deleteEntry = useCallback(async (path: string, isDir: boolean) => {
    if (!client) return;
    await client.remove(databaseId, path, isDir);
    entriesCacheRef.current.clear();
    setSelectedPaths(prev => {
      const next = new Set(prev);
      next.delete(path);
      return next;
    });
    if (selectedFile?.path === path) {
      setSelectedFile(null);
      setFileContent(null);
    }
    await refreshCurrent();
  }, [client, databaseId, selectedFile, refreshCurrent]);

  const deleteSelected = useCallback(async () => {
    if (!client || selectedPaths.size === 0) return;
    const entries = currentEntries.filter(e => selectedPaths.has(e.path));
    for (const entry of entries) {
      await client.remove(databaseId, entry.path, entry.type === 'dir');
    }
    entriesCacheRef.current.clear();
    setSelectedFile(null);
    setSelectedPaths(new Set());
    setFileContent(null);
    await refreshCurrent();
  }, [client, databaseId, selectedPaths, currentEntries, refreshCurrent]);

  const clearSelection = useCallback(() => {
    setSelectedFile(null);
    setSelectedPaths(new Set());
    setFileContent(null);
    lastClickedPathRef.current = null;
  }, []);

  return {
    tree, currentPath, currentEntries, selectedFile, selectedPaths, fileContent,
    viewMode, setViewMode, columns, loading, error, clearError,
    navigateTo, selectEntry, expandTreeNode, collapseTreeNode,
    initRoot, saveFile, createFile, createDir, deleteEntry, deleteSelected,
    clearSelection, refreshCurrent,
  };
}

function updateTreeExpand(nodes: TreeNode[], targetPath: string, children: FileInfo[]): TreeNode[] {
  return nodes.map(node => {
    if (node.info.path === targetPath) {
      return {
        ...node,
        expanded: true,
        loading: false,
        children: children.map(c => ({
          info: c,
          children: null,
          expanded: false,
          loading: false,
        })),
      };
    }
    if (node.children) {
      return { ...node, children: updateTreeExpand(node.children, targetPath, children) };
    }
    return node;
  });
}

function updateTreeCollapse(nodes: TreeNode[], targetPath: string): TreeNode[] {
  return nodes.map(node => {
    if (node.info.path === targetPath) {
      return { ...node, expanded: false };
    }
    if (node.children) {
      return { ...node, children: updateTreeCollapse(node.children, targetPath) };
    }
    return node;
  });
}
