import { describe, it, expect, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import { SaveExportMenu } from '../SaveExportMenu';

describe('SaveExportMenu', () => {
  const defaultProps = {
    onExportPNG: vi.fn(),
    onExportCArray: vi.fn(),
    onExportJSON: vi.fn(),
    onSaveJSONFile: vi.fn(),
    onDownloadCHeader: vi.fn(),
    selectionBounds: null,
    canvasDimensions: { width: 64, height: 64 },
  };

  it('renders modern unified Export trigger button with icon and chevron', () => {
    const html = renderToString(<SaveExportMenu {...defaultProps} />);

    // Renders the button with Export label
    expect(html).toContain('Export');
    expect(html).toContain('aria-haspopup="true"');
  });

  it('contains proper accessibility attributes on the button', () => {
    const html = renderToString(<SaveExportMenu {...defaultProps} />);

    expect(html).toContain('aria-expanded="false"');
  });
});
