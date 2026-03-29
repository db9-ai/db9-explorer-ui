import { useState } from 'react';

interface CreateDialogProps {
  type: 'file' | 'folder';
  currentPath: string;
  onConfirm: (name: string) => void;
  onCancel: () => void;
}

export function CreateDialog({ type, currentPath, onConfirm, onCancel }: CreateDialogProps) {
  const [name, setName] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) onConfirm(name.trim());
  };

  return (
    <div className="dialog-overlay" onClick={onCancel}>
      <div className="dialog" onClick={e => e.stopPropagation()}>
        <div className="dialog-title">New {type === 'file' ? 'File' : 'Folder'}</div>
        <form onSubmit={handleSubmit}>
          <div className="dialog-body">
            <div className="dialog-text">
              Create in <code style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{currentPath}</code>
            </div>
            <input
              className="form-input"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder={type === 'file' ? 'filename.txt' : 'folder-name'}
              autoFocus
            />
          </div>
          <div className="dialog-actions">
            <button type="button" className="btn-sm btn-secondary" onClick={onCancel}>Cancel</button>
            <button type="submit" className="btn-sm btn-primary" disabled={!name.trim()}>Create</button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface DeleteDialogProps {
  path: string;
  isDir: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function DeleteDialog({ path, isDir, onConfirm, onCancel }: DeleteDialogProps) {
  return (
    <div className="dialog-overlay" onClick={onCancel}>
      <div className="dialog" onClick={e => e.stopPropagation()}>
        <div className="dialog-title">Delete {isDir ? 'Folder' : 'File'}</div>
        <div className="dialog-body">
          <div className="dialog-text">
            Are you sure you want to delete this {isDir ? 'folder and all its contents' : 'file'}?
          </div>
          <div className="dialog-path">{path}</div>
        </div>
        <div className="dialog-actions">
          <button className="btn-sm btn-secondary" onClick={onCancel}>Cancel</button>
          <button className="btn-sm btn-danger" onClick={onConfirm}>Delete</button>
        </div>
      </div>
    </div>
  );
}

interface RenameDialogProps {
  currentName: string;
  onConfirm: (newName: string) => void;
  onCancel: () => void;
}

export function RenameDialog({ currentName, onConfirm, onCancel }: RenameDialogProps) {
  const [name, setName] = useState(currentName);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim() && name.trim() !== currentName) onConfirm(name.trim());
  };

  return (
    <div className="dialog-overlay" onClick={onCancel}>
      <div className="dialog" onClick={e => e.stopPropagation()}>
        <div className="dialog-title">Rename</div>
        <form onSubmit={handleSubmit}>
          <div className="dialog-body">
            <input
              className="form-input"
              value={name}
              onChange={e => setName(e.target.value)}
              autoFocus
              onFocus={e => {
                const dotIdx = name.lastIndexOf('.');
                if (dotIdx > 0) e.target.setSelectionRange(0, dotIdx);
              }}
            />
          </div>
          <div className="dialog-actions">
            <button type="button" className="btn-sm btn-secondary" onClick={onCancel}>Cancel</button>
            <button type="submit" className="btn-sm btn-primary" disabled={!name.trim() || name.trim() === currentName}>
              Rename
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
