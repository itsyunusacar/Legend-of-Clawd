import { test, expect, describe, mock } from 'claude-code/testing'
import { newGame, step, press, fairySays, pause, swordBox, IDLE_PAUSE, FPS, MAX_HEARTS, KING_W, ENDING_READY, type Game } from '../hooks/game.ts'
import { ARENA_L, LEVEL_W, floorUnder } from '../hooks/level.ts'
import { drawCells } from '../hooks/draw.ts'
import { keyFor } from '../hooks/screen.ts'
import { TEXTS } from '../hooks/texts.ts'

const t = TEXTS

function playing(x = 12): Game {
  const g = newGame(120, 1)
  press(g, 'start')
  g.enemies = []
  g.player.x = x
  return g
}

function run(g: Game, frames: number) {
  for (let i = 0; i < frames; i++) step(g)
}

function hold(g: Game, key: 'left' | 'right', frames: number) {
  for (let i = 0; i < frames; i++) {
    if (i % 4 === 0) press(g, key)
    step(g)
  }
}

describe('moving', () => {
  test('the title waits for a key, then the run starts', async () => {
    const g = newGame(120)
    run(g, 10)
    expect(g.mode).toBe('title')
    press(g, 'start')
    expect(g.mode).toBe('play')
  })

  test('a key press keeps walking through the keyboard repeat delay', async () => {
    const g = playing()
    press(g, 'right')
    run(g, 8)
    expect(g.player.x > 12 + 8).toBe(true)
  })

  test('a two-block wall stops you; a jump gets you on top', async () => {
    const g = playing(296)
    hold(g, 'right', 20)
    expect(g.player.x < 312 - 13 + 1).toBe(true) // stopped at the taller part
    press(g, 'jump')
    hold(g, 'right', 30)
    expect(g.player.z).toBe(floorUnder(g.player.x + 3, g.player.x + 13))
    expect(g.player.z >= 4).toBe(true)
  })
})

describe('fighting', () => {
  test('the sword reaches the side you face and squashes a bug', async () => {
    const g = playing(100)
    g.player.dir = 1
    g.enemies = [{ kind: 'bug', x: 114, z: 0, vz: 0, vx: 0, dir: -1, hp: 1, t: 0, flash: 0, stun: 0 }]
    expect(swordBox(g).l > g.player.x).toBe(true)
    press(g, 'slash')
    run(g, 3)
    expect(g.enemies.length).toBe(0)
    expect(g.stats.kills).toBe(1)
  })

  test('a bug walking into you costs a heart; the shield turns it away', async () => {
    const hit = playing(100)
    hit.enemies = [{ kind: 'bug', x: 110, z: 0, vz: 0, vx: 0, dir: -1, hp: 1, t: 0, flash: 0, stun: 0 }]
    run(hit, 2)
    expect(hit.player.hearts).toBe(MAX_HEARTS - 1)

    const blocked = playing(100)
    blocked.player.dir = 1
    blocked.enemies = [{ kind: 'bug', x: 110, z: 0, vz: 0, vx: 0, dir: -1, hp: 1, t: 0, flash: 0, stun: 0 }]
    press(blocked, 'guard')
    run(blocked, 2)
    expect(blocked.player.hearts).toBe(MAX_HEARTS)
  })

  test('a slime splits in two when hit', async () => {
    const g = playing(100)
    g.player.dir = 1
    g.enemies = [{ kind: 'slime', x: 114, z: 0, vz: 0, vx: 0, dir: -1, hp: 2, t: 0, flash: 0, stun: 0 }]
    press(g, 'slash')
    run(g, 2)
    expect(g.enemies.filter((e) => e.kind === 'slimeSmall').length).toBe(2)
  })

  test('cutting a bush can drop something', async () => {
    const g = playing(76)
    g.player.dir = 1
    press(g, 'slash')
    run(g, 2)
    expect(g.bushes[0].alive).toBe(false)
  })

  test('losing every heart sends you back to the zone checkpoint', async () => {
    const g = playing(400)
    g.player.hearts = 1
    g.enemies = [{ kind: 'bug', x: 410, z: 4, vz: 0, vx: 0, dir: -1, hp: 1, t: 0, flash: 0, stun: 0 }]
    run(g, 3)
    expect(g.mode).toBe('dead')
    run(g, 2 * FPS + 1)
    expect(g.mode).toBe('play')
    expect(g.player.x).toBe(258)
    expect(g.player.hearts).toBe(MAX_HEARTS)
  })
})

describe('the Bug King', () => {
  test('walking into the arena shuts the gate and wakes him', async () => {
    const g = playing(ARENA_L + 10)
    hold(g, 'right', 6)
    expect(g.mode).toBe('bossIntro')
    run(g, 31)
    expect(g.mode).toBe('boss')
    hold(g, 'left', 40)
    expect(g.player.x >= ARENA_L).toBe(true)
  })

  test('a charge into the wall stuns him, and stunned he takes double', async () => {
    const g = playing(ARENA_L + 40)
    g.mode = 'boss'
    const k = g.king
    k.state = 'charge'
    k.dir = 1
    k.x = LEVEL_W - KING_W - 3
    run(g, 2)
    expect(k.state).toBe('stunned')
    g.player.x = k.x - 18
    g.player.dir = 1
    press(g, 'slash')
    run(g, 2)
    expect(k.hp).toBe(10)
  })

  test('his fall brings the golden triangle, the pose, then the ending', async () => {
    const g = playing(ARENA_L + 40)
    g.mode = 'boss'
    g.king.state = 'stunned'
    g.king.hp = 1
    g.king.x = g.player.x + 16
    g.player.dir = 1
    press(g, 'slash')
    run(g, 2)
    expect(g.mode).toBe('kingDying')
    const seen = new Set<string>()
    for (let i = 0; i < 40 * FPS && !seen.has('ending'); i++) { step(g); seen.add(g.mode) }
    expect([...seen]).toEqual(['kingDying', 'triforce', 'holdUp', 'ending'])
    expect(g.best).toBe(g.stats.frames)
    press(g, 'start')
    expect(g.mode).toBe('ending') // the menu shows after a moment
    run(g, ENDING_READY)
    press(g, 'right')
    expect(g.menu).toBe(1)
    press(g, 'left')
    press(g, 'start')
    expect(g.mode).toBe('play')
    expect(g.best).not.toBe(null)
  })
})

