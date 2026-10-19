// Legend of Clawd — the title logo, after the classic one: a big leaning first
// letter that drops below the line, bevelled red serif capitals, "THE LEGEND OF"
// in small caps above. Pure pixels.

export type Plot = (x: number, y: number, color: number) => void

// ---- Small caps, 3x5, for "THE LEGEND OF" and the menu ----
const SMALL: Record<string, string[]> = {
  A: ['.#.', '#.#', '###', '#.#', '#.#'],
  C: ['.##', '#..', '#..', '#..', '.##'],
  D: ['##.', '#.#', '#.#', '#.#', '##.'],
  E: ['###', '#..', '##.', '#..', '###'],
  F: ['###', '#..', '##.', '#..', '#..'],
  G: ['.##', '#..', '#.#', '#.#', '.##'],
  H: ['#.#', '#.#', '###', '#.#', '#.#'],
  I: ['###', '.#.', '.#.', '.#.', '###'],
  K: ['#.#', '#.#', '##.', '#.#', '#.#'],
  L: ['#..', '#..', '#..', '#..', '###'],
  N: ['##.', '#.#', '#.#', '#.#', '#.#'],
  O: ['.#.', '#.#', '#.#', '#.#', '.#.'],
  P: ['##.', '#.#', '##.', '#..', '#..'],
  Q: ['.#.', '#.#', '#.#', '##.', '.##'],
  R: ['##.', '#.#', '##.', '#.#', '#.#'],
  S: ['.##', '#..', '.#.', '..#', '##.'],
  T: ['###', '.#.', '.#.', '.#.', '.#.'],
  U: ['#.#', '#.#', '#.#', '#.#', '###'],
  W: ['#.#', '#.#', '#.#', '###', '#.#'],
  Y: ['#.#', '#.#', '.#.', '.#.', '.#.'],
  '>': ['#..', '.#.', '..#', '.#.', '#..'],
  ' ': ['...', '...', '...', '...', '...'],
}

// ---- Serif capitals, 9 tall, for LAWD ----
const BIG: Record<string, string[]> = {
  L: [
    '####...',
    '.##....',
    '.##....',
    '.##....',
    '.##....',
    '.##....',
    '.##...#',
    '.##..##',
    '#######',
  ],
  A: [
    '....#....',
    '...###...',
    '...###...',
    '..##.##..',
    '..##.##..',
    '.#######.',
    '.##...##.',
    '##.....##',
    '###...###',
  ],
  W: [
    '###..###..###',
    '.##...##...#.',
    '.##..###...#.',
    '..##.#.##.#..',
    '..##.#.##.#..',
    '..####.####..',
    '...##...##...',
    '...##...##...',
    '...#.....#...',
  ],
  D: [
    '######...',
    '.##..##..',
    '.##...##.',
    '.##...##.',
    '.##...##.',
    '.##...##.',
    '.##...##.',
    '.##..##..',
    '######...',
  ],
}

// The big first letter leans like the classic Z and runs past the others at the
// bottom: a C built from bars and a stem, then sheared
const C_H = 16
function bigC(): string[] {
  const w = 14, last = C_H - 1
  const rows: string[] = []
  for (let y = 0; y < C_H; y++) {
    let row = ''
    for (let x = 0; x < w; x++) {
      const topBar = y <= 2 && x >= (y === 0 ? 3 : 1) && x <= 13 - Math.max(0, y - 1)
      const bottomBar = y >= last - 2 && x >= (y === last ? 3 : 1) && x <= 13 - Math.max(0, last - 1 - y)
      const stem = x <= 3 && y >= 1 && y <= last - 1 && !(x === 0 && (y < 3 || y > last - 3))
      const topSerif = y >= 3 && y <= 5 && x >= 10 && x <= 12 && x - 10 >= y - 3
      const bottomSerif = y >= last - 5 && y <= last - 3 && x >= 10 && x <= 12 && x - 10 >= last - 3 - y
      row += topBar || bottomBar || stem || topSerif || bottomSerif ? '#' : '.'
    }
    rows.push(' '.repeat(Math.round((last - y) * 0.42)) + row)
  }
  const width = Math.max(...rows.map((r) => r.length))
  return rows.map((r) => r.replace(/ /g, '.').padEnd(width, '.'))
}

