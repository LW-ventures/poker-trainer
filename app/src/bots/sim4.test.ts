import { describe, it, expect } from 'vitest'
import { seededRng } from '../engine/cards'
import { act, startHand, type HandState } from '../engine/game'
import { botMove } from './policy'

describe('4er-Tisch', () => {
  it('vier Bots spielen vollständige Hände, Chips bleiben erhalten', () => {
    const styles = ['rocky', 'carla', 'max', 'rex']
    const rng = seededRng(2024)
    const st = styles.map(() => ({ h: 0, vpip: 0, pfr: 0, bets: 0, calls: 0 }))
    let stacks = [2000, 2000, 2000, 2000]
    let button = 0
    const N = 800
    for (let n = 0; n < N; n++) {
      for (let i = 0; i < 4; i++) if (stacks[i] < 40) stacks[i] = 2000
      let h: HandState = startHand(styles.map((s, i) => ({ name: s, human: false, style: s, stack: stacks[i] })), button, 10, 20, rng)
      let guard = 0
      while (!h.over && guard++ < 300) h = act(h, botMove(h, h.toAct, 20, rng).action, 20)
      expect(h.over).toBe(true)
      expect(h.result!.net.reduce((a, b) => a + b, 0)).toBe(0)
      h.seats.forEach((s, i) => {
        stacks[i] = s.stack
        st[i].h++
        const pre = h.log.filter((r) => r.seat === i && r.street === 'preflop' && r.type !== 'blind')
        if (pre.some((r) => (r.type === 'call' && r.amount > 0) || r.type === 'raise')) st[i].vpip++
        if (pre.some((r) => r.type === 'raise')) st[i].pfr++
        for (const r of h.log.filter((r) => r.seat === i && r.street !== 'preflop')) {
          if (r.type === 'bet' || r.type === 'raise') st[i].bets++
          if (r.type === 'call') st[i].calls++
        }
      })
      button = (button + 1) % 4
    }
    expect(st[0].vpip / st[0].h).toBeLessThan(st[2].vpip / st[2].h)
  }, 240000)
})
