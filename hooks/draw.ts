// Legend of Claude — draws a frame. Pixels first (a canvas twice as tall as the
// rows), then cells: '▀' with the upper pixel as foreground, the lower as background.

import {
  PALETTE, FRAMES, BODY_W, BUG, BAT_UP, BAT_DOWN, SLIME, SLIME_SMALL, KING, FAIRY,
  HEART, HEART_EMPTY, RUPEE, BUSH, SIGN, TRIFORCE, TRIFORCE_COLORS,
} from './sprites.js'
import { drawLogo, drawSmall, smallWidth, LOGO_W, LOGO_H, RED, DIM, type Plot, type Shade } from './logo.ts'
import { ARENA_L, TILE, SIGN_X, groundAt, zoneAt } from './level.ts'
import { type Game, type Enemy, GROUND, SCENE_H, MAX_HEARTS, PLAYER_H, KING_W, KING_H, FPS, ENDING_READY, HINT_FRAMES } from './game.ts'
import { TEXTS } from './texts.ts'

export const DEFAULT = 0x01000000 // the terminal's own color
const UPPER = 0x2580 // ▀
const SPACE = 0x20
const WHITE = 0xffffff

// `oy` shifts what is drawn down: the scene keeps its own coordinates (ground at
// GROUND) whatever the canvas height, and the sky simply reaches higher
type Canvas = { w: number; h: number; oy: number; px: Uint32Array }
type Colors = { [ch: string]: number }

function canvas(w: number, h: number, oy = 0): Canvas {
  return { w, h, oy, px: new Uint32Array(w * h).fill(DEFAULT) }
}

function dot(c: Canvas, x: number, y: number, color: number): void {
  const xi = Math.round(x), yi = Math.round(y) + c.oy
  if (xi >= 0 && xi < c.w && yi >= 0 && yi < c.h) c.px[yi * c.w + xi] = color
}

// Bottom-left at (x, bottom); mirrored around `mirrorW` when dir is -1; `scale` blows pixels up
function sprite(c: Canvas, rows: readonly string[], x: number, bottom: number,
  o: { dir?: number; colors?: Colors; tint?: number; mirrorW?: number; scale?: number } = {}): void {
  const k = o.scale ?? 1
  const top = bottom - rows.length * k
  const mirrorW = o.mirrorW ?? rows[0].length
  rows.forEach((line, dy) => {
    for (let dx = 0; dx < line.length; dx++) {
      const ch = line[dx]
      const color = o.colors?.[ch] ?? (PALETTE as Colors)[ch]
      if (color === undefined) continue
      const sx = o.dir === -1 ? mirrorW - 1 - dx : dx
      for (let i = 0; i < k; i++) for (let j = 0; j < k; j++) dot(c, x + sx * k + i, top + dy * k + j, o.tint ?? color)
    }
  })
}

