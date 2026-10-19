// Plays the level with a simple bot to check it can be finished: node tools/bot.mjs [seed]
import { newGame, step, press, FPS } from '../hooks/game.ts'
import { KING_W } from '../hooks/game.ts'

const g = newGame(120, Number(process.argv[2] ?? 5))
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
}
console.log(`${g.mode} in ${(g.stats.frames / FPS).toFixed(1)}s · kills ${g.stats.kills} · deaths ${g.stats.deaths} · rupees ${g.stats.rupees} · x ${g.player.x.toFixed(0)} · king ${g.king.hp}`)
