import { describe, it, expect, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import { EditorHeader } from '../EditorHeader';

describe('EditorHeader Brush Size Numerical Picker', () => {
  const defaultProps = {
    title: 'SCYAN PIXEL EDITOR',
    badgeText: 'ZMK 1BPP',
    isHeaderHovered: false,
    setIsHeaderHovered: vi.fn(),
    canUndo: true,
    canRedo: false,
    historyIndex: 2,
    historyLength: 3,
    onUndo: vi.fn(),
    onRedo: vi.fn(),
    brushSize: 3,
    setBrushSize: vi.fn(),
    onRotate90: vi.fn(),
    onFlipH: vi.fn(),
    onFlipV: vi.fn(),
    isStrictMonochrome: false,
    allowColorThemes: true,
    activePixelColor: '#00e5a3',
    activeDrawColor: '#00e5a3',
    setActiveDrawColor: vi.fn(),
    recentPaletteRef: { current: null },
    activeBgColor: '#000000',
    onBgColorChange: vi.fn(),
    onOpenCanvasEyedropper: vi.fn(),
    onOpenImportModal: vi.fn(),
    onExportPNG: vi.fn(),
    onExportCArray: vi.fn(),
    onExportJSON: vi.fn(),
    onFitToView: vi.fn(),
  };

  it('renders HeroUI NumberField component with current brush size', () => {
    const html = renderToString(<EditorHeader {...defaultProps} brushSize={3} />);

    // Renders "Brush" label and "px" unit
    expect(html).toContain('Brush');
    expect(html).toContain('px');

    // Contains HeroUI NumberField data-slot attributes
    expect(html).toContain('data-slot="number-field"');
    expect(html).toContain('data-slot="number-field-group"');
    expect(html).toContain('data-slot="number-field-decrement-button"');
    expect(html).toContain('data-slot="number-field-input"');
    expect(html).toContain('data-slot="number-field-increment-button"');

    // Value matches current brush size
    expect(html).toContain('value="3"');
  });

  it('renders brush size live preview dot with active pixel color', () => {
    const html = renderToString(
      <EditorHeader {...defaultProps} brushSize={4} activePixelColor="#00f0ff" />
    );

    // Live preview dot contains activePixelColor styling
    expect(html).toContain('background-color:#00f0ff');
    expect(html).toContain('title="Brush size preview (4px)"');
  });

  it('does not render old predefined 1-4 size buttons', () => {
    const html = renderToString(<EditorHeader {...defaultProps} brushSize={1} />);

    // Old predefined buttons rendered each as a standalone button with text 1, 2, 3, 4
    expect(html).not.toContain('<button>1</button>');
    expect(html).not.toContain('<button>2</button>');
    expect(html).not.toContain('<button>3</button>');
    expect(html).not.toContain('<button>4</button>');
  });
});
