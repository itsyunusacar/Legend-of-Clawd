// Legend of Claude — the game. Plain data and pure-ish functions: `step` advances one
// frame, `press` feeds a key. No `$` and no drawing here.

import { LEVEL_W, ARENA_L, KING_X, ENEMIES, BUSHES, floorUnder, checkpointFor, zoneAt, type EnemyKind } from './level.ts'
import { BUG, BAT_UP, SLIME, SLIME_SMALL, KING } from './sprites.js'

export const FPS = 20
export const SCENE_H = 26
export const GROUND = 23 // first grass row; feet stand on the row above
export const PLAYER_W = 16
export const PLAYER_H = 12
export const MAX_HEARTS = 5
export const BODY_L = 3
export const BODY_R = 13
const SPEED = 1.4
const JUMP = 3.6
const GRAVITY = 0.42
const HOLD = 9 // frames a key press keeps walking: covers the keyboard's repeat delay
const SLASH_FRAMES = 6
const SLASH_REACH = 15
const GUARD_FRAMES = 10
const HURT_FRAMES = 7
const INVULN = 30
const KING_HP = 12
export const IDLE_PAUSE = 6 * FPS // no keys this long and the game waits for you
export const HINT_FRAMES = 3 * FPS // the controls show this long once a run starts
export const ENDING_READY = FPS // the ending's menu shows, and takes keys, after a second

export type Key = 'left' | 'right' | 'jump' | 'slash' | 'guard' | 'start'
export type Mode = 'title' | 'play' | 'bossIntro' | 'boss' | 'kingDying' | 'triforce' | 'holdUp' | 'ending' | 'dead'
export type Act = 'idle' | 'slash' | 'guard' | 'hurt'
export type Kind = EnemyKind | 'slimeSmall'

export type Enemy = {
  kind: Kind; x: number; z: number; vz: number; vx: number; dir: number
  hp: number; t: number; flash: number; stun: number
}

export type King = {
  x: number; z: number; vz: number; dir: number; hp: number
  state: 'sleep' | 'walk' | 'windup' | 'charge' | 'stunned' | 'jump'
  t: number; flash: number; cycle: number; summoned: boolean
}

export type Pickup = { kind: 'rupee' | 'heart'; x: number; z: number; vz: number; t: number }
export type Particle = { x: number; y: number; vx: number; vy: number; color: number; life: number; gravity: number }

export type Game = {
  w: number
  frame: number
  seed: number
  mode: Mode
  modeT: number
  cam: number
  camY: number // how far the view has risen to keep a high jump in frame
  shake: number
  player: { x: number; z: number; vz: number; dir: number; act: Act; actT: number; invuln: number; hearts: number; walking: boolean }
  input: { dir: number; hold: number }
  enemies: Enemy[]
  bushes: { x: number; alive: boolean }[]
  king: King
  pickups: Pickup[]
  particles: Particle[]
  tri: { x: number; z: number } | null
  bubble: { text: string; t: number } | null
  fairy: number
  stats: { frames: number; kills: number; rupees: number; deaths: number }
  menu: number // the ending's choice: 0 play again, 1 quit
  paused: boolean
  idle: number // frames since the last key, while playing
  quit: boolean
  best: number | null // fastest clear, in frames
}

