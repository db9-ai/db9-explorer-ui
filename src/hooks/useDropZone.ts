import { useEffect, useState, useRef, useCallback } from 'react';
import type { RefObject } from 'react';

export interface UploadProgress {
  total: number;
  completed: number;
  current: string;
  errors: string[];
}

interface UseDropZoneOptions {
  containerRef: RefObject<HTMLElement | null>;
  onUpload: (files: File[]) => Promise<void>;
  enabled?: boolean;
}

interface UseDropZoneReturn {
  isDragOver: boolean;
}

export function useDropZone({
  containerRef,
  onUpload,
  enabled = true,
}: UseDropZoneOptions): UseDropZoneReturn {
  const [isDragOver, setIsDragOver] = useState(false);
  const dragCounterRef = useRef(0);
  const onUploadRef = useRef(onUpload);
  onUploadRef.current = onUpload;

  const handleDragEnter = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current++;
    if (e.dataTransfer?.types.includes('Files')) {
      setIsDragOver(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current--;
    if (dragCounterRef.current === 0) {
      setIsDragOver(false);
    }
  }, []);

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'copy';
    }
  }, []);

  const handleDrop = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current = 0;
    setIsDragOver(false);

    const files = Array.from(e.dataTransfer?.files || []);
    if (files.length > 0) {
      onUploadRef.current(files);
    }
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !enabled) return;

    container.addEventListener('dragenter', handleDragEnter);
    container.addEventListener('dragleave', handleDragLeave);
    container.addEventListener('dragover', handleDragOver);
    container.addEventListener('drop', handleDrop);

    return () => {
      container.removeEventListener('dragenter', handleDragEnter);
      container.removeEventListener('dragleave', handleDragLeave);
      container.removeEventListener('dragover', handleDragOver);
      container.removeEventListener('drop', handleDrop);
    };
  }, [containerRef, enabled, handleDragEnter, handleDragLeave, handleDragOver, handleDrop]);

  return { isDragOver };
}
