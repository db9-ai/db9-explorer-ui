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

export function useFileSystem(client: Db9Client | null, databaseId: string) {
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [currentPath, setCurrentPath] = useState('/');
  const [currentEntries, setCurrentEntries] = useState<FileInfo[]>([]);
  const [selectedFile, setSelectedFile] = useState<FileInfo | null>(null);
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [columns, setColumns] = useState<ColumnEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const entriesCacheRef = useRef<Map<string, FileInfo[]>>(new Map());

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
      setFileContent(null);
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

  const selectEntry = useCallback(async (entry: FileInfo) => {
    if (!client) return;
    if (entry.type === 'dir') {
      const dirPath = entry.path.endsWith('/') ? entry.path : entry.path + '/';
      if (viewMode === 'column') {
        // Column view: single-click expands the next column
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
      // All modes: just select (highlight), don't navigate
      setSelectedFile(entry);
      setFileContent(null);
    } else {
      setSelectedFile(entry);
      setFileContent(null);
      setError(null);
      try {
        const content = await client.readFile(databaseId, entry.path);
        setFileContent(content);
      } catch (err) {
        setFileContent(null);
        setError(err instanceof Error ? err.message : String(err));
      }
    }
  }, [client, databaseId, viewMode, loadDirectory]);

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
    if (selectedFile?.path === path) {
      setSelectedFile(null);
      setFileContent(null);
    }
    await refreshCurrent();
  }, [client, databaseId, selectedFile, refreshCurrent]);

  return {
    tree, currentPath, currentEntries, selectedFile, fileContent,
    viewMode, setViewMode, columns, loading, error, clearError,
    navigateTo, selectEntry, expandTreeNode, collapseTreeNode,
    initRoot, saveFile, createFile, createDir, deleteEntry, refreshCurrent,
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
