import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import { EditorToolbar } from '../EditorToolbar';
import { ShapeToolButton } from '../ShapeToolButton';
import { Square } from 'lucide-react';

describe('EditorToolbar unified shapes', () => {
  it('renders unified shape buttons without duplicate outline and filled buttons or standalone arrow', () => {
    const html = renderToString(
      <EditorToolbar
        activeTool="pencil"
        setActiveTool={() => {}}
        activeDrawColor="#00e5a3"
        activePixelColor="#00e5a3"
      />
    );

    // Should include unified tool titles
    expect(html).toContain('Rectangle Outline (U)');
    expect(html).toContain('Circle / Ellipse Outline');
    expect(html).toContain('Triangle Outline');
    expect(html).toContain('Line (L)');
    expect(html).toContain('Star');
    expect(html).toContain('Cross / Plus');
    // Arrow is now a sub-tool of Line, not a standalone toolbar button when inactive
    expect(html).not.toContain('title="Arrow"');

    // Should contain corner indicator triangles marking multi-variant shapes
    expect(html).toContain('points="6,2 6,6 2,6"');
  });

  it('highlights the shape button when either outline or filled variant is active', () => {
    // When outline rectangle is active
    const htmlOutline = renderToString(
      <EditorToolbar
        activeTool="rect"
        setActiveTool={() => {}}
        activeDrawColor="#ff004d"
        activePixelColor="#00e5a3"
      />
    );
    expect(htmlOutline).toContain('background-color:#ff004d');
    expect(htmlOutline).toContain('title="Rectangle Outline (U)"');

    // When filled rectangle is active
    const htmlFilled = renderToString(
      <EditorToolbar
        activeTool="filled-rect"
        setActiveTool={() => {}}
        activeDrawColor="#ff004d"
        activePixelColor="#00e5a3"
      />
    );
    expect(htmlFilled).toContain('background-color:#ff004d');
    expect(htmlFilled).toContain('title="Filled Rectangle"');
  });

  it('highlights the unified line/arrow button when line or arrow variant is active', () => {
    // When line is active
    const htmlLine = renderToString(
      <EditorToolbar
        activeTool="line"
        setActiveTool={() => {}}
        activeDrawColor="#ff004d"
        activePixelColor="#00e5a3"
      />
    );
    expect(htmlLine).toContain('background-color:#ff004d');
    expect(htmlLine).toContain('title="Line (L)"');

    // When outline arrow is active
    const htmlArrow = renderToString(
      <EditorToolbar
        activeTool="arrow"
        setActiveTool={() => {}}
        activeDrawColor="#ff004d"
        activePixelColor="#00e5a3"
      />
    );
    expect(htmlArrow).toContain('background-color:#ff004d');
    expect(htmlArrow).toContain('title="Arrow"');

    // When filled arrow is active
    const htmlFilledArrow = renderToString(
      <EditorToolbar
        activeTool="filled-arrow"
        setActiveTool={() => {}}
        activeDrawColor="#ff004d"
        activePixelColor="#00e5a3"
      />
    );
    expect(htmlFilledArrow).toContain('background-color:#ff004d');
    expect(htmlFilledArrow).toContain('title="Filled Arrow"');
  });



  it('reflects active state for circle and triangle variants', () => {
    const htmlFilledEllipse = renderToString(
      <EditorToolbar
        activeTool="filled-ellipse"
        setActiveTool={() => {}}
        activeDrawColor="#00d2ff"
        activePixelColor="#00e5a3"
      />
    );
    expect(htmlFilledEllipse).toContain('title="Filled Circle"');

    const htmlFilledTriangle = renderToString(
      <EditorToolbar
        activeTool="filled-triangle"
        setActiveTool={() => {}}
        activeDrawColor="#00d2ff"
        activePixelColor="#00e5a3"
      />
    );
    expect(htmlFilledTriangle).toContain('title="Filled Triangle"');
  });
});

