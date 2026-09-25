let counter = 0;

/** Compact, collision-resistant id (no external dependency). */
export function uid(prefix = 'id'): string {
  counter = (counter + 1) % 1000000;
  const time = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${time}${rand}${counter.toString(36)}`;
}
