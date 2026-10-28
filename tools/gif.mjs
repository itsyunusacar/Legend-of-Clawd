// Records the bot playing the level as an animated GIF (needs ffmpeg): node tools/gif.mjs out.gif [seed]
import { spawn } from 'node:child_process'
import { newGame, step, press, FPS, KING_W } from '../hooks/game.ts'
import { drawCells, DEFAULT } from '../hooks/draw.ts'

const [out = 'gameplay.gif', seed = '5'] = process.argv.slice(2)
const W = 120, ROWS = 13, SCALE = 5, BG = 0x1e1e24
const outW = W * SCALE, outH = ROWS * 2 * SCALE

const ff = spawn('ffmpeg', [
  '-y', '-loglevel', 'error',
  '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', `${outW}x${outH}`, '-r', String(FPS), '-i', '-',
  '-vf', 'split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=none',
  '-loop', '0', out,
], { stdio: ['pipe', 'inherit', 'inherit'] })

const frame = Buffer.alloc(outW * outH * 3)
const put = (x, y, color) => {
  const c = color === DEFAULT ? BG : color
  for (let dy = 0; dy < SCALE; dy++) for (let dx = 0; dx < SCALE; dx++) {
    const o = ((y * SCALE + dy) * outW + x * SCALE + dx) * 3
    frame[o] = c >> 16; frame[o + 1] = (c >> 8) & 255; frame[o + 2] = c & 255
  }
}
const record = (g) => {
  const c = drawCells(g, W, ROWS)
  for (let r = 0; r < ROWS; r++) for (let x = 0; x < W; x++) {
    const i = r * W + x, cp = c.cp[i]
    if (cp === 0x2580) { put(x, 2 * r, c.fg[i]); put(x, 2 * r + 1, c.bg[i]) }
    else if (cp === 0x20) { put(x, 2 * r, c.bg[i]); put(x, 2 * r + 1, c.bg[i]) }
    else { put(x, 2 * r, c.bg[i]); put(x, 2 * r + 1, c.fg[i]) }
  }
  ff.stdin.write(Buffer.from(frame))
}

// Same bot as tools/bot.mjs, with a beat on the title and the ending
const g = newGame(W, Number(seed))
for (let i = 0; i < 2 * FPS; i++) { step(g); record(g) }
press(g, 'start')
let last = 0, stuck = 0
for (let f = 0; f < 600 * FPS && g.mode !== 'ending'; f++) {
  const p = g.player
  const foes = g.enemies.map((e) => ({ x: e.x, w: 8 }))
  if (g.king.state !== 'sleep' && g.king.hp > 0) foes.push({ x: g.king.x, w: KING_W })
  const cx = p.x + 8
  const near = foes.find((e) => Math.abs(e.x + e.w / 2 - cx) < e.w / 2 + 14)
  if (near) {
    const dir = Math.sign(near.x + near.w / 2 - cx) || 1
    if (dir !== p.dir) press(g, dir > 0 ? 'right' : 'left')
    else if (f % 3 === 0) press(g, 'slash')
  } else if (f % 3 === 0) press(g, 'right')
  if (Math.abs(p.x - last) < 0.1 && !near) { if (++stuck > 3) { press(g, 'jump'); stuck = 0 } } else stuck = 0
  last = p.x
  step(g)
  record(g)
}
for (let i = 0; i < 3 * FPS; i++) { step(g); record(g) }
ff.stdin.end()
ff.on('close', (code) => console.log(code === 0 ? `${out} · ${(g.stats.frames / FPS).toFixed(1)}s` : `ffmpeg failed (${code})`))
