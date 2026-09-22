import React from 'react';

export interface EditorCanvasProps {
  containerRef: React.RefObject<HTMLDivElement | null>;
  baseCanvasRef: React.RefObject<HTMLCanvasElement | null>;
  overlayCanvasRef: React.RefObject<HTMLCanvasElement | null>;
  activeBgColor: string;
  onMouseDown: (e: React.MouseEvent<HTMLDivElement>) => void;
  onMouseMove: (e: React.MouseEvent<HTMLDivElement>) => void;
  onMouseUp: (e: React.MouseEvent<HTMLDivElement>) => void;
  onMouseLeave: () => void;
  onWheel: (e: React.WheelEvent<HTMLDivElement>) => void;
}

export const EditorCanvas: React.FC<EditorCanvasProps> = ({
  containerRef,
  baseCanvasRef,
  overlayCanvasRef,
  activeBgColor,
  onMouseDown,
  onMouseMove,
  onMouseUp,
  onMouseLeave,
  onWheel,
}) => {
  return (
    <main
      ref={containerRef}
      className="flex-1 h-full relative cursor-crosshair overflow-hidden"
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseLeave}
      onWheel={onWheel}
      onContextMenu={(e) => e.preventDefault()}
      style={{ backgroundColor: activeBgColor }}
    >
      {/* Base Canvas (Persistent Pixels) */}
      <canvas
        ref={baseCanvasRef}
        className="absolute inset-0 w-full h-full block pointer-events-none"
      />

      {/* Overlay Canvas (Ephemeral Hover, Brush, Marquee, Ghost) */}
      <canvas
        ref={overlayCanvasRef}
        className="absolute inset-0 w-full h-full block pointer-events-none"
      />
    </main>
  );
};

