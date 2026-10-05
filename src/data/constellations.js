// Constellations drawn by completed levels. Each has 20 stars (one per level
// of its world, in order) plus the lines that join them. Coordinates are in a
// 100×100 box.

const whale = {
  name: 'The Whale',
  points: [
    [8, 58], [14, 46], [26, 38], [40, 34], [54, 35], [66, 40], [76, 48], [84, 52], [93, 40], [95, 62],
    [72, 62], [58, 68], [42, 70], [26, 68], [14, 63], [19, 53], [36, 80], [20, 31], [14, 21], [27, 21],
  ],
  edges: [
    [0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 8], [8, 9], [9, 7], [6, 10], [10, 11],
    [11, 12], [12, 13], [13, 14], [14, 0], [12, 16], [1, 17], [17, 18], [17, 19],
  ],
};

const fox = {
  name: 'The Fox',
  points: [
    [28, 12], [37, 26], [47, 12], [53, 30], [64, 38], [71, 41], [57, 47], [44, 50], [24, 31], [36, 63],
    [38, 86], [58, 87], [67, 71], [61, 57], [76, 82], [89, 72], [93, 55], [82, 66], [50, 35], [27, 46],
  ],
  edges: [
    [8, 0], [0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [8, 19], [19, 7], [7, 9], [9, 10],
    [10, 11], [11, 12], [12, 13], [13, 7], [12, 14], [14, 15], [15, 16], [16, 17], [17, 12],
  ],
};

const deer = {
  name: 'The Deer',
  points: [
    [16, 6], [30, 3], [37, 13], [28, 20], [25, 27], [12, 33], [20, 39], [32, 43], [35, 58], [33, 88],
    [53, 62], [72, 89], [78, 56], [85, 50], [60, 46], [41, 40], [30, 73], [73, 73], [37, 25], [23, 31],
  ],
  edges: [
    [0, 3], [1, 2], [2, 3], [3, 4], [4, 18], [4, 5], [5, 6], [6, 7], [18, 15], [15, 14], [14, 12],
    [12, 13], [7, 8], [8, 16], [16, 9], [8, 10], [10, 12], [12, 17], [17, 11],
  ],
};

const bird = {
  name: 'The Bird',
  points: [
    [5, 36], [17, 30], [29, 33], [40, 41], [50, 45], [61, 41], [72, 30], [84, 21], [96, 18], [87, 31],
    [74, 40], [15, 42], [28, 45], [50, 33], [55, 26], [43, 66], [50, 75], [57, 66], [50, 56], [51, 30],
  ],
  edges: [
    [0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 8], [8, 9], [9, 10], [10, 5], [0, 11],
    [11, 12], [12, 3], [4, 13], [13, 14], [4, 18], [18, 15], [18, 16], [18, 17],
  ],
};

function arc(cx, cy, r, from, to, n) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = ((from + ((to - from) * i) / (n - 1)) * Math.PI) / 180;
    pts.push([Math.round((cx + Math.cos(a) * r) * 10) / 10, Math.round((cy + Math.sin(a) * r) * 10) / 10]);
  }
  return pts;
}

// Crescent moon: an outer arc and an inner arc, plus four companion stars.
const moonOuter = arc(48, 50, 38, 60, 300, 9);
const moonInner = arc(64, 46, 28, 112, 248, 7);
const moon = {
  name: 'The Moon',
  points: [...moonOuter, ...moonInner.slice().reverse(), [86, 18], [92, 34], [80, 80], [90, 66]],
  edges: [
    ...moonOuter.slice(1).map((_, i) => [i, i + 1]),
    [8, 9], ...moonInner.slice(1).map((_, i) => [9 + i, 10 + i]), [15, 0], [16, 17], [18, 19],
  ],
};

// Daily flower: one star per completed daily puzzle (cycles every 20).
const petals = [];
for (let i = 0; i < 6; i++) {
  const a = (i / 6) * Math.PI * 2 - Math.PI / 2;
  const tip = [50 + Math.cos(a) * 36, 46 + Math.sin(a) * 36];
  const side = [50 + Math.cos(a + 0.42) * 20, 46 + Math.sin(a + 0.42) * 20];
  petals.push(tip.map((v) => Math.round(v)), side.map((v) => Math.round(v)));
}
const flower = {
  name: 'The Flower',
  points: [[50, 46], ...petals, [50, 70], [50, 84], [50, 96], [40, 88], [60, 80], [50, 58], [44, 64]],
  edges: [
    ...[0, 1, 2, 3, 4, 5].map((i) => [1 + i * 2, 2 + i * 2]),
    ...[0, 1, 2, 3, 4, 5].map((i) => [2 + i * 2, 1 + ((i + 1) % 6) * 2]),
    [0, 18], [18, 13], [13, 14], [14, 15], [14, 16], [13, 17],
  ],
};

export const CONSTELLATIONS = { whale, fox, deer, bird, moon, flower };
