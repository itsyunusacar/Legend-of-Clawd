// Renders every sprite frame into an enlarged PNG sheet: node tools/sheet.mjs out.png
import { writeFileSync } from 'node:fs'
import { png } from './png.mjs'
import { FRAMES, PALETTE, BUG, FAIRY, SMITH_UP, SMITH_DOWN, ANVIL, SLIME, SLIME_SMALL, BOSS, HEART, RUPEE } from '../hooks/sprites.js'

const SCALE = 10
const PAD = 2 // pixels between cells
const BACKGROUNDS = [0xf4f1ea, 0x1e1e24] // light page, dark terminal

const cells = [
  ...FRAMES.walk.map((f, i) => [`walk ${i}`, f]),
  ['slash', FRAMES.slash],
  ['guard', FRAMES.guard],
  ['hurt', FRAMES.hurt],
  ['itemGet', FRAMES.itemGet],
  ['bug', BUG],
  ['fairy', FAIRY],
  ['smith up', SMITH_UP],
  ['smith down', SMITH_DOWN],
  ['anvil', ANVIL],
  ['slime', SLIME],
  ['slime small', SLIME_SMALL],
  ['boss', BOSS],
  ['heart', HEART],
  ['rupee', RUPEE],
]

const cellW = Math.max(...cells.map(([, f]) => Math.max(...f.map((r) => r.length)))) + PAD * 2
const cellH = Math.max(...cells.map(([, f]) => f.length)) + PAD * 2
const W = cellW * cells.length * SCALE
const H = cellH * BACKGROUNDS.length * SCALE
const px = new Uint32Array(W * H)

BACKGROUNDS.forEach((bg, row) => {
  px.fill(bg, row * cellH * SCALE * W, (row + 1) * cellH * SCALE * W)
  cells.forEach(([, frame], col) => {
    const ox = col * cellW + PAD
    const oy = row * cellH + cellH - PAD - frame.length // align feet
    frame.forEach((line, y) => [...line].forEach((ch, x) => {
      const c = PALETTE[ch]
      if (c === undefined) return
      for (let dy = 0; dy < SCALE; dy++) {
        const start = ((oy + y) * SCALE + dy) * W + (ox + x) * SCALE
        px.fill(c, start, start + SCALE)
      }
    }))
  })
})

writeFileSync(process.argv[2] || 'sheet.png', png(W, H, px))
console.log(cells.map(([n]) => n).join(' | '))