function hash(a: number, b: number): number {
  let h = Math.imul(a * 374761393 + b * 668265263, 1274126177)
  h ^= h >>> 13
  h = Math.imul(h, 1103515245)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

function mix(a: number, b: number, t: number): number {
  const ch = (s: number) => Math.round(((a >> s) & 255) * (1 - t) + ((b >> s) & 255) * t) << s
  return ch(16) | ch(8) | ch(0)
}

// ---- The world, column by column ----
const SKY: Record<string, [number, number]> = {
  meadow: [0x4a9fe0, 0xa8dcf5],
  forest: [0x2c5f5a, 0x5c9a80],
  cave: [0x15111d, 0x2a2236],
  arena: [0x1e1030, 0x3a1f4a],
}

function world(c: Canvas, g: Game, cam: number): void {
  for (let x = 0; x < c.w; x++) {
    const wx = x + cam
    const zone = zoneAt(wx).name
    const [top, bottom] = SKY[zone]
    const sky = -Math.max(0, c.oy) // the topmost scene row the canvas shows
    for (let y = sky; y < GROUND; y++) dot(c, x, y, mix(top, bottom, (y - sky) / (GROUND - sky)))
    scenery(c, g, x, wx, zone, cam)
    ground(c, x, wx, zone)
  }
}

function scenery(c: Canvas, g: Game, x: number, wx: number, zone: string, cam: number): void {
  if (zone === 'meadow') {
    const far = Math.floor(wx - cam * 0.5)
    const hill = Math.round(5 + Math.sin(far / 11) * 2.5 + Math.sin(far / 5.3))
    for (let y = GROUND - hill; y < GROUND; y++) dot(c, x, y, y === GROUND - hill ? 0x6cbf5a : 0x4f9a46)
    const cloud = Math.floor(wx - cam * 0.8 + g.frame * 0.05)
    const cx = ((cloud % 70) + 70) % 70
    if (cx < 12) {
      const cy = 3 + Math.floor(hash(Math.floor(cloud / 70), 1) * 4)
      const thick = cx < 2 || cx > 9 ? 1 : 2
      for (let y = cy; y < cy + thick; y++) dot(c, x, y, 0xf4fbff)
    }
  } else if (zone === 'forest') {
    const far = Math.floor(wx - cam * 0.4)
    const tree = ((far % 23) + 23) % 23
    if (tree < 9) {
      const crown = 3 + Math.abs(4 - tree)
      for (let y = crown; y < GROUND - 5; y++) dot(c, x, y, hash(far, y) > 0.8 ? 0x2f6b4a : 0x24503f)
    }
    if (tree === 4 || tree === 5) for (let y = GROUND - 5; y < GROUND; y++) dot(c, x, y, 0x4a3524)
  } else if (zone === 'cave') {
    const drip = Math.floor(hash(Math.floor(wx / 3), 7) * 6)
    for (let y = -Math.max(0, c.oy); y < drip; y++) dot(c, x, y, 0x3a3048)
    if (hash(Math.floor(wx / 2), 9) > 0.97) dot(c, x, 8 + Math.floor(hash(wx, 3) * 6), 0x7fd8ff) // glinting crystals
  } else {
    const pillar = ((wx - ARENA_L) % 40 + 40) % 40
    if (pillar < 4) for (let y = 2 - Math.max(0, c.oy); y < GROUND; y++) dot(c, x, y, pillar === 0 ? 0x2a1a38 : 0x4a3658)
    if (pillar === 1 || pillar === 2) {
      const flame = (g.frame + wx) % 6 < 3 ? 0xffb347 : 0xff7a1a
      dot(c, x, 8, flame)
      if ((g.frame >> 1) % 2 === pillar % 2) dot(c, x, 7, 0xffd166)
    }
  }
}

function ground(c: Canvas, x: number, wx: number, zone: string): void {
  const stone = zone === 'cave' || zone === 'arena'
  const n = hash(wx, 3)
  for (let y = GROUND; y < SCENE_H; y++) {
    const d = y - GROUND
    const color = stone
      ? (d === 0 ? 0x8a8496 : hash(wx, y) > 0.7 ? 0x4a4456 : 0x5e586a)
      : (d === 0 ? (n > 0.7 ? 0x8cd45a : 0x5fb03a) : d === 1 && n > 0.4 ? 0x3f8a2e : hash(wx, y) > 0.8 ? 0x5e3f26 : 0x7a5434)
    dot(c, x, y, color)
  }
  if (!stone && hash(wx, 11) > 0.97) dot(c, x, GROUND - 1, hash(wx, 13) > 0.5 ? 0xf2c230 : 0xe8e8f0) // flowers
  const h = groundAt(wx)
  for (let y = GROUND - h; y < GROUND; y++) {
    const px = ((wx % TILE) + TILE) % TILE, py = (y - GROUND + 400) % TILE
    const edge = px === 0 || py === 0
    const base = stone ? 0x6a6478 : 0x8e8a80
    dot(c, x, y, y === GROUND - h && !stone ? 0x5fb03a : edge ? mix(base, 0x000000, 0.3) : hash(wx, y) > 0.8 ? mix(base, WHITE, 0.15) : base)
  }
}

// ---- Things in the world ----
function playerFrame(g: Game): readonly string[] {
  const p = g.player
  if (g.mode === 'holdUp') return FRAMES.holdUp
  if (p.act === 'slash') return FRAMES.slash
  if (p.act === 'guard') return FRAMES.guard
  if (p.act === 'hurt') return FRAMES.hurt
  if (p.vz !== 0) return FRAMES.jump
  if (p.walking) return FRAMES.walk[Math.floor(g.frame / 2) % 4]
  return FRAMES.idle
}

function player(c: Canvas, g: Game, cam: number): void {
  const p = g.player
  if (g.mode === 'dead' && g.frame % 4 < 2) return
  if (p.invuln > 0 && p.act !== 'hurt' && g.frame % 4 < 2) return
  const tint = p.act === 'hurt' && g.frame % 2 === 0 ? WHITE : undefined
  const dir = g.mode === 'holdUp' ? 1 : p.dir
  sprite(c, playerFrame(g), Math.round(p.x - cam), GROUND - Math.round(p.z), { dir, tint, mirrorW: BODY_W })
}

function enemySprite(e: Enemy, frame: number): readonly string[] {
  if (e.kind === 'bat') return Math.floor(frame / 3) % 2 ? BAT_DOWN : BAT_UP
  if (e.kind === 'slime') return SLIME
  if (e.kind === 'slimeSmall') return SLIME_SMALL
  return Math.floor(e.t / 4) % 2 ? [...BUG.slice(0, 6), BUG[7], BUG[6]] : BUG
}

const ENEMY_COLORS: Record<string, Colors> = {
  hopper: { X: 0xe0892a, x: 0x9a5414 },
  bat: { X: 0x5a3f8a, x: 0x3a2860 },
}

function enemies(c: Canvas, g: Game, cam: number): void {
  for (const e of g.enemies) {
    if (e.x + 20 < cam || e.x > cam + c.w) continue
    sprite(c, enemySprite(e, g.frame), Math.round(e.x - cam), GROUND - Math.round(e.z),
      { dir: -e.dir as -1 | 1, colors: ENEMY_COLORS[e.kind], tint: e.flash > 0 && e.flash % 2 ? WHITE : undefined })
  }
}

function king(c: Canvas, g: Game, cam: number): void {
  const k = g.king
  if (k.hp <= 0 && g.mode !== 'kingDying') return
  if (g.mode === 'kingDying' && g.modeT % 4 < 2) return
  const windup = k.state === 'windup' && g.frame % 2 === 0
  const shake = windup ? (g.frame % 4 < 2 ? -1 : 1) : 0
  const colors: Colors = k.state === 'charge' ? { X: 0xc8344a, x: 0x7a1a2a } : {}
  sprite(c, KING, Math.round(k.x - cam) + shake, GROUND - Math.round(k.z),
    { dir: k.dir > 0 ? -1 : 1, colors, tint: k.flash % 2 || windup ? WHITE : undefined })
  if (k.state === 'stunned') {
    for (let i = 0; i < 3; i++) {
      const a = g.frame / 3 + (i * Math.PI * 2) / 3
      dot(c, k.x - cam + KING_W / 2 + Math.cos(a) * 6, GROUND - KING_H - 2 + Math.sin(a) * 1.5, 0xffd166)
    }
  }
}

function gate(c: Canvas, g: Game, cam: number): void {
  const shut = g.king.state !== 'sleep' || g.mode === 'bossIntro'
  const lift = shut ? Math.max(0, 12 - g.modeT) : 12
  const x = ARENA_L - 4 - cam
  for (let bar = 0; bar < 4; bar += 2) {
    for (let y = 2; y < GROUND - lift; y++) dot(c, x + bar, y, bar === 0 ? 0x9a94a8 : 0x6a6478)
  }
  for (let i = -2; i < 6; i++) dot(c, x + i, 2, 0x4a4456)
}

function things(c: Canvas, g: Game, cam: number): void {
  sprite(c, SIGN, SIGN_X - cam, GROUND)
  for (const b of g.bushes) if (b.alive) sprite(c, BUSH, b.x - cam, GROUND - groundAt(b.x + 3))
  for (const it of g.pickups) {
    if (it.t > 12 * FPS && g.frame % 4 < 2) continue
    sprite(c, it.kind === 'heart' ? HEART : RUPEE, Math.round(it.x - cam), GROUND - Math.round(it.z))
  }
}

function triforce(c: Canvas, g: Game, cam: number): void {
  if (!g.tri) return
  const x = Math.round(g.tri.x - cam - 7)
  const bottom = GROUND - Math.round(g.tri.z)
  const bob = g.mode === 'triforce' ? Math.round(Math.sin(g.frame / 4)) : 0
  if (g.mode === 'holdUp') rays(c, g, x + 7, bottom - 4)
  sprite(c, TRIFORCE, x, bottom + bob, { colors: TRIFORCE_COLORS, tint: g.frame % 10 === 0 ? 0xfffbe0 : undefined })
}

// Light pours out of the raised triangle
function rays(c: Canvas, g: Game, cx: number, cy: number): void {
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 + g.frame / 20
    const from = 9 + ((g.frame + i * 3) % 8)
    for (let r = from; r < from + 4; r++) dot(c, cx + Math.cos(a) * r * 1.6, cy + Math.sin(a) * r, i % 2 ? 0xfff6b0 : 0xf7d23e)
  }
}

