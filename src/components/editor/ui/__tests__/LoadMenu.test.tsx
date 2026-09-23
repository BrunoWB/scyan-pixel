import { describe, it, expect, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import { LoadMenu } from '../LoadMenu';

describe('LoadMenu', () => {
  const defaultProps = {
    onOpenLoadModal: vi.fn(),
    onOpenImportModal: vi.fn(),
    onExportPNG: vi.fn(),
    onExportCArray: vi.fn(),
    onExportJSON: vi.fn(),
    onSaveJSONFile: vi.fn(),
    onDownloadCHeader: vi.fn(),
    selectionBounds: null,
    canvasDimensions: { width: 64, height: 64 },
  };

  it('renders modern unified Load trigger button with icon and chevron', () => {
    const html = renderToString(<LoadMenu {...defaultProps} />);

    // Renders the button with Load label
    expect(html).toContain('Load');
    expect(html).toContain('aria-haspopup="true"');
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('aria-label="Load project menu"');
    expect(html).toContain('lucide-folder-open');
    expect(html).toContain('lucide-chevron-down');
  });

  it('contains proper accessibility attributes on the button', () => {
    const html = renderToString(<LoadMenu {...defaultProps} />);

    expect(html).toContain('aria-expanded="false"');
  });
});

