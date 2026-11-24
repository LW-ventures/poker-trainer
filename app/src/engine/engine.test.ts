import { describe as suite, it, expect } from 'vitest'
import { parseCards, seededRng, shuffled } from './cards'
import { evaluate, catOf } from './evaluator'
import { hitChance, ruleOfThumb, potOdds, comb } from './odds'
import { equity, hand } from './equity'
import { findOuts } from './outs'
import { startHand, act, legal, type HandState } from './game'
import { preflopPct, typeOf } from './ranges'

const ev = (s: string) => evaluate(parseCards(s))
const cat = (s: string) => catOf(ev(s))

suite('Handbewertung', () => {
  it('erkennt alle Kategorien', () => {
    expect(cat('As Kd 9h 7c 4s 3d 2h')).toBe(0)
    expect(cat('As Ad 9h 7c 4s 3d 2h')).toBe(1)
    expect(cat('As Ad 9h 9c 4s 3d 2h')).toBe(2)
    expect(cat('As Ad Ah 9c 4s 3d 2h')).toBe(3)
    expect(cat('5s 4d 3h 2c As Kd 9h')).toBe(4) // Wheel
    expect(cat('As 9s 7s 4s 2s Kd Kh')).toBe(5)
    expect(cat('As Ad Ah 9c 9s 3d 2h')).toBe(6)
    expect(cat('As Ad Ah Ac 9s 3d 2h')).toBe(7)
    expect(cat('9s 8s 7s 6s 5s Kd Kh')).toBe(8)
  })
  it('vergleicht korrekt', () => {
    expect(ev('As Ad 9h 7c 4s 3d 2h')).toBeGreaterThan(ev('Ks Kd 9h 7c 4s 3d 2h'))
    expect(ev('As Kd 9h 7c 4s 3d 2h')).toBeGreaterThan(ev('Qs Kd 9h 7c 4s 3d 2h'))
    expect(ev('6s 5d 4h 3c 2s Kd 9h')).toBeGreaterThan(ev('5s 4d 3h 2c As Kd 9h')) // Sechser-Straße > Wheel
    expect(ev('As Ad Ah 9c 9s 3d 2h')).toBeGreaterThan(ev('Ks Kd Kh Ac As 3d 2h')) // Full House: Drilling zählt zuerst
    expect(ev('Ks Kd Kh 2c 2s 3d 4h')).toBeLessThan(ev('As Ad Ah 2c 2s 3d 4h'))
  })
  it('Häufigkeiten nach 7 Karten passen zur Theorie', () => {
    const rng = seededRng(12345)
    const N = 120000
    const counts = new Array(9).fill(0)
    for (let i = 0; i < N; i++) counts[catOf(evaluate(shuffled(rng).slice(0, 7)))]++
    const f = (k: number) => counts[k] / N
    expect(f(1)).toBeGreaterThan(0.43)
    expect(f(1)).toBeLessThan(0.445)
    expect(f(2)).toBeGreaterThan(0.225)
    expect(f(2)).toBeLessThan(0.245)
    expect(f(3)).toBeGreaterThan(0.044)
    expect(f(3)).toBeLessThan(0.052)
    expect(f(5)).toBeGreaterThan(0.027)
    expect(f(5)).toBeLessThan(0.033)
    expect(f(6)).toBeGreaterThan(0.023)
    expect(f(6)).toBeLessThan(0.029)
  })
})

suite('Odds', () => {
  it('Trefferchancen', () => {
    expect(hitChance(9, 47, 1)).toBeCloseTo(0.1915, 3)
    expect(hitChance(9, 47, 2)).toBeCloseTo(0.3497, 3)
    expect(hitChance(8, 47, 2)).toBeCloseTo(0.3145, 3)
    expect(hitChance(15, 47, 2)).toBeCloseTo(0.5414, 3)
    expect(hitChance(4, 47, 2)).toBeCloseTo(0.1647, 3)
    expect(comb(52, 2)).toBe(1326)
  })
  it('Faustregel und Pot Odds', () => {
    expect(ruleOfThumb(9, 2)).toBe(35)
    expect(ruleOfThumb(15, 2)).toBe(53)
    expect(potOdds(20, 60)).toBeCloseTo(0.25, 5)
  })
})

suite('Equity', () => {
  it('AA gegen KK', () => {
    const e = equity([hand(...(parseCards('As Ad') as [number, number])), hand(...(parseCards('Ks Kd') as [number, number]))], [], 30000, seededRng(1))
    expect(e[0]).toBeGreaterThan(0.8)
    expect(e[0]).toBeLessThan(0.84)
  })
  it('exakt auf dem Flop', () => {
    const e = equity(
      [hand(...(parseCards('Ah 7h') as [number, number])), hand(...(parseCards('Ks Kd') as [number, number]))],
      parseCards('Kh 9h 2c'),
    )
    expect(e[0] + e[1]).toBeCloseTo(1, 6)
  })
})