function fairy(c: Canvas, g: Game, cam: number): void {
  if (g.fairy <= 0) return
  const p = g.player
  const x = p.x - cam + 8 + Math.cos(g.frame / 5) * 11
  const y = GROUND - p.z - PLAYER_H - 2 + Math.sin(g.frame / 3) * 2
  const wings = g.frame % 4 < 2 ? FAIRY : [FAIRY[1], FAIRY[0], FAIRY[2], FAIRY[3]]
  sprite(c, wings, Math.round(x), Math.round(y))
}

function particles(c: Canvas, g: Game, cam: number): void {
  for (const q of g.particles) dot(c, q.x - cam, q.y, q.color)
}

function hud(c: Canvas, g: Game): void {
  for (let i = 0; i < MAX_HEARTS; i++) sprite(c, i < g.player.hearts ? HEART : HEART_EMPTY, 1 + i * 6, 5)
  if (g.king.state !== 'sleep' && g.king.hp > 0) {
    const w = Math.min(40, c.w - 60)
    const x0 = Math.floor((c.w - w) / 2)
    for (let i = 0; i < w; i++) {
      const filled = i < (w * g.king.hp) / 12
      dot(c, x0 + i, 4, filled ? 0xd83a2a : 0x3a2a3a)
      dot(c, x0 + i, 5, filled ? 0x8a1c10 : 0x2a1a2a)
    }
  }
}