export type Shade = { top: number; bottom: number; light: number; dark: number; edge: number }

export const RED: Shade = { top: 0xe8243a, bottom: 0xa80c24, light: 0xff6a78, dark: 0x620816, edge: 0x1a0206 }
export const DIM: Shade = { top: 0x7a7488, bottom: 0x4a4458, light: 0x9a94a8, dark: 0x2a2436, edge: 0x0a0810 }

type Mask = { w: number; h: number; on: (x: number, y: number) => boolean }

function maskOf(text: string, font: Record<string, string[]>, gap: number): Mask {
  const glyphs = [...text].map((ch) => font[ch] ?? font[' '] ?? [])
  const h = Math.max(...glyphs.map((g) => g.length))
  const cols: boolean[][] = []
  glyphs.forEach((g, i) => {
    const w = g[0]?.length ?? 0
    for (let x = 0; x < w; x++) cols.push(Array.from({ length: h }, (_, y) => g[y]?.[x] === '#'))
    if (i < glyphs.length - 1) for (let k = 0; k < gap; k++) cols.push(Array(h).fill(false))
  })
  return { w: cols.length, h, on: (x, y) => cols[x]?.[y] === true }
}

function rowsMask(rows: string[]): Mask {
  return { w: rows[0]?.length ?? 0, h: rows.length, on: (x, y) => rows[y]?.[x] === '#' }
}

function mix(a: number, b: number, t: number): number {
  const ch = (s: number) => Math.round(((a >> s) & 255) * (1 - t) + ((b >> s) & 255) * t) << s
  return ch(16) | ch(8) | ch(0)
}

// Bevelled like cast metal: a lit top edge, shadowed bottom and right edges, a
// gradient in between and a dark outline around
function paint(plot: Plot, m: Mask, x0: number, y0: number, c: Shade): void {
  for (let y = -1; y <= m.h; y++) {
    for (let x = -1; x <= m.w; x++) {
      if (m.on(x, y)) {
        const lit = !m.on(x, y - 1)
        const shade = !m.on(x, y + 1) || !m.on(x + 1, y)
        plot(x0 + x, y0 + y, lit ? c.light : shade ? c.dark : mix(c.top, c.bottom, y / Math.max(1, m.h - 1)))
      } else if (m.on(x - 1, y) || m.on(x + 1, y) || m.on(x, y - 1) || m.on(x, y + 1)) plot(x0 + x, y0 + y, c.edge)
    }
  }
}

// Small caps get a plain gradient: at three pixels wide a bevel only muddies them
function paintFlat(plot: Plot, m: Mask, x0: number, y0: number, c: Shade): void {
  for (let y = 0; y < m.h; y++) {
    for (let x = 0; x < m.w; x++) if (m.on(x, y)) plot(x0 + x, y0 + y, mix(c.light, c.top, y / Math.max(1, m.h - 1)))
  }
}

export function smallWidth(text: string): number {
  return maskOf(text, SMALL, 1).w
}

export function drawSmall(plot: Plot, text: string, x: number, y: number, c: Shade = RED): void {
  paintFlat(plot, maskOf(text, SMALL, 1), x, y, c)
}

const C_ROWS = bigC()
const LAWD = maskOf('LAWD', BIG, 1)
const SMALL_TITLE = maskOf('THE LEGEND OF', SMALL, 1)
const LAWD_X = (C_ROWS[0]?.length ?? 0) - 2 // tucked under the C's top bar, as ELDA sits under the Z's
const LAWD_Y = 6

export const LOGO_W = LAWD_X + Math.max(LAWD.w, SMALL_TITLE.w) + 1
export const LOGO_H = C_H

// Draws the whole logo with its top-left at (x, y)
export function drawLogo(plot: Plot, x: number, y: number): void {
  paint(plot, rowsMask(C_ROWS), x, y, RED)
  paint(plot, LAWD, x + LAWD_X, y + LAWD_Y, RED)
  paintFlat(plot, SMALL_TITLE, x + LAWD_X + 1, y, RED)
}
