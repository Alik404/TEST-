/** Tone for a completion percentage: done, moving, barely started, not started. */
export const progressTone = (pct) => {
  const v = Number(pct) || 0;
  if (v >= 100) return 'success';
  if (v >= 50) return 'accent';
  if (v > 0) return 'warn';
  return 'neutral';
};
