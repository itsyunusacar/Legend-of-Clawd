// Renders the 1280×640 cover (README banner, GitHub social preview): node tools/cover.mjs out.png
import { writeFileSync } from 'node:fs'
import { png } from './png.mjs'
import { newGame, step, press } from '../hooks/game.ts'
import { drawPixels, DEFAULT } from '../hooks/draw.ts'
import { drawLogo, drawSmall, smallWidth, LOGO_W, DIM } from '../hooks/logo.ts'

const W = 128, H = 64, SCALE = 10, HUD = 8 // HUD rows are drawn above the crop
const TAGLINE = 'PLAY WHILE CLAUDE WORKS'

// Clawd squares up to the Bug King in his arena
const g = newGame(W, 3)
press(g, 'start')
g.player.x = 800
for (let i = 0; i < 90; i++) step(g)
g.player.x = 838
g.king.x = 878
press(g, 'slash')
step(g)
g.cam = 806

const scene = drawPixels(g, W, H + HUD)
const px = new Uint32Array(W * H)
for (let i = 0; i < px.length; i++) {
  const c = scene.px[i + HUD * W]
  px[i] = c === DEFAULT ? 0x1e1e24 : c
}
// A few embers drifting up from the torches, kept clear of the title
for (let i = 0; i < 40; i++) {
  const x = (i * 53 + 17) % W, y = 2 + ((i * 29) % 34)
  if (x > 14 && x < W - 14 && y > 2 && y < 32) continue
  const c = px[y * W + x]
  px[y * W + x] = i % 3 ? mix(c, 0xffb347, 0.45) : mix(c, 0xffd166, 0.8)
}
const plot = (x, y, c) => { if (x >= 0 && x < W && y >= 0 && y < H) px[y * W + x] = c }
drawLogo(plot, Math.floor((W - LOGO_W) / 2), 5)
drawSmall(plot, TAGLINE, Math.floor((W - smallWidth(TAGLINE)) / 2), 24, DIM)

function mix(a, b, t) {
  const ch = (s) => Math.round(((a >> s) & 255) * (1 - t) + ((b >> s) & 255) * t) << s
  return ch(16) | ch(8) | ch(0)
}

const big = new Uint32Array(W * SCALE * H * SCALE)
for (let y = 0; y < H * SCALE; y++) for (let x = 0; x < W * SCALE; x++) big[y * W * SCALE + x] = px[Math.floor(y / SCALE) * W + Math.floor(x / SCALE)]
writeFileSync(process.argv[2] ?? 'cover.png', png(W * SCALE, H * SCALE, big))
console.log(`${g.mode} · cam ${g.cam.toFixed(0)} · player ${g.player.x.toFixed(0)} · king ${g.king.x.toFixed(0)} ${g.king.state}`)
