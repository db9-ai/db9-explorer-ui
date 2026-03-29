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
  onNewFile: () => void;
  onNewFolder: () => void;
  onUpload: () => void;
  onDownload: () => void;
  onDelete: () => void;
  onRefresh: () => void;
}

export function Toolbar({
  viewMode, onViewModeChange, selectedFile,
  onNewFile, onNewFolder, onUpload, onDownload, onDelete, onRefresh,
}: Props) {
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
        {selectedFile && selectedFile.type === 'file' && (
          <button className="toolbar-btn" onClick={onDownload} title="Download">
            <DownloadIcon />
          </button>
        )}
      </div>
      {selectedFile && (
        <>
          <div className="toolbar-sep" />
          <button className="toolbar-btn danger" onClick={onDelete} title="Delete">
            <TrashIcon />
          </button>
        </>
      )}
      <div className="toolbar-spacer" />
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