// ---- Frames ----
// Draws on a canvas `w` by `h` pixels. The play scene is 24 pixels tall and sits on
// the bottom edge: a short canvas crops the sky, a tall one leaves room above.
export function drawPixels(g: Game, w: number, h: number): Canvas {
  const c = canvas(w, h)
  if (g.mode === 'title' || g.mode === 'ending') {
    menuScreen(c, g)
    return c
  }
  const scene = canvas(w, h, h - SCENE_H + Math.round(g.camY))
  const cam = Math.round(g.cam) + (g.shake > 0 ? (g.frame % 2 ? 1 : -1) : 0)
  world(scene, g, cam)
  gate(scene, g, cam)
  things(scene, g, cam)
  enemies(scene, g, cam)
  king(scene, g, cam)
  player(scene, g, cam)
  triforce(scene, g, cam)
  fairy(scene, g, cam)
  particles(scene, g, cam)
  if (g.mode !== 'holdUp') hud({ ...scene, oy: 0 }, g) // the HUD keeps to the top edge
  if (g.paused) pausedOverlay({ ...scene, oy: 0 }, g)
  return scene
}

// The scene sinks into shadow; the game waits for a click or a key
function pausedOverlay(c: Canvas, g: Game): void {
  for (let i = 0; i < c.px.length; i++) if (c.px[i] !== DEFAULT) c.px[i] = mix(c.px[i]!, BLACK, 0.6)
  const plot: Plot = (x, y, color) => dot(c, x, y, color)
  const mid = Math.floor(c.h / 2) - 4 // below the row a fairy's message takes
  centerSmall(c, plot, 'PAUSED', mid, RED)
  if (g.frame % 24 < 17) centerSmall(c, plot, 'CLICK TO PLAY', mid + 7, DIM)
}

const BLACK = 0x000000

