import { useSyncExternalStore } from 'react';

/** True while the media query matches; updates on resize and rotation. */
export default function useMediaQuery(query) {
  return useSyncExternalStore(
    (onChange) => {
      const mql = window.matchMedia(query);
      mql.addEventListener('change', onChange);
      return () => mql.removeEventListener('change', onChange);
    },
    () => window.matchMedia(query).matches,
    () => false
  );
}

// Mirrors the 768 breakpoint used in the stylesheets (media queries cannot read CSS variables).
export const WIDE = '(min-width: 768px)'; // ds-allow-hardcode: breakpoint