describe('ShapeToolButton', () => {
  it('renders corner glyph and default outline icon when inactive', () => {
    const html = renderToString(
      <ShapeToolButton
        outlineTool="rect"
        filledTool="filled-rect"
        outlineIcon={<Square className="w-3.5 h-3.5" data-testid="outline-icon" />}
        filledIcon={<Square className="w-3.5 h-3.5 fill-current" data-testid="filled-icon" />}
        outlineTitle="Rectangle Outline (U)"
        filledTitle="Filled Rectangle"
        activeTool="pencil"
        setActiveTool={() => {}}
        activeDrawColor="#00e5a3"
      />
    );

    expect(html).toContain('title="Rectangle Outline (U)"');
    expect(html).toContain('data-testid="outline-icon"');
    expect(html).toContain('points="6,2 6,6 2,6"');
    expect(html).not.toContain('background-color:#00e5a3');
  });

  it('renders filled icon and filled title when filled tool is active', () => {
    const html = renderToString(
      <ShapeToolButton
        outlineTool="rect"
        filledTool="filled-rect"
        outlineIcon={<Square className="w-3.5 h-3.5" data-testid="outline-icon" />}
        filledIcon={<Square className="w-3.5 h-3.5 fill-current" data-testid="filled-icon" />}
        outlineTitle="Rectangle Outline (U)"
        filledTitle="Filled Rectangle"
        activeTool="filled-rect"
        setActiveTool={() => {}}
        activeDrawColor="#00e5a3"
      />
    );

    expect(html).toContain('title="Filled Rectangle"');
    expect(html).toContain('data-testid="filled-icon"');
    expect(html).toContain('background-color:#00e5a3');
  });

  it('supports semantic primary and secondary aliases for Line and Arrow', () => {
    const htmlInactive = renderToString(
      <ShapeToolButton
        primaryTool="line"
        secondaryTool="arrow"
        primaryIcon={<span data-testid="line-icon" />}
        secondaryIcon={<span data-testid="arrow-icon" />}
        primaryTitle="Line (L)"
        secondaryTitle="Arrow"
        primaryLabel="Line"
        secondaryLabel="Arrow"
        activeTool="pencil"
        setActiveTool={() => {}}
        activeDrawColor="#00e5a3"
      />
    );

    expect(htmlInactive).toContain('title="Line (L)"');
    expect(htmlInactive).toContain('data-testid="line-icon"');
    expect(htmlInactive).toContain('points="6,2 6,6 2,6"');

    const htmlArrowActive = renderToString(
      <ShapeToolButton
        primaryTool="line"
        secondaryTool="arrow"
        primaryIcon={<span data-testid="line-icon" />}
        secondaryIcon={<span data-testid="arrow-icon" />}
        primaryTitle="Line (L)"
        secondaryTitle="Arrow"
        primaryLabel="Line"
        secondaryLabel="Arrow"
        activeTool="arrow"
        setActiveTool={() => {}}
        activeDrawColor="#ff004d"
      />
    );

    expect(htmlArrowActive).toContain('title="Arrow"');
    expect(htmlArrowActive).toContain('data-testid="arrow-icon"');
    expect(htmlArrowActive).toContain('background-color:#ff004d');
  });

  it('renders correctly with custom multi-variant list', () => {
    const html = renderToString(
      <ShapeToolButton
        variants={[
          { tool: 'line', icon: <span data-testid="line-tool" />, title: 'Line Tool', label: 'Line' },
          { tool: 'arrow', icon: <span data-testid="arrow-tool" />, title: 'Arrow Tool', label: 'Arrow' },
        ]}
        activeTool="line"
        setActiveTool={() => {}}
        activeDrawColor="#00e5a3"
      />
    );

    expect(html).toContain('title="Line Tool"');
    expect(html).toContain('data-testid="line-tool"');
    expect(html).toContain('background-color:#00e5a3');
  });

  it('renders pencil multi-variant button with round brush default', () => {
    const html = renderToString(
      <EditorToolbar
        activeTool="round-pencil"
        setActiveTool={() => {}}
        activeDrawColor="#00e5a3"
        activePixelColor="#00e5a3"
      />
    );

    expect(html).toContain('Round Brush (B/P)');
    expect(html).toContain('background-color:#00e5a3');
  });

  it('highlights pencil button when square pencil is active', () => {
    const html = renderToString(
      <EditorToolbar
        activeTool="pencil"
        setActiveTool={() => {}}
        activeDrawColor="#ff004d"
        activePixelColor="#00e5a3"
      />
    );

    expect(html).toContain('Square Pencil (B/P)');
    expect(html).toContain('background-color:#ff004d');
  });
});

