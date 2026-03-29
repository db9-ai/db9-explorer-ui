import { useEffect, useRef } from 'react';

export interface ContextMenuItem {
  label: string;
  danger?: boolean;
  onClick: () => void;
}

interface Props {
  x: number;
  y: number;
  items: ContextMenuItem[];
  onClose: () => void;
}

export function ContextMenu({ x, y, items, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [onClose]);

  // Keep menu within viewport
  const style: React.CSSProperties = {
    left: Math.min(x, window.innerWidth - 180),
    top: Math.min(y, window.innerHeight - items.length * 34 - 8),
  };

  return (
    <div className="context-menu" ref={ref} style={style}>
      {items.map((item, i) => (
        <div
          key={i}
          className={`context-menu-item ${item.danger ? 'danger' : ''}`}
          onClick={() => { item.onClick(); onClose(); }}
        >
          {item.label}
        </div>
      ))}
    </div>
  );
}
