// Original melody generator. Produces gentle, mostly stepwise phrases in the
// major scale (degrees 1..7) that resolve on a stable note. No existing
// melodies are used anywhere in the game.

const STEP_WEIGHTS = [
  [1, 34], [-1, 34], [2, 12], [-2, 12], [0, 4], [3, 2], [-3, 2],
];

export function generateMelody(rng, length, opts = {}) {
  const { start = [1, 3, 5], end = [1, 3, 5], low = 1, high = 7 } = opts;
  if (length <= 0) return [];
  const seq = [rng.pick(start)];
  let lastLeap = 0;
  for (let i = 1; i < length; i++) {
    const prev = seq[i - 1];
    let choices = STEP_WEIGHTS.map(([d, w]) => {
      let weight = w;
      // After a leap, prefer stepping back the other way.
      if (lastLeap && Math.sign(d) === -Math.sign(lastLeap)) weight *= 2;
      if (lastLeap && Math.sign(d) === Math.sign(lastLeap) && Math.abs(d) > 1) weight *= 0.3;
      return [d, weight];
    }).filter(([d]) => prev + d >= low && prev + d <= high);
    // Avoid three identical notes in a row.
    if (i >= 2 && seq[i - 1] === seq[i - 2]) choices = choices.filter(([d]) => d !== 0);
    let next = prev + rng.weighted(choices);
    if (i === length - 1 && length > 2) {
      // Resolve to the closest stable note.
      next = end.reduce((best, n) => (Math.abs(n - prev) < Math.abs(best - prev) ? n : best), end[0]);
      if (next === prev && seq[i - 2] === prev) next = end.find((n) => n !== prev) ?? next;
    }
    lastLeap = Math.abs(next - prev) > 1 ? next - prev : 0;
    seq.push(next);
  }
  return seq;
}

// Longer celebratory theme (world complete), built from the same generator in
// two answering phrases.
export function generateTheme(rng, bars = 4) {
  const a = generateMelody(rng, 8, { start: [1, 3, 5], end: [5, 2] });
  const b = generateMelody(rng, 8, { start: [a[a.length - 1]], end: [1] });
  const out = a.concat(b);
  while (out.length < bars * 4) out.push(...generateMelody(rng, 4, { start: [3, 5], end: [1] }));
  return out;
}
