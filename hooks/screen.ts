// Legend of Clawd — the surface module: the game runs here, on the drawing side,
// so keys land at once and every frame is drawn without a round trip to the hooks.

import type { ClientModule, ClientKeyEvent, RenderElement } from 'claude-code'
import { newGame, step, press, fairySays, pause, resume, FPS, type Game, type Key } from './game.ts'
import { drawCells, hex, DEFAULT, type Cells } from './draw.ts'
import { TEXTS } from './texts.ts'

// The counters tick up in the hooks module; a change is the news
export type ScreenProps = { best: number | null; apple: boolean; claudeDone: number; permission: number; typing: number }
export type ScreenMessage = { best: number } | { quit: true }

type Box = { g: Game; props: ScreenProps; seen: ScreenProps; postedBest: number | null; postedQuit: boolean }
type State = { box: Box; frame: number }

const KEYS: Record<string, Key> = {
  left: 'left', a: 'left', h: 'left',
  right: 'right', d: 'right', l: 'right',
  up: 'jump', w: 'jump', ' ': 'jump', space: 'jump',
  z: 'slash', j: 'slash',
  x: 'guard', k: 'guard',
  return: 'start', enter: 'start',
}

export function keyFor(ev: ClientKeyEvent): Key | undefined {
  return KEYS[ev.key.toLowerCase()] ?? KEYS[ev.key]
}

const Screen: ClientModule<ScreenProps, State> = (props, surface) => {
  const { Box: Column, Text } = surface.elements
  let box = surface.state?.box
  if (!box) {
    const fresh: Box = {
      g: newGame(Math.max(40, surface.columns || 100), Date.now() | 0, props.best),
      props, seen: props, postedBest: props.best, postedQuit: false,
    }
    box = fresh
    surface.every(Math.round(1000 / FPS), () => tick(fresh, surface.columns, surface.post, (s) => surface.setState(s)))
    surface.onKey((ev) => {
      const key = keyFor(ev)
      if (key) press(fresh.g, key)
    })
    // The click that gives the game the keyboard also starts or resumes it
    surface.onPointer((ev) => {
      if (ev.type !== 'down') return
      if (fresh.g.mode === 'title') press(fresh.g, 'start')
      else if (fresh.g.paused) resume(fresh.g)
    })
    surface.setState({ box: fresh, frame: 0 })
  }
  box.props = props
  const g = box.g
  const rows = Math.max(4, surface.rows || 11)
  const columns = Math.max(40, surface.columns || 100)
  const cells = drawCells(g, columns, rows, props.apple)
  return Column({ flexDirection: 'column', children: rowsOf(cells, Text) })
}

export default Screen

function tick(box: Box, columns: number, post: (data: ScreenMessage) => void, setState: (s: State) => void): void {
  const g = box.g
  if (columns > 0) g.w = Math.max(40, columns)
  const now = box.props, seen = box.seen
  if (now.claudeDone !== seen.claudeDone) fairySays(g, TEXTS.claudeDone)
  if (now.permission !== seen.permission) {
    pause(g) // the permission dialog has the keyboard now
    fairySays(g, TEXTS.permission)
  }
  if (now.typing !== seen.typing) pause(g)
  box.seen = now
  step(g)
  if (g.best !== null && g.best !== box.postedBest) {
    box.postedBest = g.best
    post({ best: g.best })
  }
  if (g.quit && !box.postedQuit) {
    box.postedQuit = true
    post({ quit: true })
  }
  setState({ box, frame: g.frame })
}

type TextFn = (props: { color?: string; backgroundColor?: string; wrap?: 'truncate'; children: (string | RenderElement)[] }) => RenderElement

// One Text per row, one nested Text per run of cells sharing both colors
export function rowsOf(cells: Cells, Text: TextFn): RenderElement[] {
  const rows: RenderElement[] = []
  for (let r = 0; r < cells.rows; r++) {
    const runs: RenderElement[] = []
    let start = r * cells.columns
    const end = start + cells.columns
    while (start < end) {
      const fg = cells.fg[start], bg = cells.bg[start]
      let s = ''
      let i = start
      while (i < end && cells.fg[i] === fg && cells.bg[i] === bg) s += String.fromCodePoint(cells.cp[i++])
      const style: { color?: string; backgroundColor?: string } = {}
      if (fg !== DEFAULT) style.color = hex(fg)
      if (bg !== DEFAULT) style.backgroundColor = hex(bg)
      runs.push(Text({ ...style, children: [s] }))
      start = i
    }
    rows.push(Text({ wrap: 'truncate', children: runs }))
  }
  return rows
}
