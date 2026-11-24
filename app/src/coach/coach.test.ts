import { describe, it, expect } from 'vitest'
import { seededRng, parseCards } from '../engine/cards'
import { act, startHand, type HandState } from '../engine/game'
import { botMove } from '../bots/policy'
import { analyseSpot, gradeDecision } from './analysis'
import { planQuestions } from './plan'
import { DEFAULTS } from '../store/settings'
import { qBeats, qHit, qOuts, qPotOdds } from './questions'
import { findOuts } from '../engine/outs'

function playUntilHeroFacesBet(seed: number): HandState | null {
  const rng = seededRng(seed)
  let h = startHand([{ name: 'H', human: true, stack: 2000 }, { name: 'R', human: false, style: 'rex', stack: 2000 }, { name: 'M', human: false, style: 'max', stack: 2000 }], seed % 3, 10, 20, rng)
  for (let g = 0; g < 60 && !h.over; g++) {
    if (h.toAct === 0) {
      if (h.board.length >= 3 && h.currentBet > h.seats[0].bet) return h
      h = act(h, h.currentBet > h.seats[0].bet ? { type: 'call' } : { type: 'check' }, 20)
    } else {
      h = act(h, botMove(h, h.toAct, 20, rng).action, 20)
    }
  }
  return null
}

describe('Coach', () => {
  it('Analyse eines Spots gegen einen Einsatz ist schnell und plausibel', () => {
    let found = 0
    let worst = 0
    for (let seed = 1; seed < 120 && found < 6; seed++) {
      const h = playUntilHeroFacesBet(seed)
      if (!h) continue
      found++
      const t0 = performance.now()
      const sp = analyseSpot(h, 0, 20)
      const ms = performance.now() - t0
      worst = Math.max(worst, ms)
      expect(sp.eq).not.toBeNull()
      expect(sp.eq!).toBeGreaterThan(0)
      expect(sp.eq!).toBeLessThan(1)
      expect(sp.options.length).toBeGreaterThanOrEqual(2)
      const callEv = sp.options.find((o) => o.key === 'call')!.ev
      // EV(Call) = eq*pot - (1-eq)*call
      expect(callEv).toBeCloseTo(sp.eq! * sp.pot - (1 - sp.eq!) * sp.toCall, 5)
      const g = gradeDecision(sp, { type: 'fold' }, 20)
      expect(g.grade).not.toBeNull()
      const qs = planQuestions(sp, { ...DEFAULTS, quizMode: 'every' }, 10, 20)
      expect(qs.length).toBeGreaterThan(0)
    }
    console.log('Spots', found, 'langste Analyse ms', Math.round(worst))
    expect(found).toBeGreaterThan(2)
    expect(worst).toBeLessThan(1500)
  })

  it('Fragen haben richtige Antworten', () => {
    const hole = parseCards('Ah 7h') as [number, number]
    const board = parseCards('Kh 9h 2c')
    const info = findOuts(hole, board)
    expect(qOuts(hole, board, info, 'flop').answer).toBe(12) // 9 Herz + 3 Asse
    expect(qHit(hole, board, info, 'flop').answer).toBeCloseTo(45.0, 0)
    expect(qPotOdds(20, 80, 'flop').answer).toBeCloseTo(20, 5)
    const b = qBeats(parseCards('As Kd') as [number, number], parseCards('Kc 9h 5h'), 'flop')
    expect(b.answer).toBeGreaterThan(0)
  })
})
