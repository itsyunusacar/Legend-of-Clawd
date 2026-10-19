// Legend of Claude — the one level: a meadow, a forest, a cave, then the Bug King's
// arena. Positions are world pixels; blocks sit on the ground in 4-pixel columns.

export const TILE = 4
export const LEVEL_W = 1000
export const ARENA_L = 760 // the gate shuts behind you here
export const KING_X = 940

export type EnemyKind = 'bug' | 'hopper' | 'bat' | 'slime'
export type Zone = { name: 'meadow' | 'forest' | 'cave' | 'arena'; from: number }

export const ZONES: Zone[] = [
  { name: 'meadow', from: 0 },
  { name: 'forest', from: 250 },
  { name: 'cave', from: 520 },
  { name: 'arena', from: ARENA_L },
]

// Steps and walls: [x in pixels, width in tiles, height in blocks]
const BLOCKS: [number, number, number][] = [
  [200, 8, 1],
  [300, 12, 1], [312, 8, 2],
  [400, 4, 1],
  [470, 16, 1], [478, 8, 2],
  [560, 8, 1], [600, 12, 2], [604, 4, 3],
  [660, 4, 1], [700, 12, 1],
]

export const ENEMIES: { kind: EnemyKind; x: number }[] = [
  { kind: 'bug', x: 140 }, { kind: 'bug', x: 230 },
  { kind: 'hopper', x: 280 }, { kind: 'bat', x: 350 }, { kind: 'bug', x: 380 },
  { kind: 'bat', x: 440 }, { kind: 'hopper', x: 500 },
  { kind: 'slime', x: 545 }, { kind: 'bat', x: 590 }, { kind: 'hopper', x: 640 },
  { kind: 'slime', x: 680 }, { kind: 'bat', x: 720 }, { kind: 'bug', x: 735 },
]

export const BUSHES = [90, 120, 175, 265, 345, 430, 540, 690]
export const SIGN_X = 30

const heights = new Uint8Array(Math.ceil(LEVEL_W / TILE))
for (const [x, w, h] of BLOCKS) {
  for (let i = 0; i < w; i++) heights[x / TILE + i] = Math.max(heights[x / TILE + i], h)
}

// Height of the ground (in pixels above the grass line) under world x
export function groundAt(x: number): number {
  const i = Math.floor(x / TILE)
  return i < 0 || i >= heights.length ? 0 : heights[i] * TILE
}

// Highest ground under a body spanning [l, r)
export function floorUnder(l: number, r: number): number {
  let top = 0
  for (let x = Math.floor(l); x < r; x += 1) top = Math.max(top, groundAt(x))
  return top
}

export function zoneAt(x: number): Zone {
  let z = ZONES[0]
  for (const zone of ZONES) if (x >= zone.from) z = zone
  return z
}

// Where you come back after falling: the start of the zone you reached
export function checkpointFor(x: number): number {
  const z = zoneAt(x)
  return z.name === 'arena' ? ARENA_L + 6 : z.from + 8
}
