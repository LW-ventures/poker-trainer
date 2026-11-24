import type { Card } from '../engine/cards'
import { BOTS } from '../bots/styles'
import { probs } from '../bots/policy'
import { featOf } from '../bots/features'
import { inferRange } from '../bots/inference'
import { equity, type SeatSpec } from '../engine/equity'
import { type Action, type HandState, type Position, type Street, legal, posOf, potOf, STREET_DE } from '../engine/game'
import { potOdds } from '../engine/odds'
import { findOuts, type OutsInfo } from '../engine/outs'
import type { WCombo } from '../engine/ranges'

export type Grade = 'good' | 'ok' | 'bad'

export interface Option {
  key: 'fold' | 'call' | 'raiseHalf' | 'raisePot'
  label: string
  ev: number // Chips relativ zum Fold
  to?: number
}

export interface SpotAnalysis {
  street: Street
  pot: number
  toCall: number
  need: number // nötige Gewinnchance (0..1)
  numOpp: number
  hole: [Card, Card]
  board: Card[]
  pos: Position
  info: OutsInfo | null
  ranges: { seat: number; combos: WCombo[] }[]
  eq: number | null // gegen geschätzte Ranges
  options: Option[]
  best: Option | null
  preflopAdvice: 'fold' | 'call' | 'raise' | null
  lg: ReturnType<typeof legal>
}

const actionKind = (a: Action): 'fold' | 'call' | 'raise' => (a.type === 'fold' ? 'fold' : a.type === 'raise' ? 'raise' : 'call')

export function analyseSpot(h: HandState, seat: number, bb: number): SpotAnalysis {
  const s = h.seats[seat]
  const lg = legal(h, seat, bb)
  const pot = potOf(h)
  const opps = h.seats.filter((p, i) => i !== seat && !p.folded)
  const pos = posOf(h, seat)
  const need = lg.toCall > 0 ? potOdds(lg.toCall, pot) : 0
  const info = h.board.length >= 3 && h.board.length < 5 ? findOuts(s.hole, h.board) : null

  const base: SpotAnalysis = {
    street: h.street,
    pot,
    toCall: lg.toCall,
    need,
    numOpp: opps.length,
    hole: s.hole,
    board: h.board.slice(),
    pos,
    info,
    ranges: [],
    eq: null,
    options: [],
    best: null,
    preflopAdvice: null,
    lg,
  }

  if (h.street === 'preflop') {
    const rex = BOTS.rex
    const f = featOf(s.hole, [])
    const pr = probs(rex, 'preflop', pos, { pot, toCall: lg.toCall, preRaises: h.preRaises, numOpp: opps.length, scare: false, aggressor: false, boardLen: 0, stack: s.stack, bb }, f)
    const raise = pr.betM + pr.betL
    base.preflopAdvice = raise >= pr.call && raise >= pr.fold ? 'raise' : pr.call >= pr.fold ? 'call' : 'fold'
    if (lg.canCheck && base.preflopAdvice === 'fold') base.preflopAdvice = 'call'
    return base
  }

  // Ranges der Gegner aus ihren Aktionen
  base.ranges = opps.map((o) => ({ seat: o.id, combos: inferRange(h, o.id, s.hole, bb) }))
  const specs: SeatSpec[] = [{ kind: 'hand', cards: s.hole }, ...base.ranges.map((r) => ({ kind: 'range' as const, combos: r.combos }))]
  base.eq = equity(specs, h.board, 4000)[0]

  if (lg.toCall > 0) {
    const eq = base.eq
    const options: Option[] = [{ key: 'fold', label: 'Fold', ev: 0 }, { key: 'call', label: 'Call', ev: eq * pot - (1 - eq) * lg.toCall }]
    if (lg.canRaise) {
      for (const [key, frac, label] of [['raiseHalf', 0.5, 'Raise ½ Pot'], ['raisePot', 1, 'Raise Pot']] as const) {
        const to = Math.min(lg.maxRaiseTo, Math.max(lg.minRaiseTo, Math.round(h.currentBet + (pot + lg.toCall) * frac)))
        options.push({ key, label, ev: raiseEv(h, seat, bb, base, to), to })
      }
    }
    base.options = options
    base.best = options.reduce((a, b) => (b.ev > a.ev ? b : a))
  }
  return base
}