// The title and the ending: the logo on black, a line of small caps under it
function menuScreen(c: Canvas, g: Game): void {
  c.px.fill(BLACK)
  const plot: Plot = (x, y, color) => dot(c, x, y, color)
  // Logo, a pixel of air, a line of small caps: centred, a row of black above and below
  const top = Math.max(0, Math.floor((c.h - LOGO_H - 6) / 2))
  drawLogo(plot, Math.floor((c.w - LOGO_W) / 2), top)
  const line = top + LOGO_H + 1
  if (g.mode === 'title') {
    if (g.frame % 24 < 17) centerSmall(c, plot, 'CLICK TO PLAY', line, RED)
    return
  }
  if (g.modeT < ENDING_READY) return
  const options = ['PLAY AGAIN', 'QUIT'].map((label, i) => (i === g.menu ? '>' : ' ') + label)
  const gap = 8
  const widths = options.map(smallWidth)
  let x = Math.floor((c.w - widths[0] - gap - widths[1]) / 2)
  options.forEach((label, i) => {
    drawSmall(plot, label, x, line, i === g.menu ? RED : DIM)
    x += widths[i] + gap
  })
}

function centerSmall(c: Canvas, plot: Plot, text: string, y: number, colors: Shade): void {
  drawSmall(plot, text, Math.floor((c.w - smallWidth(text)) / 2), y, colors)
}

// ---- Cells ----
// Each cell holds two pixels stacked. Most terminals draw block glyphs themselves, so
// '▀' in the upper pixel's color over the lower one's background splits the cell
// exactly. Apple's Terminal takes them from the font, sized to the font rather than
// the line: there '▀' covers 41% of the cell, and the lower 5/8 block '▅' about half.
export type Cells = { columns: number; rows: number; cp: Uint32Array; fg: Uint32Array; bg: Uint32Array; apple: boolean }

const LOWER_FIVE_EIGHTHS = 0x2585 // ▅

function toCells(c: Canvas, columns: number, rows: number, apple: boolean): Cells {
  const n = columns * rows
  const cells: Cells = { columns, rows, cp: new Uint32Array(n), fg: new Uint32Array(n), bg: new Uint32Array(n), apple }
  for (let r = 0; r < rows; r++) {
    for (let x = 0; x < columns; x++) {
      const i = r * columns + x
      const up = c.px[2 * r * c.w + x], lo = c.px[(2 * r + 1) * c.w + x]
      if (up === lo) { cells.cp[i] = SPACE; cells.fg[i] = DEFAULT; cells.bg[i] = up }
      else if (apple) { cells.cp[i] = LOWER_FIVE_EIGHTHS; cells.fg[i] = lo; cells.bg[i] = up }
      else { cells.cp[i] = UPPER; cells.fg[i] = up; cells.bg[i] = lo }
    }
  }
  return cells
}

// Writes text at a pixel position; each letter sits on the color it covers
function text(cells: Cells, px: number, py: number, s: string, fg: number, bg?: number): void {
  const row = Math.floor(py / 2)
  if (row < 0 || row >= cells.rows) return
  ;[...s].forEach((ch, i) => {
    const x = px + i
    if (x < 0 || x >= cells.columns) return
    const k = row * cells.columns + x
    const under = cells.cp[k] === UPPER ? cells.fg[k] : cells.bg[k]
    cells.cp[k] = ch.codePointAt(0) ?? SPACE
    cells.fg[k] = fg
    cells.bg[k] = bg ?? under
  })
}

export function drawCells(g: Game, columns: number, rows: number, apple = false): Cells {
  const w = columns, h = rows * 2
  const cells = toCells(drawPixels(g, w, h), columns, rows, apple)
  if (g.mode === 'title' || g.mode === 'ending') return cells
  const sky = h - SCENE_H + 6 // a row of sky under the HUD
  if (g.bubble) bubble(cells, g, Math.max(6, sky), w)
  else if (g.mode === 'play' && g.stats.frames < HINT_FRAMES) {
    const hint = TEXTS.hint
    text(cells, Math.max(0, Math.floor((w - [...hint].length) / 2)), Math.max(6, sky), hint, WHITE)
  }
  return cells
}

function bubble(cells: Cells, g: Game, py: number, w: number): void {
  const s = ` ${g.bubble!.text} `
  const len = [...s].length
  const center = g.mode === 'holdUp' ? w / 2 : g.player.x - g.cam + 8
  const px = Math.round(Math.max(0, Math.min(w - len, center - len / 2)))
  text(cells, px, py, s, 0x1e2a1a, g.mode === 'holdUp' ? 0xfff6b0 : 0xf4f1dc)
}

export function hex(color: number): string | undefined {
  return color === DEFAULT ? undefined : `#${color.toString(16).padStart(6, '0')}`
}
