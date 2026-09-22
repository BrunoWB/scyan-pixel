# Antigravity Operating Guide: Scyan ZMK Ecosystem

Persistent architectural reference for Antigravity pair programming in `scyan-pixel` (repo folder `scyan-pixel`).

---

## 1. Ecosystem Directory & Role Map

| Repository | Local Path (Host: `/var/home/Scyan/` == `/home/Scyan/`) | Stack | Role |
| :--- | :--- | :--- | :--- |
| **`scyan-pixel`** *(Here)* | `Projects/Web/scyan-pixel/` | React 19 / Vite | Upstream pixel editor & raster algorithm core (`BwpxGrid`, `ScyanPixelEditor`). |
| **`scyan-zmk-studio`** | `Projects/Web/scyan-zmk-studio/` | React 19 / TS 6 / Vite | Visual 2-Atlas IDE & layout compiler to C header. |
| **`scyan-zmk-module`** | `Projects/Firmware/scyan-zmk-module/` | Embedded C / Zephyr | Runtime 1bpp blitter, transform (90° rot), and widget engine. |
| **`zmk-config`** | `Projects/Firmware/zmk-config/` | West / Kconfig / CI | Corne split keyboard config; CI builds `.uf2` on asset push. |
| **`hello-web`** | `Projects/Web/hello-web/` | HTML/CSS | Public developer landing page & project portal. |

---

## 2. Upstream Role & Synergy

```
[scyan-pixel] (Here)
      │ Core algorithms & pixel editor component
      ▼
[scyan-zmk-studio] ──(generates C assets)──> [zmk-config] ──> [scyan-zmk-module]
```

* **Role**: `scyan-pixel` is the foundational pixel-editing component and sandbox.
* **Core Module**: `src/core/BwpxGrid.ts` and `src/core/algorithms.ts` (Bresenham lines, flood fill, marquee selection, rotation, C byte array export).
* **Downstream Integration**: Algorithms and editor components from this repo are adapted inside `scyan-zmk-studio/src/bwpx/`.

---

## 3. Non-Negotiable Invariants for Antigravity

1. **1bpp Monochrome Model**:
   Pixel state is strictly binary (`0` = dark, `1` = light). Stride is `Math.ceil(width / 8)`. Avoid assuming byte-aligned boundaries.
2. **Modular Independence**:
   Keep `BwpxGrid` and raster algorithms clean and decoupled from keyboard/ZMK specifics so they remain portable and reusable.
3. **C Byte Array Export Compatibility**:
   Ensure C byte array export formats remain compatible with standard Zephyr / SSD1306 monochrome bitmap conventions.

---

## 4. Architecture & Anti-Monolith Policy

Detailed architecture reference: [`ARCHITECTURE.md`](./ARCHITECTURE.md).

* **`src/core/`**: Pure TypeScript engine. Zero React dependencies. 32-bit bit-packed coordinates `packCoord(x, y)`.
* **`src/components/editor/hooks/`**: State machines only (`useEditorHistory`, `useViewport`, `useSelectionManager`).
* **`src/components/editor/ui/`**: Presentation subcomponents (`EditorHeader`, `EditorToolbar`, `EditorCanvas`, `EditorStatusBar`, `ExportModal`).
* **`src/components/color-picker/`**: Decomposed HUD (`ColorWheelTriangle`, `ColorInputs`, `ColorPicker`).
* **Avoid Monolith Creep**: Never dump new tool math or state directly into `BwpxEditor.tsx`. Implement pure math in `core/`, state in hooks, and register buttons in `EditorToolbar.tsx`.
* **Zero Linter Warnings**: Maintain 0 warnings in `oxlint` (no ref-during-render, no synchronous `setState` in effects, no fast-refresh violations).

