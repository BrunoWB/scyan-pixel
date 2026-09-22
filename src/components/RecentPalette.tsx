import { useState, useRef, useImperativeHandle, forwardRef, useEffect, useCallback } from 'react';
import './RecentPalette.css';

export interface RecentPaletteHandle {
  pushColor: (color: string) => void;
}

export interface RecentPaletteProps {
  activeColor: string;
  onSelectColor: (color: string) => void;
  maxColors?: number;
  initialColor?: string;
}

interface PaletteItem {
  id: string;
  color: string;
}

const DEFAULT_SEED_COLORS = [
  '#00e5a3',
  '#ffffff',
  '#000000',
  '#ff004d',
  '#ffa300',
  '#ffec27',
  '#29adff',
  '#83769c',
  '#ff77a8',
  '#00d2ff',
  '#c2c3c7',
  '#ab5236',
];

export const RecentPalette = forwardRef<RecentPaletteHandle, RecentPaletteProps>(
  ({ activeColor, onSelectColor, maxColors = 12, initialColor }, ref) => {
    // Generate initial items
    const [items, setItems] = useState<PaletteItem[]>(() => {
      const firstColor = initialColor || activeColor || '#00e5a3';
      const list = [firstColor, ...DEFAULT_SEED_COLORS.filter((c) => c.toLowerCase() !== firstColor.toLowerCase())];
      return list.slice(0, maxColors).map((c, i) => ({
        id: `init-${i}-${c.replace('#', '')}`,
        color: c,
      }));
    });

    const [animatingId, setAnimatingId] = useState<number>(0);
    const [exitingItem, setExitingItem] = useState<PaletteItem | null>(null);
    const [shiftedItemIds, setShiftedItemIds] = useState<Set<string>>(new Set());
    const [newItemId, setNewItemId] = useState<string | null>(null);

    const animTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const itemsRef = useRef(items);
    useEffect(() => {
      itemsRef.current = items;
    }, [items]);

    // Clean up timer on unmount
    useEffect(() => {
      return () => {
        if (animTimerRef.current) clearTimeout(animTimerRef.current);
      };
    }, []);

    // Push a new color into the recent palette
    const pushColor = useCallback(
      (newColorHex: string) => {
        const hex = newColorHex.toLowerCase();
        if (!hex || !hex.startsWith('#')) return;

        const currentItems = itemsRef.current;
        // If already the first item, nothing to bump
        if (currentItems.length > 0 && currentItems[0].color.toLowerCase() === hex) {
          return;
        }

        // Clear any pending animation cleanup
        if (animTimerRef.current) {
          clearTimeout(animTimerRef.current);
          animTimerRef.current = null;
        }

        const existingIdx = currentItems.findIndex((item) => item.color.toLowerCase() === hex);
        const newId = `recent-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

        let nextExiting: PaletteItem | null = null;
        let remaining: PaletteItem[] = [];
        const shifted = new Set<string>();

        if (existingIdx !== -1) {
          // Color was in the list: remove old instance
          remaining = currentItems.filter((_, i) => i !== existingIdx);
          // Items from 0 to existingIdx - 1 shifted right
          for (let i = 0; i < existingIdx; i++) {
            shifted.add(remaining[i].id);
          }
        } else {
          // Brand new color: if at max, last one overflows
          if (currentItems.length >= maxColors) {
            nextExiting = currentItems[currentItems.length - 1];
            remaining = currentItems.slice(0, maxColors - 1);
          } else {
            remaining = [...currentItems];
          }
          // All previous items are bumped to the right
          for (const it of remaining) {
            shifted.add(it.id);
          }
        }

        const nextItems = [{ id: newId, color: newColorHex }, ...remaining];
        itemsRef.current = nextItems;
        setItems(nextItems);

        // Trigger animation state
        const animGen = Date.now();
        setAnimatingId(animGen);
        setNewItemId(newId);
        setShiftedItemIds(shifted);
        setExitingItem(nextExiting);

        // Reset animation classes after 380ms
        animTimerRef.current = setTimeout(() => {
          setExitingItem(null);
          setNewItemId(null);
          setShiftedItemIds(new Set());
          setAnimatingId(0);
        }, 380);
      },
      [maxColors]
    );

    // Expose pushColor to parent via ref
    useImperativeHandle(ref, () => ({
      pushColor,
    }));

    const handleSwatchClick = (item: PaletteItem) => {
      onSelectColor(item.color);
    };

    // Equilateral triangles geometry: side = 28px, height = 28 * sqrt(3)/2 ≈ 24.25px, overlap = 10px (step = 18px)
    const itemWidth = 28;
    const itemHeight = 25;
    const overlap = 10;
    const step = itemWidth - overlap;
    const containerWidth = itemWidth + (maxColors - 1) * step + 4;

    return (
      <div
        className="relative z-10 flex items-start overflow-hidden pt-0 pb-0.5 px-0.5 select-none flex-shrink-0"
        style={{ width: `${containerWidth}px`, height: `${itemHeight}px` }}
      >
        {items.map((item, index) => {
          const isSelected = activeColor.toLowerCase() === item.color.toLowerCase();
          const isNew = item.id === newItemId && animatingId > 0;
          const isShifted = shiftedItemIds.has(item.id) && animatingId > 0;

          let animClass = '';
          if (isNew) {
            animClass = 'swatch-drop-in';
          } else if (isShifted) {
            animClass = 'swatch-bump-right';
          }

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleSwatchClick(item)}
              style={{
                marginLeft: index === 0 ? 0 : `-${overlap}px`,
                zIndex: isSelected ? 25 : items.length - index,
              }}
              className={`relative flex-shrink-0 focus:outline-none transition-transform duration-150 cursor-pointer ${
                isSelected
                  ? 'scale-105 translate-y-0.5'
                  : 'hover:scale-108 hover:translate-y-0.5 hover:z-30'
              } ${animClass}`}
              title={item.color}
            >
              <svg
                width={itemWidth}
                height={itemHeight}
                viewBox="0 0 28 25"
                className="overflow-visible drop-shadow-sm pointer-events-none"
              >
                {/* Equilateral triangle pointing down, top base clipped flush at top of screen */}
                <polygon
                  points="0,0 28,0 14,24.25"
                  fill={item.color}
                  stroke={isSelected ? '#ffffff' : 'rgba(255,255,255,0.3)'}
                  strokeWidth={isSelected ? '1.5' : '1'}
                  strokeLinejoin="round"
                />
                {isSelected && (
                  <circle
                    cx="14"
                    cy="8"
                    r="2"
                    fill="#ffffff"
                    opacity="0.95"
                  />
                )}
              </svg>
            </button>
          );
        })}

        {/* Overflowing exiting triangle that fades away to the right */}
        {exitingItem && (
          <div
            key={exitingItem.id}
            className="absolute right-0.5 top-0 flex-shrink-0 swatch-fade-away pointer-events-none"
            style={{ width: `${itemWidth}px`, height: `${itemHeight}px` }}
            title={exitingItem.color}
          >
            <svg
              width={itemWidth}
              height={itemHeight}
              viewBox="0 0 28 25"
              className="drop-shadow-sm pointer-events-none"
            >
              <polygon
                points="0,0 28,0 14,24.25"
                fill={exitingItem.color}
                stroke="rgba(255,255,255,0.3)"
                strokeWidth="1"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        )}
      </div>
    );
  }
);

RecentPalette.displayName = 'RecentPalette';
