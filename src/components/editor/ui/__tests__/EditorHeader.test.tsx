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

  it('renders increased New and Load buttons between logo and undo/redo', () => {
    const html = renderToString(<EditorHeader {...defaultProps} />);

    // Renders "New" and "Load" prominent action buttons with text labels and icons
    expect(html).toContain('New');
    expect(html).toContain('Load');
    expect(html).toContain('title="New Canvas / New Room"');
    expect(html).toContain('title="Load Saved Room, Import and Export"');
    expect(html).toContain('aria-label="Load Saved Room, Import and Export"');

    // Includes FilePlus and FolderOpen icons
    expect(html).toContain('lucide-file-plus');
    expect(html).toContain('lucide-folder-open');
  });

  it('renders division and Invite button on the right', () => {
    const html = renderToString(<EditorHeader {...defaultProps} />);

    // Renders division and Invite button with UserPlus icon
    expect(html).toContain('Invite');
    expect(html).toContain('lucide-user-plus');
    expect(html).toContain('bg-gradient-to-b from-transparent via-[#2c3344] to-transparent');
  });

  it('renders connected peer badges next to Invite button when peers are present', () => {
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
