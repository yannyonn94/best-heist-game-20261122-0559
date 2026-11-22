// A tiny seeded random generator (mulberry32) so a ?shot= scene with &seed=N always plays
// the same way, and a fresh game still feels different every visit.

/** Build a generator from a 32-bit seed. */
export function createRandom(seed) {
  let state = (seed >>> 0) || 0x9e3779b9;
  return {
    /** Next float in [0, 1). */
    next() {
      state = (state + 0x6d2b79f5) >>> 0;
      let value = state;
      value = Math.imul(value ^ (value >>> 15), value | 1);
      value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
      return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    },
    /** Next float in [min, max). */
    range(min, max) {
      return min + (max - min) * this.next();
    },
    /** Next integer in [min, max]. */
    int(min, max) {
      return Math.floor(this.range(min, max + 1));
    },
    /** Pick one element of an array. */
    pick(items) {
      return items[Math.floor(this.next() * items.length)];
    },
    /** True with the given probability (0 to 1). */
    chance(probability) {
      return this.next() < probability;
    },
  };
}
