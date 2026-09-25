import { describe, it, expect, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import { ImageImportModal } from '../ImageImportModal';
import { EditorHeader } from '../editor/ui/EditorHeader';
import { RoomStorageModal } from '../editor/ui/RoomStorageModal';
import { PixelEditor as BwpxEditor } from '../PixelEditor';

describe('ImageImportModal', () => {
  it('renders dropzone when open without an image source', () => {
    const html = renderToString(
      <ImageImportModal
        isOpen={true}
        imageSource={null}
        onClose={() => {}}
        onConfirm={() => {}}
      />
    );

    expect(html).toContain('image-import-dropzone');
    expect(html).toContain('Choose Image or GIF');
    expect(html).toContain('or drag &amp; drop here');
    expect(html).toContain('disabled');
  });

  it('renders nothing when closed', () => {
    const html = renderToString(
      <ImageImportModal
        isOpen={false}
        imageSource={null}
        onClose={() => {}}
        onConfirm={() => {}}
      />
    );

    expect(html).toBe('');
  });

  it('renders color mode toggle when allowColor is true and hides threshold slider by default', () => {
    const html = renderToString(
      <ImageImportModal
        isOpen={true}
        imageSource={null}
        allowColor={true}
        onClose={() => {}}
        onConfirm={() => {}}
      />
    );

    expect(html).toContain('image-import-mode-toggle');
    expect(html).toContain('Color');
    expect(html).toContain('1bpp Monochrome');
    // In default Color mode, threshold slider is hidden and Max Colors slider is shown
    expect(html).not.toContain('Threshold');
    expect(html).toContain('Max Colors');
  });

  it('does not render mode toggle when allowColor is false and shows threshold slider', () => {
    const html = renderToString(
      <ImageImportModal
        isOpen={true}
        imageSource={null}
        allowColor={false}
        onClose={() => {}}
        onConfirm={() => {}}
      />
    );

    expect(html).not.toContain('image-import-mode-toggle');
    expect(html).toContain('Threshold');
    expect(html).toContain('image-import-slider');
  });
});

describe('BwpxEditor file input', () => {
  it('renders hidden file input for importing images with valid formats', () => {
    const html = renderToString(<BwpxEditor />);

    expect(html).toContain('type="file"');
    expect(html).toContain('.png,.bmp,.jpg,.jpeg,.webp,.gif');
  });
});

describe('EditorHeader & RoomStorageModal import integration', () => {
  it('renders RoomStorageModal with Import option when import tab is active', () => {
    const onOpenImportModal = vi.fn();
    const html = renderToString(
      <RoomStorageModal
        isOpen={true}
        onClose={() => {}}
        savedRooms={[]}
        currentRoomId="default"
        onLoadRoom={() => {}}
        onCopyToNewSave={() => {}}
        onDeleteRoom={() => {}}
        initialTab="import"
        onOpenImportModal={onOpenImportModal}
      />
    );

    expect(html).toContain('Import Raster Art or Animation');
    expect(html).toContain('Choose Image or GIF...');
  });

  it('renders Load button in EditorHeader that opens room storage modal', () => {
    const onOpenLoadModal = vi.fn();
    const html = renderToString(
      <EditorHeader
        isHeaderHovered={false}
        setIsHeaderHovered={() => {}}
        canUndo={false}
        canRedo={false}
        historyIndex={0}
        historyLength={1}
        onUndo={() => {}}
        onRedo={() => {}}
        brushSize={1}
        setBrushSize={() => {}}
        onRotate90={() => {}}
        onFlipH={() => {}}
        onFlipV={() => {}}
        isStrictMonochrome={false}
        allowColorThemes={true}
        activePixelColor="#00e5a3"
        activeDrawColor="#00e5a3"
        setActiveDrawColor={() => {}}
        recentPaletteRef={{ current: null }}
        activeBgColor="#12141a"
        onBgColorChange={() => {}}
        onOpenCanvasEyedropper={() => {}}
        onOpenImportModal={() => {}}
        onExportPNG={() => {}}
        onExportCArray={() => {}}
        onExportJSON={() => {}}
        onOpenLoadModal={onOpenLoadModal}
      />
    );

    expect(html).toContain('Load');
    expect(html).toContain('aria-label="Load Saved Room, Import and Export"');
  });
});

