/** Small seeded PRNG so the same seed always gives the same student sample. */
export function mulberry32(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Picks `count` distinct student ids reproducibly (Fisher-Yates shuffle over the sorted unique ids).
 * @param {readonly number[]} ids @param {number} count @param {number} seed @returns {Set<number>}
 */
export function sampleStudentIds(ids, count, seed) {
  const unique = [...new Set(ids)].sort((a, b) => a - b);
  const random = mulberry32(seed);
  for (let i = unique.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    const a = unique[i];
    const b = unique[j];
    if (a === undefined || b === undefined) continue;
    unique[i] = b;
    unique[j] = a;
  }
  return new Set(unique.slice(0, Math.min(count, unique.length)));
}
