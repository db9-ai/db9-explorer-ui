import type { ViewMode } from '../hooks/useFileSystem';
import type { FileInfo } from '../lib/db9-client';
import {
  RefreshIcon, PlusIcon, FolderPlusIcon, UploadIcon, DownloadIcon, TrashIcon,
  ListIcon, GridIcon, ColumnsIcon,
} from './Icons';

interface Props {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  selectedFile: FileInfo | null;
  selectedCount: number;
  onNewFile: () => void;
  onNewFolder: () => void;
  onUpload: () => void;
  onDownload: () => void;
  onDelete: () => void;
  onRefresh: () => void;
}

export function Toolbar({
  viewMode, onViewModeChange, selectedFile, selectedCount,
  onNewFile, onNewFolder, onUpload, onDownload, onDelete, onRefresh,
}: Props) {
  const hasSelection = selectedCount > 0;
  const singleFileSelected = selectedCount === 1 && selectedFile?.type === 'file';

  return (
    <div className="toolbar">
      <div className="toolbar-group">
        <button className="toolbar-btn" onClick={onNewFile} title="New File">
          <PlusIcon /> File
        </button>
        <button className="toolbar-btn" onClick={onNewFolder} title="New Folder">
          <FolderPlusIcon /> Folder
        </button>
      </div>
      <div className="toolbar-sep" />
      <div className="toolbar-group">
        <button className="toolbar-btn" onClick={onUpload} title="Upload">
          <UploadIcon /> Upload
        </button>
        {singleFileSelected && (
          <button className="toolbar-btn" onClick={onDownload} title="Download">
            <DownloadIcon />
          </button>
        )}
      </div>
      {hasSelection && (
        <>
          <div className="toolbar-sep" />
          <button
            className="toolbar-btn danger"
            onClick={onDelete}
            title={selectedCount > 1 ? `Delete ${selectedCount} items` : 'Delete'}
          >
            <TrashIcon />
            {selectedCount > 1 && <span style={{ marginLeft: 2 }}>{selectedCount}</span>}
          </button>
        </>
      )}
      <div className="toolbar-spacer" />
      {selectedCount > 1 && (
        <span style={{ fontSize: 11, color: 'var(--text-muted)', marginRight: 8 }}>
          {selectedCount} selected
        </span>
      )}
      <button className="toolbar-btn" onClick={onRefresh} title="Refresh">
        <RefreshIcon />
      </button>
      <div className="toolbar-sep" />
      <div className="view-toggle">
        <button
          className={`view-toggle-btn ${viewMode === 'list' ? 'active' : ''}`}
          onClick={() => onViewModeChange('list')}
          title="List view"
        >
          <ListIcon />
        </button>
        <button
          className={`view-toggle-btn ${viewMode === 'grid' ? 'active' : ''}`}
          onClick={() => onViewModeChange('grid')}
          title="Grid view"
        >
          <GridIcon />
        </button>
        <button
          className={`view-toggle-btn ${viewMode === 'column' ? 'active' : ''}`}
          onClick={() => onViewModeChange('column')}
          title="Column view"
        >
          <ColumnsIcon />
        </button>
      </div>
    </div>
  );
}
