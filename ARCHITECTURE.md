# System Architecture & Engineering Reference: scyan-pixel-editor

This document defines the architectural boundaries, coordinate systems, data models, and component responsibilities for `scyan-pixel-editor` (`bwpx-editor`). It serves as a persistent guide for human engineers and AI coding assistants (LLMs) to prevent monolith creep and preserve hardware invariants.

---

## 1. High-Level Layer Separation

```
src/
├── core/                                # [LAYER 1] Pure TypeScript Engine (Zero React dependencies)
│   ├── BwpxGrid.ts                      # Bit-packed coordinate grid, bounding box, blit, transforms
│   ├── algorithms.ts                    # Pure raster math (Bresenham lines, flood fill, parametric shapes)
│   ├── gridRenderer.ts                  # Dual-canvas rendering engine (Base Grid + Ephemeral Overlay)
│   ├── colorUtils.ts                    # HSV/RGB/Hex conversions + barycentric simplex projection math
│   ├── gifDecoder.ts                    # Multi-frame GIF parsing & timeline extraction
│   └── imageConversion.ts               # Thresholding & Floyd-Steinberg / Atkinson dithering
│
├── components/
│   ├── editor/                          # [LAYER 2] Editor Subsystems
│   │   ├── types.ts                     # ToolType, ThemePreset, props & wheel zoom delta calculation
│   │   ├── hooks/                       # Focused State Machines
│   │   │   ├── useEditorHistory.ts      # Undo/redo history stacks & grid branching
│   │   │   ├── useViewport.ts           # Zoom, pan, wheel delta accumulation, fitToView
│   │   │   └── useSelectionManager.ts   # Marquee, floating pixels, clipboard (cut/copy/paste)
│   │   └── ui/                          # Presentation Subcomponents
│   │       ├── EditorHeader.tsx         # Brand mascot, undo/redo, brush size, transforms, export triggers
│   │       ├── EditorToolbar.tsx        # Vertical left tool palette (draw & shapes)
│   │       ├── EditorCanvas.tsx         # Dual-canvas viewport container
│   │       ├── EditorStatusBar.tsx      # Bottom status bar (coordinates, dimensions, zoom, pixels on)
│   │       └── ExportModal.tsx          # Dialog for Zephyr/SSD1306 C arrays, JSON, PNG
│   │
│   ├── color-picker/                    # [LAYER 3] Color HUD Subsystem
│   │   ├── ColorWheelTriangle.tsx       # SVG Hue circular ring + barycentric SV triangle + drag events
│   │   ├── ColorInputs.tsx              # RGB hex input, swatch readout, and HSV numerical steppers
│   │   └── ColorPicker.tsx              # Popover container orchestrator with debounced dismissal
│   │
│   ├── BwpxEditor.tsx                   # Top-level container & facade re-exporting public API
│   ├── ColorPicker.tsx                  # Backwards-compatibility re-export facade
│   ├── BackgroundPicker.tsx             # Background swatch and palette selector
│   ├── CanvasContextMenu.tsx            # Right-click context actions
│   └── ImageImportModal.tsx             # Image & GIF import, cropping, and threshold preview
│
└── index.ts                             # Public package export boundary
```

---

## 2. Coordinate Spaces & Canvas Pipeline

Always respect coordinate space boundaries to prevent cursor misalignment and performance degradation:

| Space | Coordinate Type | Description | Conversion |
| :--- | :--- | :--- | :--- |
| **Screen Space** | `(clientX, clientY)` | Raw browser pointer coordinates. | Measured relative to container via `getBoundingClientRect()`. |
| **Viewport Space** | `(mouseX, mouseY)` | Coordinates relative to canvas container origin `(0, 0)`. | `x = clientX - rect.left`, `y = clientY - rect.top` |
| **Grid Space** | `(gridX, gridY)` | Integer pixel coordinates inside `BwpxGrid`. Can be negative (infinite canvas). | `gridX = Math.floor((mouseX - pan.x) / zoom)`<br>`gridY = Math.floor((mouseY - pan.y) / zoom)` |