/** Erwartungswert eines Raises auf `to`, mit Fold-Wahrscheinlichkeit aus dem Bot-Modell. */
function raiseEv(h: HandState, seat: number, bb: number, sp: SpotAnalysis, to: number): number {
  const s = h.seats[seat]
  const myBet = s.bet
  const d = to - myBet
  const potAfter = sp.pot + d
  let allFold = 1
  const callRanges: WCombo[][] = []
  for (const r of sp.ranges) {
    const o = h.seats[r.seat]
    const style = BOTS[(o.style as keyof typeof BOTS) ?? 'rex']
    const toCallO = Math.min(to - o.bet, o.stack)
    let fold = 0
    let tot = 0
    const keep: WCombo[] = []
    for (const c of r.combos) {
      const f = featOf([c.a, c.b], h.board)
      const pr = probs(style, h.street, posOf(h, r.seat), { pot: potAfter, toCall: toCallO, preRaises: h.preRaises, numOpp: 1, scare: false, aggressor: false, boardLen: h.board.length, stack: o.stack, bb }, f)
      fold += c.w * pr.fold
      tot += c.w
      keep.push({ a: c.a, b: c.b, w: c.w * (1 - pr.fold) })
    }
    allFold *= tot > 0 ? fold / tot : 0
    callRanges.push(keep)
  }
  const specs: SeatSpec[] = [{ kind: 'hand', cards: s.hole }, ...callRanges.map((c) => ({ kind: 'range' as const, combos: c }))]
  const eqCalled = equity(specs, h.board, 2500)[0]
  const extra = sp.ranges.reduce((t, r) => t + Math.min(to - h.seats[r.seat].bet, h.seats[r.seat].stack), 0)
  const winCalled = sp.pot + extra
  return allFold * sp.pot + (1 - allFold) * (eqCalled * winCalled - (1 - eqCalled) * d)
}

export interface DecisionGrade {
  kind: 'preflop' | 'facing' | 'free'
  grade: Grade | null
  lossBB: number
  chosenEv: number | null
  bestEv: number | null
  text: string
}

export function gradeDecision(sp: SpotAnalysis, action: Action, bb: number): DecisionGrade {
  const k = actionKind(action)
  if (sp.street === 'preflop') {
    const adv = sp.preflopAdvice ?? 'call'
    const label = { fold: 'Fold', call: 'Call', raise: 'Raise' }
    if (k === adv) return { kind: 'preflop', grade: 'good', lossBB: 0, chosenEv: null, bestEv: null, text: `${label[k]} passt zu dieser Starthand aus ${sp.pos}.` }
    const mild = (k === 'call' && adv === 'raise') || (k === 'raise' && adv === 'call')
    return {
      kind: 'preflop',
      grade: mild ? 'ok' : 'bad',
      lossBB: mild ? 0.3 : 1,
      chosenEv: null,
      bestEv: null,
      text: `Empfehlung: ${label[adv]}. ${mild ? 'Beides ist vertretbar.' : 'Diese Entscheidung kostet auf Dauer Chips.'}`,
    }
  }
  if (sp.toCall === 0 || sp.options.length === 0)
    return { kind: 'free', grade: null, lossBB: 0, chosenEv: null, bestEv: null, text: 'Ohne Einsatz vor dir wird die Aktion nicht bewertet.' }

  let chosen: Option | undefined
  if (k === 'fold') chosen = sp.options.find((o) => o.key === 'fold')
  else if (k === 'call') chosen = sp.options.find((o) => o.key === 'call')
  else {
    const raises = sp.options.filter((o) => o.to !== undefined)
    const to = (action as { to: number }).to
    chosen = raises.reduce<Option | undefined>((a, o) => (!a || Math.abs(o.to! - to) < Math.abs(a.to! - to) ? o : a), undefined)
    chosen = chosen ?? sp.options.find((o) => o.key === 'call')
  }
  const best = sp.best!
  const loss = Math.max(0, best.ev - (chosen?.ev ?? 0)) / bb
  const grade: Grade = loss <= 0.35 ? 'good' : loss <= 1.5 ? 'ok' : 'bad'
  const eqTxt = sp.eq !== null ? `${(sp.eq * 100).toFixed(0)} % Gewinnchance gegen seine geschätzte Range, nötig sind ${(sp.need * 100).toFixed(0)} %.` : ''
  const txt =
    grade === 'good'
      ? `Gute Entscheidung. ${eqTxt}`
      : `Besser wäre ${best.label} gewesen (${best.ev >= 0 ? '+' : ''}${(best.ev / bb).toFixed(1).replace('.', ',')} BB statt ${((chosen?.ev ?? 0) / bb).toFixed(1).replace('.', ',')} BB). ${eqTxt}`
  return { kind: 'facing', grade, lossBB: loss, chosenEv: chosen?.ev ?? 0, bestEv: best.ev, text: txt }
}

export const streetName = (s: Street) => STREET_DE[s]
