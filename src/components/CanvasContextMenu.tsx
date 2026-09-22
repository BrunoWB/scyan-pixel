import React, { useEffect, useRef, useMemo } from 'react';
import {
  ClipboardPaste,
  Upload,
  RefreshCw,
  FlipHorizontal,
  FlipVertical,
  RotateCw,
  X,
  Copy,
  Scissors,
  Trash2,
} from 'lucide-react';
import './CanvasContextMenu.css';

export interface CanvasContextMenuProps {
  x: number;
  y: number;
  onClose: () => void;
  onCut?: () => void;
  onCopy?: () => void;
  onPaste: () => void;
  onDelete?: () => void;
  onImportFile: () => void;
  onInvert: () => void;
  onFlipH: () => void;
  onFlipV: () => void;
  onRotate90: () => void;
  onDeselect?: () => void;
  hasSelection: boolean;
}

export const CanvasContextMenu: React.FC<CanvasContextMenuProps> = ({
  x,
  y,
  onClose,
  onCut,
  onCopy,
  onPaste,
  onDelete,
  onImportFile,
  onInvert,
  onFlipH,
  onFlipV,
  onRotate90,
  onDeselect,
  hasSelection,
}) => {
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  const adjustedStyle = useMemo(() => {
    const menuWidth = 210;
    const menuHeight = 260;
    const padding = 10;

    let posX = x;
    let posY = y;

    if (x + menuWidth > window.innerWidth - padding) {
      posX = Math.max(padding, window.innerWidth - menuWidth - padding);
    }
    if (y + menuHeight > window.innerHeight - padding) {
      posY = Math.max(padding, window.innerHeight - menuHeight - padding);
    }

    return {
      left: `${posX}px`,
      top: `${posY}px`,
    };
  }, [x, y]);

  return (
    <div
      ref={menuRef}
      className="canvas-context-menu"
      style={adjustedStyle}
      onClick={(e) => e.stopPropagation()}
    >
      {hasSelection && onCut && (
        <button
          className="context-menu-item"
          onClick={() => {
            onCut();
            onClose();
          }}
        >
          <Scissors size={14} />
          <span>Cut</span>
          <span className="context-menu-shortcut">Ctrl+X</span>
        </button>
      )}

      {hasSelection && onCopy && (
        <button
          className="context-menu-item"
          onClick={() => {
            onCopy();
            onClose();
          }}
        >
          <Copy size={14} />
          <span>Copy</span>
          <span className="context-menu-shortcut">Ctrl+C</span>
        </button>
      )}

      <button
        className="context-menu-item highlight"
        onClick={() => {
          onPaste();
          onClose();
        }}
      >
        <ClipboardPaste size={14} />
        <span>Paste</span>
        <span className="context-menu-shortcut">Ctrl+V</span>
      </button>

      {hasSelection && onDelete && (
        <button
          className="context-menu-item"
          onClick={() => {
            onDelete();
            onClose();
          }}
        >
          <Trash2 size={13} />
          <span>Clear Selection</span>
          <span className="context-menu-shortcut">Del</span>
        </button>
      )}

      <button
        className="context-menu-item"
        onClick={() => {
          onImportFile();
          onClose();
        }}
      >
        <Upload size={14} />
        <span>Import Image...</span>
      </button>

      <div className="context-menu-divider" />

      {hasSelection && onDeselect && (
        <button
          className="context-menu-item"
          onClick={() => {
            onDeselect();
            onClose();
          }}
        >
          <X size={13} />
          <span>Deselect</span>
          <span className="context-menu-shortcut">Esc</span>
        </button>
      )}

      <button
        className="context-menu-item"
        onClick={() => {
          onInvert();
          onClose();
        }}
      >
        <RefreshCw size={13} />
        <span>{hasSelection ? 'Invert Selection' : 'Invert Canvas'}</span>
      </button>

      <button
        className="context-menu-item"
        onClick={() => {
          onFlipH();
          onClose();
        }}
      >
        <FlipHorizontal size={13} />
        <span>Flip Horizontal</span>
      </button>

      <button
        className="context-menu-item"
        onClick={() => {
          onFlipV();
          onClose();
        }}
      >
        <FlipVertical size={13} />
        <span>Flip Vertical</span>
      </button>

      <button
        className="context-menu-item"
        onClick={() => {
          onRotate90();
          onClose();
        }}
      >
        <RotateCw size={13} />
        <span>Rotate 90°</span>
      </button>
    </div>
  );
};
