import type { TreeNode } from '../hooks/useFileSystem';
import type { FileInfo } from '../lib/db9-client';
import { basename, getFileIcon } from '../lib/utils';

interface Props {
  nodes: TreeNode[];
  selectedPath: string | null;
  onSelect: (entry: FileInfo) => void;
  onExpand: (path: string) => void;
  onCollapse: (path: string) => void;
  onContextMenu: (e: React.MouseEvent, entry: FileInfo) => void;
  depth?: number;
}

export function FileTree({ nodes, selectedPath, onSelect, onExpand, onCollapse, onContextMenu, depth = 0 }: Props) {
  return (
    <>
      {nodes.map(node => (
        <FileTreeNode
          key={node.info.path}
          node={node}
          selectedPath={selectedPath}
          onSelect={onSelect}
          onExpand={onExpand}
          onCollapse={onCollapse}
          onContextMenu={onContextMenu}
          depth={depth}
        />
      ))}
    </>
  );
}

function FileTreeNode({ node, selectedPath, onSelect, onExpand, onCollapse, onContextMenu, depth }: {
  node: TreeNode;
  selectedPath: string | null;
  onSelect: (entry: FileInfo) => void;
  onExpand: (path: string) => void;
  onCollapse: (path: string) => void;
  onContextMenu: (e: React.MouseEvent, entry: FileInfo) => void;
  depth: number;
}) {
  const isDir = node.info.type === 'dir';
  const isSelected = selectedPath === node.info.path;
  const name = basename(node.info.path);

  const handleClick = () => {
    if (isDir) {
      if (node.expanded) {
        onCollapse(node.info.path);
      } else {
        onExpand(node.info.path);
      }
    }
    onSelect(node.info);
  };

  return (
    <>
      <div
        className={`tree-node ${isDir ? 'dir' : ''} ${isSelected ? 'selected' : ''}`}
        style={{ paddingLeft: 12 + depth * 16 }}
        onClick={handleClick}
        onContextMenu={e => onContextMenu(e, node.info)}
        onDoubleClick={() => isDir && onSelect(node.info)}
      >
        <span className={`tree-chevron ${isDir ? (node.expanded ? 'open' : '') : 'spacer'}`}>
          ▸
        </span>
        <span className="tree-icon">{getFileIcon(name, isDir)}</span>
        <span className="tree-name">{name}</span>
      </div>
      {isDir && node.expanded && node.children && (
        <FileTree
          nodes={node.children}
          selectedPath={selectedPath}
          onSelect={onSelect}
          onExpand={onExpand}
          onCollapse={onCollapse}
          onContextMenu={onContextMenu}
          depth={depth + 1}
        />
      )}
      {isDir && node.expanded && !node.children && (
        <div className="tree-loading" style={{ paddingLeft: 12 + (depth + 1) * 16 }}>
          loading...
        </div>
      )}
    </>
  );
}