suite('Outs', () => {
  it('Flush Draw = 9 Outs', () => {
    const o = findOuts(parseCards('Ah 7h') as [number, number], parseCards('Kh 9h 2c'))
    expect(o.flushDraw).toBe(true)
    expect(o.byKind.flush.length).toBe(9)
  })
  it('offener Straight Draw = 8 Outs', () => {
    const o = findOuts(parseCards('8c 7d') as [number, number], parseCards('6h 5s Kc'))
    expect(o.straight).toBe('open')
    expect(o.byKind.straight.length).toBe(8)
  })
  it('Gutshot = 4 Outs', () => {
    const o = findOuts(parseCards('Jc 9d') as [number, number], parseCards('Th 7s 2c'))
    expect(o.straight).toBe('gutshot')
    expect(o.byKind.straight.length).toBe(4)
  })
  it('Flush + offene Straße = 15 Outs', () => {
    const o = findOuts(parseCards('9h 8h') as [number, number], parseCards('7h 6h Kc'))
    expect(o.outs.length).toBe(15)
  })
  it('zwei Overcards = 6 Outs', () => {
    const o = findOuts(parseCards('Ac Kd') as [number, number], parseCards('9h 7s 2c'))
    expect(o.byKind.overcard.length).toBe(6)
  })
  it('Pocket Pair: 2 Outs auf Drilling', () => {
    const o = findOuts(parseCards('8c 8d') as [number, number], parseCards('Ah 5s 2c'))
    expect(o.byKind.trips.length).toBe(2)
  })
})

suite('Preflop', () => {
  it('Perzentile ordnen Hände', () => {
    const p = (s: string) => {
      const [a, b] = parseCards(s)
      return preflopPct(a, b)
    }
    expect(p('As Ad')).toBeGreaterThan(p('Ks Qs'))
    expect(p('Ks Qs')).toBeGreaterThan(p('7c 2d'))
    expect(typeOf(...(parseCards('As Ks') as [number, number])).name).toBe('AKs')
  })
})

function play(h: HandState, script: Array<Parameters<typeof act>[1]>, bb = 20): HandState {
  for (const a of script) h = act(h, a, bb)
  return h
}
const init = (stacks: number[]) => stacks.map((s, i) => ({ name: 'P' + i, human: i === 0, stack: s }))

suite('Spielablauf', () => {
  it('Blinds und Reihenfolge', () => {
    const h = startHand(init([1000, 1000, 1000]), 0, 10, 20, seededRng(7))
    expect(h.sb).toBe(1)
    expect(h.bb).toBe(2)
    expect(h.toAct).toBe(0) // Button zuerst
    expect(h.currentBet).toBe(20)
    expect(legal(h, 0, 20).toCall).toBe(20)
  })
  it('alle folden: BB gewinnt Blinds', () => {
    let h = startHand(init([1000, 1000, 1000]), 0, 10, 20, seededRng(7))
    h = play(h, [{ type: 'fold' }, { type: 'fold' }])
    expect(h.over).toBe(true)
    expect(h.result!.net).toEqual([0, -10, 10])
  })
  it('Check-Runde und Straßen', () => {
    let h = startHand(init([1000, 1000, 1000]), 0, 10, 20, seededRng(3))
    h = play(h, [{ type: 'call' }, { type: 'call' }, { type: 'check' }])
    expect(h.street).toBe('flop')
    expect(h.board.length).toBe(3)
    expect(h.toAct).toBe(1) // SB zuerst nach dem Flop
    h = play(h, [{ type: 'check' }, { type: 'check' }, { type: 'check' }])
    expect(h.street).toBe('turn')
    h = play(h, [{ type: 'check' }, { type: 'check' }, { type: 'check' }])
    h = play(h, [{ type: 'check' }, { type: 'check' }, { type: 'check' }])
    expect(h.over).toBe(true)
    expect(h.result!.net.reduce((a, b) => a + b, 0)).toBe(0)
  })
  it('Side Pots bei drei All-ins verschiedener Höhe', () => {
    let h = startHand(init([100, 300, 700]), 2, 10, 20, seededRng(11))
    h = play(h, [{ type: 'raise', to: 700 }, { type: 'call' }, { type: 'call' }])
    expect(h.over).toBe(true)
    const r = h.result!
    expect(r.pots.map((p) => p.amount)).toEqual([300, 400, 400])
    expect(r.payouts.reduce((a, b) => a + b, 0)).toBe(1100)
    expect(r.net.reduce((a, b) => a + b, 0)).toBe(0)
  })
  it('Mindest-Raise und Reopening', () => {
    let h = startHand(init([1000, 1000, 1000]), 0, 10, 20, seededRng(5))
    expect(legal(h, 0, 20).minRaiseTo).toBe(40)
    h = act(h, { type: 'raise', to: 60 }, 20)
    expect(h.currentBet).toBe(60)
    expect(legal(h, 1, 20).minRaiseTo).toBe(100)
  })
})
