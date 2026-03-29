import { useState, useEffect, useRef } from 'react';
import type { FileInfo } from '../lib/db9-client';
import { basename, formatSize, formatDate, isTextFile } from '../lib/utils';

interface Props {
  file: FileInfo;
  content: string | null;
  onSave: (path: string, content: string) => Promise<void>;
}

export function FileViewer({ file, content, onSave }: Props) {
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [saving, setSaving] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setEditing(false);
    setEditContent(content || '');
  }, [file.path, content]);

  const handleEdit = () => {
    setEditContent(content || '');
    setEditing(true);
    setTimeout(() => textareaRef.current?.focus(), 0);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(file.path, editContent);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setEditing(false);
    setEditContent(content || '');
  };

  const name = basename(file.path);
  const canEdit = isTextFile(name);
  const lines = content?.split('\n') || [];

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
                <button className="btn-sm btn-secondary" onClick={handleCancel}>Cancel</button>
                <button className="btn-sm btn-primary" onClick={handleSave} disabled={saving}>
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </>
            ) : (
              canEdit && content !== null && (
                <button className="btn-sm btn-secondary" onClick={handleEdit}>Edit</button>
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
        ) : editing ? (
          <textarea
            ref={textareaRef}
            className="file-editor"
            value={editContent}
            onChange={e => setEditContent(e.target.value)}
            spellCheck={false}
          />
        ) : !canEdit ? (
          <div className="empty-state">
            <div className="empty-state-icon">📦</div>
            <div className="empty-state-text">Binary file — {formatSize(file.size)}</div>
          </div>
        ) : (
          <div className="file-content">
            {lines.map((line, i) => (
              <div className="file-line" key={i}>
                <span className="file-line-no">{i + 1}</span>
                <span className="file-line-text">{line}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