// ---- Randomness kept in the state, so a run replays exactly in tests ----
export function rand(g: Game): number {
  g.seed = (g.seed + 0x6d2b79f5) | 0
  let t = g.seed
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

export function size(kind: Kind): { w: number; h: number } {
  const s = SPRITE_OF[kind]
  return { w: s[0].length, h: s.length }
}

const SPRITE_OF: Record<Kind, string[]> = { bug: BUG, hopper: BUG, bat: BAT_UP, slime: SLIME, slimeSmall: SLIME_SMALL }
const HP_OF: Record<Kind, number> = { bug: 1, hopper: 1, bat: 1, slime: 2, slimeSmall: 1 }
export const KING_W = KING[0].length
export const KING_H = KING.length

export function newGame(w: number, seed = 1, best: number | null = null): Game {
  return {
    w, frame: 0, seed, mode: 'title', modeT: 0, cam: 0, camY: 0, shake: 0,
    player: { x: 12, z: 0, vz: 0, dir: 1, act: 'idle', actT: 0, invuln: 0, hearts: MAX_HEARTS, walking: false },
    input: { dir: 0, hold: 0 },
    enemies: ENEMIES.map((e) => spawn(e.kind, e.x)),
    bushes: BUSHES.map((x) => ({ x, alive: true })),
    king: { x: KING_X, z: 0, vz: 0, dir: -1, hp: KING_HP, state: 'sleep', t: 0, flash: 0, cycle: 0, summoned: false },
    pickups: [], particles: [], tri: null, bubble: null, fairy: 0,
    stats: { frames: 0, kills: 0, rupees: 0, deaths: 0 },
    menu: 0, quit: false, paused: false, idle: 0,
    best,
  }
}

function spawn(kind: Kind, x: number): Enemy {
  return { kind, x, z: kind === 'bat' ? 12 : 0, vz: 0, vx: 0, dir: -1, hp: HP_OF[kind], t: 0, flash: 0, stun: 0 }
}

function setMode(g: Game, mode: Mode): void {
  g.mode = mode
  g.modeT = 0
}

export function say(g: Game, text: string, frames = 3 * FPS): void {
  g.bubble = { text, t: frames }
}

// ---- Input ----
export function press(g: Game, key: Key): void {
  if (g.mode === 'title') {
    if (key === 'start' || key === 'jump') setMode(g, 'play')
    return
  }
  if (g.mode === 'ending') {
    if (g.modeT < ENDING_READY) return
    if (key === 'left' || key === 'right') g.menu = g.menu === 0 ? 1 : 0
    else if (key === 'start' || key === 'slash' || key === 'jump') {
      if (g.menu === 1) g.quit = true
      else {
        Object.assign(g, newGame(g.w, g.seed, g.best))
        setMode(g, 'play')
      }
    }
    return
  }
  if (g.paused) resume(g)
  g.idle = 0
  if (!controllable(g)) return
  const p = g.player
  if (key === 'left' || key === 'right') {
    const dir = key === 'left' ? -1 : 1
    g.input = { dir, hold: HOLD }
    if (p.act !== 'slash') p.dir = dir
  } else if (key === 'jump') {
    if (onFloor(g)) p.vz = JUMP
  } else if (key === 'slash') {
    if (p.act !== 'slash' && p.act !== 'hurt') act(g, 'slash')
  } else if (key === 'guard') {
    if (p.act !== 'hurt') act(g, 'guard')
  }
}

function controllable(g: Game): boolean {
  return g.mode === 'play' || g.mode === 'boss'
}

function act(g: Game, a: Act): void {
  g.player.act = a
  g.player.actT = 0
}

// Claude finished its turn: a fairy flies in to tell you
// A fairy flies in with news from Claude: done, or waiting on you
export function fairySays(g: Game, text: string): void {
  g.fairy = 4 * FPS
  say(g, text, 4 * FPS)
}

// Holds the game while you are away from it: only a run in progress pauses
export function pause(g: Game): void {
  if (g.mode === 'play' || g.mode === 'boss') g.paused = true
}

export function resume(g: Game): void {
  g.paused = false
  g.idle = 0
}

// ---- One frame ----
export function step(g: Game): void {
  g.frame += 1
  if (g.bubble && g.paused && --g.bubble.t <= 0) g.bubble = null
  if (g.paused) return
  if (controllable(g) && ++g.idle >= IDLE_PAUSE) {
    pause(g)
    return
  }
  g.modeT += 1
  g.shake = Math.max(0, g.shake - 1)
  g.fairy = Math.max(0, g.fairy - 1)
  if (g.bubble && --g.bubble.t <= 0) g.bubble = null
  stepParticles(g)
  if (g.mode === 'title' || g.mode === 'ending') return
  if (g.mode !== 'triforce' && g.mode !== 'holdUp') g.stats.frames += 1

  if (g.mode === 'dead') {
    if (g.modeT >= 2 * FPS) respawn(g)
    return
  }
  stepPlayer(g)
  if (g.mode === 'play' || g.mode === 'boss' || g.mode === 'bossIntro') {
    for (const e of g.enemies) if (near(g, e.x, 40)) stepEnemy(g, e)
    stepKing(g)
    combat(g)
    g.enemies = g.enemies.filter((e) => e.hp > 0)
  }
  stepPickups(g)
  scenes(g)
  camera(g)
  if (g.player.hearts <= 0) die(g)
}

function near(g: Game, x: number, margin: number): boolean {
  return x > g.cam - margin && x < g.cam + g.w + margin
}

// ---- The hero ----
function bodyL(g: Game, x = g.player.x): number { return x + BODY_L }
function bodyR(g: Game, x = g.player.x): number { return x + BODY_R }

export function onFloor(g: Game): boolean {
  const p = g.player
  return p.vz === 0 && p.z <= floorUnder(bodyL(g), bodyR(g))
}

function minX(g: Game): number {
  return g.mode === 'play' || g.mode === 'dead' ? 0 : ARENA_L
}

function stepPlayer(g: Game): void {
  const p = g.player
  p.actT += 1
  p.invuln = Math.max(0, p.invuln - 1)
  if (p.act === 'slash' && p.actT >= SLASH_FRAMES) act(g, 'idle')
  if (p.act === 'guard' && p.actT >= GUARD_FRAMES) act(g, 'idle')
  if (p.act === 'hurt' && p.actT >= HURT_FRAMES) act(g, 'idle')

  const scripted = g.mode === 'triforce' && g.tri && g.modeT > 50
  let dir = 0
  if (scripted) dir = Math.sign(g.tri!.x - (p.x + 8))
  else if (controllable(g) && g.input.hold > 0) dir = g.input.dir
  g.input.hold = Math.max(0, g.input.hold - 1)
  p.walking = dir !== 0 && p.act !== 'guard' && p.act !== 'hurt'
  if (p.walking) {
    if (p.act !== 'slash') p.dir = dir
    move(g, dir * SPEED)
  }
  const floor = floorUnder(bodyL(g), bodyR(g))
  if (p.z > floor || p.vz > 0) {
    p.z += p.vz
    p.vz -= GRAVITY
    if (p.z <= floor) { p.z = floor; p.vz = 0 }
  } else p.z = floor
}

function move(g: Game, dx: number): boolean {
  const p = g.player
  const nx = Math.max(minX(g), Math.min(LEVEL_W - PLAYER_W, p.x + dx))
  if (floorUnder(bodyL(g, nx), bodyR(g, nx)) > p.z + 1) return false
  p.x = nx
  return true
}

// ---- Enemies ----
function stepEnemy(g: Game, e: Enemy): void {
  const p = g.player
  e.t += 1
  e.flash = Math.max(0, e.flash - 1)
  const { w } = size(e.kind)
  const toward = Math.sign(p.x + 8 - (e.x + w / 2)) || -1
  if (e.stun > 0) {
    e.stun -= 1
    walk(e, e.vx)
    e.vx *= 0.7
  } else if (e.kind === 'bug') {
    e.dir = toward
    walk(e, toward * 0.45)
  } else if (e.kind === 'hopper') {
    if (e.z <= floorUnder(e.x, e.x + w) && e.vz === 0 && e.t % 26 === 0) { e.vz = 3.2; e.dir = toward }
    if (e.vz !== 0 || e.z > floorUnder(e.x, e.x + w)) walk(e, e.dir * 1.1)
  } else if (e.kind === 'slime' || e.kind === 'slimeSmall') {
    e.dir = toward
    walk(e, toward * (e.kind === 'slime' ? 0.3 : 0.65))
  } else if (e.kind === 'bat') {
    const dx = Math.abs(p.x + 8 - (e.x + w / 2))
    const target = dx < 36 ? p.z + 6 : 13 + Math.sin(e.t / 6) * 3
    e.z += Math.sign(target - e.z) * 0.6
    e.x += toward * (dx < 60 ? 0.75 : 0.2)
    e.dir = toward
    return
  }
  const floor = floorUnder(e.x + 1, e.x + w - 1)
  if (e.z > floor || e.vz > 0) {
    e.z += e.vz
    e.vz -= 0.4
    if (e.z <= floor) { e.z = floor; e.vz = 0 }
  } else e.z = floor
}

// Walkers climb no walls: a step taller than a pixel stops them
function walk(e: Enemy, dx: number): void {
  const { w } = size(e.kind)
  const nx = e.x + dx
  if (floorUnder(nx + 1, nx + w - 1) > e.z + 1) return
  e.x = Math.max(0, Math.min(LEVEL_W - w, nx))
}

// ---- The Bug King ----
function stepKing(g: Game): void {
  const k = g.king
  if (k.state === 'sleep' || k.hp <= 0) return
  k.t += 1
  k.flash = Math.max(0, k.flash - 1)
  const p = g.player
  const center = k.x + KING_W / 2
  const toward = Math.sign(p.x + 8 - center) || -1
  const left = ARENA_L + 2, right = LEVEL_W - KING_W - 2
  if (k.state === 'walk') {
    k.dir = toward
    k.x = clamp(k.x + toward * 0.5, left, right)
    if (k.t > 45) next(g, k.cycle % 3 === 2 ? 'jump' : 'windup')
  } else if (k.state === 'windup') {
    k.dir = toward
    if (k.t > 14) next(g, 'charge')
  } else if (k.state === 'charge') {
    k.x += k.dir * 2.6
    if (k.x <= left || k.x >= right) {
      k.x = clamp(k.x, left, right)
      g.shake = 8
      burst(g, k.dir > 0 ? k.x + KING_W : k.x, GROUND - 4, [0xc8b090, 0x8a7a60, 0xffffff], 14, 1.6)
      next(g, 'stunned')
    }
  } else if (k.state === 'stunned') {
    if (k.t > 36) next(g, 'walk')
  } else if (k.state === 'jump') {
    if (k.t === 1) { k.vz = 4.2; k.dir = toward }
    k.x = clamp(k.x + k.dir * 1.3, left, right)
    k.z += k.vz
    k.vz -= 0.3
    if (k.z <= 0 && k.t > 2) {
      k.z = 0
      g.shake = 10
      burst(g, center, GROUND - 1, [0xc8b090, 0x8a7a60], 20, 2)
      if (onFloor(g) && Math.abs(p.x + 8 - center) < 40) hurt(g, toward)
      next(g, 'walk')
    }
  }
  if (!k.summoned && k.hp <= KING_HP / 2) {
    k.summoned = true
    g.enemies.push(spawn('bug', ARENA_L + 4), spawn('bat', LEVEL_W - 20))
  }
}

function next(g: Game, state: King['state']): void {
  g.king.state = state
  g.king.t = 0
  if (state === 'walk') g.king.cycle += 1
}

// ---- Combat ----
type Box = { l: number; r: number; lo: number; hi: number }

function overlap(a: Box, b: Box): boolean {
  return a.l < b.r && b.l < a.r && a.lo < b.hi && b.lo < a.hi
}

export function playerBox(g: Game): Box {
  const p = g.player
  return { l: bodyL(g), r: bodyR(g), lo: p.z, hi: p.z + PLAYER_H - 2 }
}

export function swordBox(g: Game): Box {
  const p = g.player
  // Starts inside the body, so something pressed right up against you is still hit
  const l = p.dir > 0 ? bodyR(g) - 5 : bodyL(g) + 5 - SLASH_REACH
  return { l, r: l + SLASH_REACH, lo: p.z - 5, hi: p.z + PLAYER_H }
}

function enemyBox(e: Enemy): Box {
  const { w, h } = size(e.kind)
  return { l: e.x + 1, r: e.x + w - 1, lo: e.z, hi: e.z + h - 1 }
}

function kingBox(g: Game): Box {
  const k = g.king
  return { l: k.x + 1, r: k.x + KING_W - 1, lo: k.z, hi: k.z + KING_H - 3 }
}

function combat(g: Game): void {
  const p = g.player
  const slashing = p.act === 'slash' && p.actT >= 1 && p.actT <= 3
  const sword = swordBox(g)
  const body = playerBox(g)

  if (slashing) {
    for (const b of g.bushes) {
      if (b.alive && overlap(sword, { l: b.x, r: b.x + 8, lo: floorUnder(b.x, b.x + 8), hi: floorUnder(b.x, b.x + 8) + 6 })) cutBush(g, b)
    }
  }
  for (const e of g.enemies) {
    const box = enemyBox(e)
    if (slashing && e.flash === 0 && overlap(sword, box)) hit(g, e, p.dir)
    if (e.hp <= 0 || e.flash > 0 || !overlap(body, box)) continue
    const side = Math.sign(e.x + size(e.kind).w / 2 - (p.x + 8)) || 1
    if (p.act === 'guard' && side === p.dir) {
      e.vx = side * 3
      e.stun = 8
      sparks(g, side > 0 ? bodyR(g) + 1 : bodyL(g) - 1, GROUND - p.z - 6)
    } else hurt(g, side)
  }

  const k = g.king
  if (k.state === 'sleep' || k.hp <= 0) return
  const kb = kingBox(g)
  if (slashing && k.flash === 0 && overlap(sword, kb)) {
    k.hp -= k.state === 'stunned' ? 2 : 1
    k.flash = 8
    sparks(g, p.dir > 0 ? kb.l : kb.r, GROUND - k.z - 7)
    if (k.hp <= 0) killKing(g)
  }
  if (k.hp > 0 && overlap(body, kb)) {
    const side = Math.sign(k.x + KING_W / 2 - (p.x + 8)) || 1
    if (p.act === 'guard' && side === p.dir) {
      move(g, -side * 4)
      sparks(g, side > 0 ? bodyR(g) + 1 : bodyL(g) - 1, GROUND - p.z - 6)
      if (k.state === 'charge') { g.shake = 6; next(g, 'stunned') }
    } else {
      hurt(g, side)
      move(g, -side * 8)
    }
  }
}

function hit(g: Game, e: Enemy, dir: number): void {
  e.hp -= 1
  e.flash = 5
  e.vx = dir * 2.5
  e.stun = 6
  const { w, h } = size(e.kind)
  sparks(g, e.x + w / 2, GROUND - e.z - h / 2)
  if (e.hp > 0) {
    if (e.kind === 'slime') split(g, e)
    return
  }
  g.stats.kills += 1
  burst(g, e.x + w / 2, GROUND - e.z - h / 2, [0xffffff, 0xdddddd, e.kind.startsWith('slime') ? 0x5fd8c8 : 0x9b3fc4], 12, 1.4)
  const r = rand(g)
  if (r < 0.15 && g.player.hearts < MAX_HEARTS) drop(g, 'heart', e.x + 2, e.z + 3)
  else if (r < 0.75) drop(g, 'rupee', e.x + 2, e.z + 3)
}

// A slime hit once splits in two
function split(g: Game, e: Enemy): void {
  e.kind = 'slimeSmall'
  e.hp = 1
  const twin = spawn('slimeSmall', e.x - 5)
  twin.vx = -2
  twin.stun = 6
  twin.flash = 5 // the same swing must not cut the new half too
  twin.z = e.z
  g.enemies.push(twin)
}

function cutBush(g: Game, b: { x: number; alive: boolean }): void {
  b.alive = false
  const z = floorUnder(b.x, b.x + 8)
  burst(g, b.x + 4, GROUND - z - 3, [0x3fa34d, 0x74cc5c, 0x27783a], 12, 1.3)
  if (rand(g) < 0.8) drop(g, rand(g) < 0.2 && g.player.hearts < MAX_HEARTS ? 'heart' : 'rupee', b.x + 2, z + 2)
}

function hurt(g: Game, side: number): void {
  const p = g.player
  if (p.invuln > 0) return
  p.hearts -= 1
  p.invuln = INVULN
  p.vz = Math.max(p.vz, 1.6)
  act(g, 'hurt')
  move(g, -side * 5)
  g.shake = 4
}

function killKing(g: Game): void {
  g.stats.kills += 1
  g.enemies = []
  setMode(g, 'kingDying')
}

function die(g: Game): void {
  g.stats.deaths += 1
  setMode(g, 'dead')
}

function respawn(g: Game): void {
  const p = g.player
  const inArena = g.king.state !== 'sleep'
  p.x = checkpointFor(inArena ? LEVEL_W : p.x)
  p.z = floorUnder(bodyL(g), bodyR(g))
  p.vz = 0
  p.hearts = MAX_HEARTS
  p.invuln = INVULN * 2
  act(g, 'idle')
  // Nothing waits right on top of the checkpoint
  g.enemies = g.enemies.filter((e) => Math.abs(e.x - p.x) > 30)
  setMode(g, inArena ? 'boss' : 'play')
}

// ---- Scenes: the gate, the king's fall, the triangle, the pose ----
function scenes(g: Game): void {
  const p = g.player
  if (g.mode === 'play' && p.x > ARENA_L + 12) {
    setMode(g, 'bossIntro')
    g.shake = 6
  } else if (g.mode === 'bossIntro' && g.modeT > 30) {
    setMode(g, 'boss')
    next(g, 'walk')
  } else if (g.mode === 'kingDying') {
    const k = g.king
    if (g.modeT % 3 === 0) {
      burst(g, k.x + rand(g) * KING_W, GROUND - rand(g) * KING_H, [0xffffff, 0xffd166, 0xff7a1a, 0x9b3fc4], 10, 1.8)
      g.shake = 3
    }
    if (g.modeT > 40) {
      setMode(g, 'triforce')
      const center = clamp(k.x + KING_W / 2, ARENA_L + 30, LEVEL_W - 30)
      g.tri = { x: center, z: SCENE_H }
    }
  } else if (g.mode === 'triforce' && g.tri) {
    const floor = floorUnder(g.tri.x - 7, g.tri.x + 8)
    g.tri.z = Math.max(floor + 10, g.tri.z - 0.35)
    if (g.frame % 2 === 0) g.particles.push({ x: g.tri.x - 7 + rand(g) * 15, y: GROUND - g.tri.z + rand(g) * 8, vx: 0, vy: 0.2, color: 0xfff6b0, life: 12, gravity: 0 })
    if (Math.abs(p.x + 8 - g.tri.x) < 2 && g.tri.z <= floor + 10) {
      p.x = g.tri.x - 8
      p.dir = 1
      act(g, 'idle')
      setMode(g, 'holdUp')
    }
  } else if (g.mode === 'holdUp') {
    if (g.tri) g.tri.z = p.z + PLAYER_H + 1
    if (g.modeT > 4 * FPS + 10) {
      g.best = g.best === null ? g.stats.frames : Math.min(g.best, g.stats.frames)
      setMode(g, 'ending')
    }
  }
}

// Follows the hero; once the gate shuts it stays inside the arena
function camera(g: Game): void {
  const locked = g.mode !== 'play' && g.mode !== 'dead'
  const hi = Math.max(0, LEVEL_W - g.w)
  const lo = locked ? Math.min(ARENA_L - 6, hi) : 0
  const goal = clamp(g.player.x + 8 - g.w * 0.35, lo, hi)
  g.cam = locked ? g.cam + (goal - g.cam) * 0.2 : goal
  if (Math.abs(g.cam - goal) < 0.5) g.cam = goal
  // Rise with the hero (and the triangle held over his head) when they near the top
  const p = g.player
  const top = GROUND - PLAYER_H - p.z - (g.mode === 'holdUp' ? 9 : 0)
  const goalY = Math.max(0, 2 - top)
  g.camY += (goalY - g.camY) * 0.35
  if (Math.abs(g.camY - goalY) < 0.3) g.camY = goalY
}

// ---- Pickups and particles ----
function drop(g: Game, kind: Pickup['kind'], x: number, z: number): void {
  g.pickups.push({ kind, x, z, vz: 1.6, t: 0 })
}

function stepPickups(g: Game): void {
  const body = playerBox(g)
  g.pickups = g.pickups.filter((it) => {
    it.t += 1
    const floor = floorUnder(it.x, it.x + 4)
    if (it.z > floor || it.vz > 0) {
      it.z += it.vz
      it.vz -= 0.35
      if (it.z <= floor) { it.z = floor; it.vz = 0 }
    }
    if (overlap(body, { l: it.x, r: it.x + 4, lo: it.z, hi: it.z + 5 })) {
      if (it.kind === 'heart') g.player.hearts = Math.min(MAX_HEARTS, g.player.hearts + 1)
      else g.stats.rupees += 1
      return false
    }
    return it.t < 15 * FPS
  })
}

function stepParticles(g: Game): void {
  g.particles = g.particles.filter((q) => {
    q.x += q.vx
    q.y += q.vy
    q.vy += q.gravity
    return --q.life > 0 && q.y < SCENE_H
  })
}

function burst(g: Game, x: number, y: number, colors: number[], n: number, power: number): void {
  for (let i = 0; i < n; i++) {
    const a = rand(g) * Math.PI * 2
    const v = (0.5 + rand(g)) * power
    g.particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 0.8, color: colors[i % colors.length], life: 6 + Math.floor(rand(g) * 7), gravity: 0.3 })
  }
  if (g.particles.length > 160) g.particles.splice(0, g.particles.length - 160)
}

function sparks(g: Game, x: number, y: number): void {
  burst(g, x, y, [0xffffff, 0xffd166], 5, 1.2)
}

export function zoneName(g: Game): string {
  return zoneAt(g.player.x).name
}

export function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v))
}
