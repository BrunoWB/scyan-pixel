import { describe, it, expect, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import { ImageImportModal } from '../ImageImportModal';
import { EditorHeader } from '../editor/ui/EditorHeader';
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
});

describe('BwpxEditor file input', () => {
  it('renders hidden file input for importing images with valid formats', () => {
    const html = renderToString(<BwpxEditor />);

    expect(html).toContain('type="file"');
    expect(html).toContain('.png,.bmp,.jpg,.jpeg,.webp,.gif');
  });
});

describe('EditorHeader import button', () => {
  it('renders import button with title', () => {
    const onOpenImportModal = vi.fn();
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
        onOpenImportModal={onOpenImportModal}
        onExportPNG={() => {}}
        onExportCArray={() => {}}
        onExportJSON={() => {}}
        onFitToView={() => {}}
      />
    );

    expect(html).toContain('Import Image (PNG, JPG, BMP, GIF)');
    expect(html).toContain('Import');
  });
});

