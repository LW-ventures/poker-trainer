import { describe, it, expect } from 'vitest'
import { seededRng } from '../engine/cards'
import { act, startHand, type HandState } from '../engine/game'
import { botMove } from './policy'
import { inferRange } from './inference'
import { BOT_LIST, type BotId } from './styles'

function simulate(styles: BotId[], hands: number) {
  const rng = seededRng(99)
  const stats = styles.map(() => ({ hands: 0, vpip: 0, pfr: 0, bets: 0, calls: 0, bluffs: 0, net: 0 }))
  let stacks = [2000, 2000, 2000]
  let button = 0
  let total = 0
  for (let n = 0; n < hands; n++) {
    for (let i = 0; i < 3; i++) if (stacks[i] < 40) stacks[i] = 2000
    let h: HandState = startHand(styles.map((s, i) => ({ name: s, human: false, style: s, stack: stacks[i] })), button, 10, 20, rng)
    let guard = 0
    while (!h.over && guard++ < 200) {
      const m = botMove(h, h.toAct, 20, rng)
      h = act(h, m.action, 20)
    }
    expect(h.over).toBe(true)
    expect(h.result!.net.reduce((a, b) => a + b, 0)).toBe(0)
    h.seats.forEach((s, i) => {
      stacks[i] = s.stack
      stats[i].hands++
      stats[i].net += h.result!.net[i]
      const pre = h.log.filter((r) => r.seat === i && r.street === 'preflop' && r.type !== 'blind')
      if (pre.some((r) => r.type === 'call' && r.amount > 0 || r.type === 'raise')) stats[i].vpip++
      if (pre.some((r) => r.type === 'raise')) stats[i].pfr++
      for (const r of h.log.filter((r) => r.seat === i && r.street !== 'preflop')) {
        if (r.type === 'bet' || r.type === 'raise') stats[i].bets++
        if (r.type === 'call') stats[i].calls++
      }
    })
    button = (button + 1) % 3
    total++
  }
  return stats.map((s, i) => ({ bot: styles[i], vpip: +(s.vpip / s.hands * 100).toFixed(0), pfr: +(s.pfr / s.hands * 100).toFixed(0), af: +(s.bets / Math.max(1, s.calls)).toFixed(2), bbPer100: +(s.net / 20 / s.hands * 100).toFixed(0) }))
}

describe('Bots', () => {
  it('spielen vollständige Hände, Chips bleiben erhalten', () => {
    const r = simulate(['rocky', 'max', 'rex'], 1500)
    console.log(JSON.stringify(r))
    expect(r[0].vpip).toBeLessThan(r[1].vpip)
  }, 120000)
  it('Calling Station spielt viele Hände', () => {
    const r = simulate(['carla', 'rocky', 'rex'], 1500)
    console.log(JSON.stringify(r))
    expect(r[0].vpip).toBeGreaterThan(r[1].vpip)
  }, 120000)
  it('Range-Schätzung ist normiert und bevorzugt nach Raise starke Hände', () => {
    const rng = seededRng(5)
    let h = startHand([{ name: 'H', human: true, stack: 2000 }, { name: 'R', human: false, style: 'rocky', stack: 2000 }, { name: 'X', human: false, style: 'rocky', stack: 2000 }], 2, 10, 20, rng)
    // Seat 2 ist Button und raist
    h = act(h, { type: 'raise', to: 60 }, 20)
    const t0 = Date.now()
    const r = inferRange(h, 2, h.seats[0].hole, 20)
    const ms = Date.now() - t0
    const sum = r.reduce((a, c) => a + c.w, 0)
    expect(sum).toBeCloseTo(1, 5)
    console.log('inferRange ms', ms)
  })
})
