// Legend of Clawd — a Claude Code mod: a small Zelda-style adventure in the band
// above the prompt. `/legend` opens and closes it; the game itself runs in
// ./screen.ts on the drawing side. This file draws the band, keeps the best time,
// and tells the game when Claude has finished a turn.

import type { Register } from 'claude-code'
import { TEXTS } from './texts.ts'
import type { ScreenProps } from './screen.ts'

const ROWS = 13 // 26 pixels: the whole scene, two to a row

let open = false
let apple = false
let best: number | null = null
let claudeDone = 0
let permission = 0
let typing = 0

export const register: Register = (on) => {
  on('session.start', async ($, e, next) => {
    const stored = await $.store.get('best')
    best = typeof stored === 'number' ? stored : null
    // Apple's Terminal draws block glyphs from the font: the game picks other ones there
    apple = (await $.env.get('TERM_PROGRAM')) === 'Apple_Terminal'
    await $.command.register({ name: 'legend', description: TEXTS.command })
    return next(e)
  })

  on('command.run', { command: 'legend' }, async ($) => {
    open = !open
    $.ui.invalidate('ui.render')
    return { text: open ? TEXTS.open : TEXTS.closed }
  })

  // A fairy in the game tells you when Claude is done
  on('turn.complete', async ($, e, next) => {
    if (open && !e.agentId) {
      claudeDone += 1
      $.ui.invalidate('ui.render')
    }
    return next(e)
  })

  // Claude is about to ask for your OK: the fairy says so and the game waits
  on('classic.PermissionRequest', async ($, e, next) => {
    if (open) {
      permission += 1
      $.ui.invalidate('ui.render')
    }
    return next(e)
  }).catch(($, e, next) => next(e))

  // Typing at the prompt means you left the game: it pauses
  on('prompt.edit', async ($, e, next) => {
    if (open) {
      typing += 1
      $.ui.invalidate('ui.render')
    }
    return next(e)
  }).catch(($, e, next) => next(e))

  on('ui.message', async ($, e, next) => {
    const data = e.data as { best?: unknown; quit?: unknown } | null
    if (typeof data?.best === 'number') {
      best = best === null ? data.best : Math.min(best, data.best)
      await $.store.set('best', best)
    }
    if (data?.quit === true) {
      open = false
      $.ui.invalidate('ui.render')
    }
    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (!open || e.props.hasSurvey) return next(e)
    if (e.surface !== 'terminal') {
      const { Text } = $.ui.resolve(e)
      return Text({ dimColor: true, children: [TEXTS.desktop] })
    }
    const { Client } = $.ui.resolve(e)
    const props: ScreenProps = { best, apple, claudeDone, permission, typing }
    const rows = Math.max(6, Math.min(ROWS, (e.props.maxRows || ROWS + 1) - 1))
    return Client({ key: 'game', module: './screen.ts', props, width: e.props.bodyColumns || 80, height: rows })
  })
}
