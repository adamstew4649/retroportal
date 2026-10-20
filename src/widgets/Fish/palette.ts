/** Default palette, chosen to read clearly against the dark tank water. */
export const DEFAULT_FISH_COLOURS = [
  '#ffb347',
  '#ff7f50',
  '#f5d76e',
  '#7fe3c3',
  '#66b3ff',
  '#c084fc',
  '#ff8fb1',
  '#f87171',
  '#a3e635',
  '#38bdf8',
  '#facc15',
  '#fb923c',
] as const;

export const MIN_FISH = 1;
export const MAX_FISH = 12;

export function isFishColour(value: unknown): value is string {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value);
}

export function clampFishCount(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 4;
  return Math.min(MAX_FISH, Math.max(MIN_FISH, Math.round(value)));
}

/**
 * Build a colour list that always matches the requested fish count, filling
 * gaps from the default palette and ignoring invalid stored values.
 */
export function resolveFishColours(colours: unknown, count: number): string[] {
  const total = clampFishCount(count);
  const provided = Array.isArray(colours) ? colours.filter(isFishColour) : [];
  return Array.from(
    { length: total },
    (_, index) => provided[index] ?? DEFAULT_FISH_COLOURS[index % DEFAULT_FISH_COLOURS.length],
  );
}
