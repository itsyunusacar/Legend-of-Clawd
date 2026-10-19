// Renders the title logo alone, enlarged: node tools/logo.mjs out.png
import { writeFileSync } from 'node:fs'
import { png } from './png.mjs'
import { drawLogo, drawSmall, smallWidth, LOGO_W, LOGO_H } from '../hooks/logo.ts'

const W = 100, H = 22, S = 10
const px = new Uint32Array(W * H).fill(0x000000)
const plot = (x, y, c) => { if (x >= 0 && x < W && y >= 0 && y < H) px[y * W + x] = c }
drawLogo(plot, Math.floor((W - LOGO_W) / 2), 0)
drawSmall(plot, 'CLICK TO PLAY', Math.floor((W - smallWidth('CLICK TO PLAY')) / 2), LOGO_H)
const big = new Uint32Array(W * S * H * S)
for (let y = 0; y < H * S; y++) for (let x = 0; x < W * S; x++) big[y * W * S + x] = px[Math.floor(y / S) * W + Math.floor(x / S)]
writeFileSync(process.argv[2] ?? 'logo.png', png(W * S, H * S, big))
void LOGO_H
