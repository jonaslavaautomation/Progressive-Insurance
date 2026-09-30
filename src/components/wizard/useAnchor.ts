import { useRef, useState } from 'react';

/** Open/close state for a floating panel anchored to `ref`. */
export function useAnchor<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [isOpen, setOpen] = useState(false);
  return { ref, isOpen, open: () => setOpen(true), close: () => setOpen(false), toggle: () => setOpen((value) => !value) };
}
