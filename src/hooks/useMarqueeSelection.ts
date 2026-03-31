import { useEffect, useRef, useState, useCallback } from 'react';
import type { RefObject } from 'react';

export interface MarqueeRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface UseMarqueeSelectionOptions {
  containerRef: RefObject<HTMLDivElement | null>;
  itemSelector: string;
  selectedPaths: Set<string>;
  onSelectionChange: (paths: Set<string>) => void;
  enabled?: boolean;
}

interface UseMarqueeSelectionReturn {
  marqueeRect: MarqueeRect | null;
  isDragging: boolean;
}

function rectsIntersect(a: MarqueeRect, b: MarqueeRect): boolean {
  return !(
    a.x + a.width < b.x ||
    b.x + b.width < a.x ||
    a.y + a.height < b.y ||
    b.y + b.height < a.y
  );
}

const DEAD_ZONE = 5;
const EDGE_ZONE = 40;
const MAX_SCROLL_SPEED = 10;

export function useMarqueeSelection({
  containerRef,
  itemSelector,
  selectedPaths,
  onSelectionChange,
  enabled = true,
}: UseMarqueeSelectionOptions): UseMarqueeSelectionReturn {
  const [marqueeRect, setMarqueeRect] = useState<MarqueeRect | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Refs for mutable state during drag (avoid re-renders)
  const dragStateRef = useRef<{
    active: boolean;
    started: boolean;
    startX: number;
    startY: number;
    mouseDownClientX: number;
    mouseDownClientY: number;
    modifiers: { shift: boolean; meta: boolean };
    initialSelection: Set<string>;
    animFrameId: number;
    scrollAnimId: number;
    scrolling: boolean;
  } | null>(null);

  const selectedPathsRef = useRef(selectedPaths);
  selectedPathsRef.current = selectedPaths;

  const onSelectionChangeRef = useRef(onSelectionChange);
  onSelectionChangeRef.current = onSelectionChange;

  const hitTest = useCallback((rect: MarqueeRect) => {
    const container = containerRef.current;
    if (!container) return;

    const items = container.querySelectorAll(itemSelector);
    const containerRect = container.getBoundingClientRect();
    const intersected = new Set<string>();

    items.forEach(item => {
      const el = item as HTMLElement;
      const path = el.dataset.path;
      if (!path) return;

      const itemClientRect = el.getBoundingClientRect();
      const itemRect: MarqueeRect = {
        x: itemClientRect.left - containerRect.left + container.scrollLeft,
        y: itemClientRect.top - containerRect.top + container.scrollTop,
        width: itemClientRect.width,
        height: itemClientRect.height,
      };

      if (rectsIntersect(rect, itemRect)) {
        intersected.add(path);
      }
    });

    const state = dragStateRef.current;
    if (!state) return;

    let finalSet: Set<string>;
    if (state.modifiers.shift) {
      // Additive: union of initial + marquee
      finalSet = new Set(state.initialSelection);
      for (const p of intersected) finalSet.add(p);
    } else if (state.modifiers.meta) {
      // Toggle: symmetric difference
      finalSet = new Set(state.initialSelection);
      for (const p of intersected) {
        if (finalSet.has(p)) finalSet.delete(p);
        else finalSet.add(p);
      }
    } else {
      // Replace
      finalSet = intersected;
    }

    onSelectionChangeRef.current(finalSet);
  }, [containerRef, itemSelector]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !enabled) return;

    const onMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return;

      const target = e.target as HTMLElement;
      // Don't start marquee if clicking on an item or the header
      if (target.closest(itemSelector)) return;
      if (target.closest('.file-list-header')) return;

      e.preventDefault();

      const containerRect = container.getBoundingClientRect();
      const startX = e.clientX - containerRect.left + container.scrollLeft;
      const startY = e.clientY - containerRect.top + container.scrollTop;

      const modifiers = {
        shift: e.shiftKey,
        meta: e.metaKey || e.ctrlKey,
      };

      const initialSelection = (modifiers.shift || modifiers.meta)
        ? new Set(selectedPathsRef.current)
        : new Set<string>();

      dragStateRef.current = {
        active: true,
        started: false,
        startX,
        startY,
        mouseDownClientX: e.clientX,
        mouseDownClientY: e.clientY,
        modifiers,
        initialSelection,
        animFrameId: 0,
        scrollAnimId: 0,
        scrolling: false,
      };

      const onMouseMove = (e: MouseEvent) => {
        const state = dragStateRef.current;
        if (!state || !state.active) return;

        // Dead zone check
        if (!state.started) {
          const dx = e.clientX - state.mouseDownClientX;
          const dy = e.clientY - state.mouseDownClientY;
          if (Math.sqrt(dx * dx + dy * dy) < DEAD_ZONE) return;
          state.started = true;
          setIsDragging(true);

          // Clear selection at drag start if no modifier
          if (!state.modifiers.shift && !state.modifiers.meta) {
            onSelectionChangeRef.current(new Set());
          }
        }

        const containerRect = container.getBoundingClientRect();
        const currentX = e.clientX - containerRect.left + container.scrollLeft;
        const currentY = e.clientY - containerRect.top + container.scrollTop;

        const rect: MarqueeRect = {
          x: Math.min(state.startX, currentX),
          y: Math.min(state.startY, currentY),
          width: Math.abs(currentX - state.startX),
          height: Math.abs(currentY - state.startY),
        };

        setMarqueeRect(rect);

        // Throttled hit-test
        cancelAnimationFrame(state.animFrameId);
        state.animFrameId = requestAnimationFrame(() => hitTest(rect));

        // Auto-scroll
        const mouseYInContainer = e.clientY - containerRect.top;
        const mouseXInContainer = e.clientX - containerRect.left;

        let scrollDeltaY = 0;
        if (mouseYInContainer < EDGE_ZONE) {
          scrollDeltaY = -Math.ceil((1 - mouseYInContainer / EDGE_ZONE) * MAX_SCROLL_SPEED);
        } else if (mouseYInContainer > containerRect.height - EDGE_ZONE) {
          scrollDeltaY = Math.ceil((1 - (containerRect.height - mouseYInContainer) / EDGE_ZONE) * MAX_SCROLL_SPEED);
        }

        let scrollDeltaX = 0;
        if (mouseXInContainer < EDGE_ZONE) {
          scrollDeltaX = -Math.ceil((1 - mouseXInContainer / EDGE_ZONE) * MAX_SCROLL_SPEED);
        } else if (mouseXInContainer > containerRect.width - EDGE_ZONE) {
          scrollDeltaX = Math.ceil((1 - (containerRect.width - mouseXInContainer) / EDGE_ZONE) * MAX_SCROLL_SPEED);
        }

        if (scrollDeltaX !== 0 || scrollDeltaY !== 0) {
          if (!state.scrolling) {
            state.scrolling = true;
            const scrollLoop = () => {
              const s = dragStateRef.current;
              if (!s || !s.scrolling || !s.active) return;
              container.scrollTop += scrollDeltaY;
              container.scrollLeft += scrollDeltaX;
              s.scrollAnimId = requestAnimationFrame(scrollLoop);
            };
            scrollLoop();
          }
        } else {
          state.scrolling = false;
          cancelAnimationFrame(state.scrollAnimId);
        }
      };

      const onMouseUp = () => {
        const state = dragStateRef.current;
        if (state) {
          cancelAnimationFrame(state.animFrameId);
          cancelAnimationFrame(state.scrollAnimId);
          state.scrolling = false;

          // Click on empty space (no drag) → clear selection
          if (!state.started && !state.modifiers.shift && !state.modifiers.meta) {
            onSelectionChangeRef.current(new Set());
          }
        }

        dragStateRef.current = null;
        setMarqueeRect(null);
        setIsDragging(false);

        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
      };

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    };

    container.addEventListener('mousedown', onMouseDown);
    return () => {
      container.removeEventListener('mousedown', onMouseDown);
      // Clean up any in-progress drag
      const state = dragStateRef.current;
      if (state) {
        cancelAnimationFrame(state.animFrameId);
        cancelAnimationFrame(state.scrollAnimId);
        dragStateRef.current = null;
      }
    };
  }, [containerRef, itemSelector, enabled, hitTest]);

  return { marqueeRect, isDragging };
}
