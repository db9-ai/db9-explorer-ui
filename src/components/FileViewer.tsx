import { useState, useEffect, useCallback } from 'react';
import type { FileInfo } from '../lib/db9-client';
import { basename, formatSize, formatDate, isTextFile } from '../lib/utils';
import { CodeMirrorEditor } from './CodeMirrorEditor';

const VIM_PREF_KEY = 'db9-vim-mode';

interface Props {
  file: FileInfo;
  content: string | null;
  onSave: (path: string, content: string) => Promise<void>;
  onDirtyChange?: (dirty: boolean) => void;
}

export function FileViewer({ file, content, onSave, onDirtyChange }: Props) {
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [vimMode, setVimMode] = useState(() => {
    try { return localStorage.getItem(VIM_PREF_KEY) === 'true'; } catch { return false; }
  });

  const name = basename(file.path);
  const canEdit = isTextFile(name);
  const isDirty = editing && editContent !== (content || '');

  // Report dirty state to parent
  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  // Browser beforeunload guard
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  useEffect(() => {
    setEditing(false);
    setEditContent(content || '');
  }, [file.path, content]);

  // Persist vim preference
  useEffect(() => {
    try { localStorage.setItem(VIM_PREF_KEY, String(vimMode)); } catch { /* ignore */ }
  }, [vimMode]);

  const handleEdit = () => {
    setEditContent(content || '');
    setEditing(true);
  };

  // Save only (Cmd+S / :w) — stay in edit mode
  const handleQuickSave = useCallback(async () => {
    setSaving(true);
    try {
      await onSave(file.path, editContent);
    } finally {
      setSaving(false);
    }
  }, [file.path, editContent, onSave]);

  // Save & exit (Save button) — return to read-only
  const handleSaveAndExit = useCallback(async () => {
    setSaving(true);
    try {
      await onSave(file.path, editContent);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }, [file.path, editContent, onSave]);

  const handleCancel = () => {
    setEditing(false);
    setEditContent(content || '');
  };

  return (
    <div className="file-viewer">
      <div className="file-viewer-header">
        <span className="file-viewer-title">{name}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div className="file-viewer-meta">
            <span>{formatSize(file.size)}</span>
            <span>{formatDate(file.mtime)}</span>
          </div>
          <div className="file-viewer-actions">
            {editing ? (
              <>
                <button
                  className={`btn-sm btn-secondary vim-toggle ${vimMode ? 'vim-active' : ''}`}
                  onClick={() => setVimMode(v => !v)}
                  title={vimMode ? 'Disable Vim mode' : 'Enable Vim mode'}
                >
                  VIM
                </button>
                <button className="btn-sm btn-secondary" onClick={handleCancel}>Cancel</button>
                <button className="btn-sm btn-primary" onClick={handleSaveAndExit} disabled={saving}>
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </>
            ) : (
              canEdit && (
                <button
                  className="btn-sm btn-secondary"
                  onClick={handleEdit}
                  style={content === null ? { visibility: 'hidden' } : undefined}
                >
                  Edit
                </button>
              )
            )}
          </div>
        </div>
      </div>
      <div className="file-viewer-body">
        {content === null ? (
          <div className="empty-state">
            <div className="spinner" />
          </div>
        ) : !canEdit ? (
          <div className="empty-state">
            <div className="empty-state-icon">📦</div>
            <div className="empty-state-text">Binary file — {formatSize(file.size)}</div>
          </div>
        ) : (
          <CodeMirrorEditor
            content={editing ? editContent : content}
            filename={name}
            readOnly={!editing}
            vimMode={editing && vimMode}
            onChange={editing ? setEditContent : undefined}
            onSave={editing ? handleQuickSave : undefined}
          />
        )}
      </div>
    </div>
  );
}