### Dual-Canvas Rendering Architecture
Never render dynamic cursor previews or marquee marching ants onto the persistent pixel grid:
1. **`baseCanvas`**: Renders persistent grid pixels and major coordinate axes. Only redraws when the underlying `grid`, `zoom`, `pan`, or background theme changes.
2. **`overlayCanvas`**: Renders ephemeral items (hover brush indicator, drag shape ghost, marquee selection rectangle). Driven by `requestAnimationFrame` (`scheduleOverlayRender`) to guarantee 60fps interaction without dirtying or re-rendering the base canvas.

---

## 3. Spatial Storage & Memory Invariants

### 32-Bit Bit-Packed Coordinates
* `BwpxGrid` stores pixels in a sparse `Set<number>` rather than 2D arrays or string keys (`"x,y"`).
* Coordinates are packed into signed 32-bit integers:
  ```ts
  packCoord(x, y) = (x << 16) | (y & 0xffff)
  unpackCoord(key) = [key >> 16, (key << 16) >> 16]
  ```
* **Invariant**: Never allocate large `w * h` 2D arrays in hot drawing loops. Use sparse bit-packed keys.

### 1bpp Hardware Model & Firmware Alignment
* Monochrome pixel state is binary (`0` = dark/off, `1` = light/on).
* Stride is strictly `Math.ceil(width / 8)`. Avoid assuming byte-aligned canvas boundaries.
* C byte array export formats (`BwpxGrid.toCArray`) must maintain byte alignment compatible with standard SSD1306 and Zephyr display drivers.

---

## 4. Extension Guidelines (How to Add Features without Monolith Creep)

### Adding a New Drawing Tool
1. **Raster Math**: Implement the pure raster algorithm in [`src/core/algorithms.ts`](file:///home/Scyan/Projects/Web/bwpx-editor/src/core/algorithms.ts) operating directly on `BwpxGrid`.
2. **Tool Definition**: Add the tool identifier to `ToolType` in [`src/components/editor/types.ts`](file:///home/Scyan/Projects/Web/bwpx-editor/src/components/editor/types.ts).
3. **Toolbar Button**: Register the tool icon and shortcut tooltip in [`src/components/editor/ui/EditorToolbar.tsx`](file:///home/Scyan/Projects/Web/bwpx-editor/src/components/editor/ui/EditorToolbar.tsx).
4. **Dispatcher**: Add the case in `handleMouseMove` (ghost preview) and `handleMouseUp` (commit) inside [`src/components/BwpxEditor.tsx`](file:///home/Scyan/Projects/Web/bwpx-editor/src/components/BwpxEditor.tsx).

### Adding Viewport or Navigation Controls
* Put viewport math, zoom stepping, or pan logic in [`src/components/editor/hooks/useViewport.ts`](file:///home/Scyan/Projects/Web/bwpx-editor/src/components/editor/hooks/useViewport.ts). Do not add viewport state directly to `BwpxEditor.tsx`.

### Adding Selection or Clipboard Actions
* Put marquee math, floating pixel manipulations, and clipboard transformations in [`src/components/editor/hooks/useSelectionManager.ts`](file:///home/Scyan/Projects/Web/bwpx-editor/src/components/editor/hooks/useSelectionManager.ts).

---

## 5. React & Linter Rules (Enforced by `oxlint`)

1. **No Reading Refs During Render**:
   Do not access `someRef.current` inside JSX or during render calculation. Use state or derive values outside render.
2. **No Synchronous `setState` in `useEffect`**:
   Never use `useEffect` to synchronize props to state when the value can be derived directly during render via `useMemo` or standard prev-prop derivation.
3. **Export Components from TSX**:
   Non-component constants and helper functions must live in `.ts` files (e.g. `editor/types.ts` or `core/colorUtils.ts`) to satisfy Fast Refresh.
