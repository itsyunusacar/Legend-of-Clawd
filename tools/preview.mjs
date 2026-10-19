// Draws one frame of each scene into a PNG strip: node tools/preview.mjs out.png [columns]
// Text cells show as their background with a dot of the text color.
import { writeFileSync } from 'node:fs'
import { png } from './png.mjs'
import { newGame, step, press } from '../hooks/game.ts'
import { drawCells, DEFAULT } from '../hooks/draw.ts'
import { TEXTS } from '../hooks/texts.ts'

const [out = 'preview.png', width = '120'] = process.argv.slice(2)
const W = Number(width), ROWS = 13, SCALE = 5, BG = 0x1e1e24
const t = TEXTS

function at(x, frames, setup = () => {}) {
  const g = newGame(W, 3)
  press(g, 'start')
  g.player.x = x
  setup(g)
  for (let i = 0; i < frames; i++) step(g)
  return g
}

const scenes = [
  ['title', (() => { const g = newGame(W, 3); for (let i = 0; i < 10; i++) step(g); return g })()],
  ['meadow', at(100, 30, (g) => { press(g, 'slash') })],
  ['forest', at(330, 40)],
  ['paused', at(330, 40, (g) => { g.bubble = { text: 'Hey! Listen! Claude needs your OK.', t: 60 } }) ],
  ['cave', at(560, 40)],
  ['boss', at(800, 90)],
  ['charge', at(800, 152)],
  ['holdUp', at(800, 2, (g) => { g.king.hp = 0; g.mode = 'kingDying'; g.modeT = 39 })],
  ['ending', at(800, 1, (g) => { g.mode = 'ending'; g.modeT = 40 })],
]
// Let the triangle fall and the hero walk to it
const paused = scenes.find(([n]) => n === 'paused')[1]
paused.paused = true
const hold = scenes.find(([n]) => n === 'holdUp')[1]
for (let i = 0; i < 400 && hold.mode !== 'holdUp'; i++) step(hold)
for (let i = 0; i < 20; i++) step(hold)

const H = ROWS * 2, GAP = 2
const outW = W * SCALE, outH = scenes.length * (H + GAP) * SCALE
const px = new Uint32Array(outW * outH).fill(0x101014)
const put = (k, x, y, color) => {
  for (let dy = 0; dy < SCALE; dy++) {
    const s = ((k * (H + GAP) + y) * SCALE + dy) * outW + x * SCALE
    px.fill(color === DEFAULT ? BG : color, s, s + SCALE)
  }
}
scenes.forEach(([, g], k) => {
  const c = drawCells(g, W, ROWS)
  for (let r = 0; r < ROWS; r++) for (let x = 0; x < W; x++) {
    const i = r * W + x, cp = c.cp[i]
    if (cp === 0x2580) { put(k, x, 2 * r, c.fg[i]); put(k, x, 2 * r + 1, c.bg[i]) }
    else if (cp === 0x20) { put(k, x, 2 * r, c.bg[i]); put(k, x, 2 * r + 1, c.bg[i]) }
    else { put(k, x, 2 * r, c.bg[i]); put(k, x, 2 * r + 1, c.fg[i]) }
  }
})
writeFileSync(out, png(outW, outH, px))
console.log(scenes.map(([n, g]) => `${n}:${g.mode}`).join(' '))
