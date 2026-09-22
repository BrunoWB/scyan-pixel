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
  };

  it('renders HeroUI NumberField component with current brush size', () => {
    const html = renderToString(<EditorHeader {...defaultProps} brushSize={3} />);

    // Renders "Brush" label and "px" unit
    expect(html).toContain('Brush');
    expect(html).toContain('px');

    // Contains HeroUI NumberField data-slot attributes and visible Minus/Plus icons
    expect(html).toContain('data-slot="number-field"');
    expect(html).toContain('data-slot="number-field-group"');
    expect(html).toContain('data-slot="number-field-decrement-button"');
    expect(html).toContain('data-slot="number-field-input"');
    expect(html).toContain('data-slot="number-field-increment-button"');
    expect(html).toContain('lucide-minus');
    expect(html).toContain('lucide-plus');

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

  it('renders modern unified Export button and removes fragmented export buttons', () => {
    const html = renderToString(<EditorHeader {...defaultProps} />);

    expect(html).toContain('Export');
    expect(html).not.toContain('<span>PNG</span>');
  });

  it('renders division and Share button next to Export', () => {
    const html = renderToString(<EditorHeader {...defaultProps} />);

    // Renders division and Share button
    expect(html).toContain('Share');
    expect(html).toContain('bg-gradient-to-b from-transparent via-[#2c3344] to-transparent');
  });

  it('renders connected peer badges next to Share button when peers are present', () => {
    const peers = [
      { id: '1', name: 'montreal-wolf', color: '#06b6d4' },
      { id: '2', name: 'tokyo-kitsune', color: '#f43f5e' },
    ];
    const html = renderToString(<EditorHeader {...defaultProps} connectedPeers={peers} />);

    expect(html).toContain('2 connected peer(s)');
    expect(html).toContain('MW');
    expect(html).toContain('TK');
    expect(html).toContain('background-color:#06b6d4');
    expect(html).toContain('background-color:#f43f5e');
  });

  it('does not render peer badges when connectedPeers is empty', () => {
    const html = renderToString(<EditorHeader {...defaultProps} connectedPeers={[]} />);

    expect(html).not.toContain('connected peer(s)');
  });
});