describe('screen', () => {
  test('choosing QUIT at the ending asks to close', async () => {
    const g = playing()
    g.mode = 'ending'
    g.modeT = ENDING_READY
    press(g, 'right')
    press(g, 'start')
    expect(g.quit).toBe(true)
  })

  test("Apple's Terminal gets the 5/8 block, lower pixel in front", async () => {
    const g = playing(100)
    run(g, 3)
    const c = drawCells(g, 90, 13, true)
    expect([...c.cp].includes(0x2585)).toBe(true)
    expect([...c.cp].includes(0x2580)).toBe(false)
  })

  test('jumping into the sky leaves no trail above the scene', async () => {
    const g = playing(100)
    g.player.z = 14 // the hat reaches past the top of a 24-pixel scene
    const c = drawCells(g, 90, 20)
    const hat = 0x3fa34d
    let rowsWithHat = 0
    for (let r = 0; r < 20; r++) if ([...c.fg.subarray(r * 90, r * 90 + 90), ...c.bg.subarray(r * 90, r * 90 + 90)].includes(hat)) rowsWithHat++
    expect(rowsWithHat <= 3).toBe(true)
  })

  test('Claude finishing brings the fairy with a message', async () => {
    const g = playing()
    fairySays(g, t.claudeDone)
    expect(g.fairy > 0).toBe(true)
    expect(g.bubble?.text).toBe(t.claudeDone)
  })

  test('a paused game holds still, and any key resumes it', async () => {
    const g = playing(100)
    g.enemies = [{ kind: 'bug', x: 140, z: 0, vz: 0, vx: 0, dir: -1, hp: 1, t: 0, flash: 0, stun: 0 }]
    pause(g)
    run(g, 40)
    expect(g.enemies[0]!.x).toBe(140)
    press(g, 'right')
    expect(g.paused).toBe(false)
    run(g, 5)
    expect(g.enemies[0]!.x < 140).toBe(true)
  })

  test('no keys for a while pauses a run, never the title', async () => {
    const g = playing(100)
    g.enemies = []
    run(g, IDLE_PAUSE)
    expect(g.paused).toBe(true)
    const title = newGame(120)
    run(title, IDLE_PAUSE + 5)
    expect(title.paused).toBe(false)
  })

  test('keys map to moves', async () => {
    expect(keyFor({ key: 'left' })).toBe('left')
    expect(keyFor({ key: 'Z' })).toBe('slash')
    expect(keyFor({ key: ' ' })).toBe('jump')
    expect(keyFor({ key: 'return' })).toBe('start')
    expect(keyFor({ key: 'q' })).toBe(undefined)
  })

  test('every scene draws into the band at any height', async () => {
    const g = playing(700)
    for (const rows of [4, 8, 12]) {
      run(g, 5)
      const c = drawCells(g, 90, rows)
      expect(c.cp.length).toBe(90 * rows)
    }
    g.mode = 'ending'
    g.modeT = 30
    expect(drawCells(g, 90, 12).cp.length).toBe(90 * 12)
  })
})

describe('the mod', () => {
  const BAND = { hasSurvey: false, isWorking: false, maxRows: 20, bodyColumns: 100, scroll: { offset: 0, bodyRows: 19 }, view: {} }
  const legend = { command: 'legend', args: '', origin: { kind: 'composer' as const }, presentation: { isFullscreen: false, columns: 100 } }

  test('/legend opens the game; a key starts it', async ($, on) => {
    mock.store(on)
    const opened = await $.command.run(legend)
    expect(opened.text).toContain('open')
    const ui = await $.ui.mount({ plugin: 'legend-of-clawd', surface: 'terminal', component: 'AbovePrompt', props: BAND })
    await ui.resize({ columns: 100, rows: 14 })
    // The title is all logo: the key hint shows once the game runs
    expect(await ui.find({ type: 'Text', text: /Z sword/, in: 'game' })).toBeUndefined()
    await ui.pointer({ type: 'down', x: 50, y: 5 }) // the click that focuses it starts it
    await ui.advance(200)
    expect(await ui.find({ type: 'Text', text: /Z sword/, in: 'game' })).toBeDefined()
    await ui.unmount()
    const closed = await $.command.run(legend)
    expect(closed.text).toContain('closed')
  })

  test('off the terminal it says where to play', async ($, on) => {
    mock.store(on)
    await $.command.run(legend)
    const ui = await $.ui.mount({ plugin: 'legend-of-clawd', surface: 'desktop', component: 'AbovePrompt', props: BAND })
    expect(await ui.find({ type: 'Text', text: /terminal/ })).toBeDefined()
    await ui.unmount()
    await $.command.run(legend)
  })
})
