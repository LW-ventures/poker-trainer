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
  key: 'fold' | 'call' | 'check' | 'raiseHalf' | 'raisePot'
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

  const eq = base.eq
  const facing = lg.toCall > 0
  // Vor dir liegt ein Einsatz: Fold, Call, Raise. Sonst: Check oder selbst setzen.
  const options: Option[] = facing
    ? [{ key: 'fold', label: 'Fold', ev: 0 }, { key: 'call', label: 'Call', ev: eq * pot - (1 - eq) * lg.toCall }]
    : [{ key: 'check', label: 'Check', ev: eq * pot }]
  if (lg.canRaise) {
    const sizes = facing
      ? ([['raiseHalf', 0.5, 'Raise ½ Pot'], ['raisePot', 1, 'Raise Pot']] as const)
      : ([['raiseHalf', 0.5, 'Bet ½ Pot'], ['raisePot', 1, 'Bet Pot']] as const)
    for (const [key, frac, label] of sizes) {
      const to = Math.min(lg.maxRaiseTo, Math.max(lg.minRaiseTo, Math.round(h.currentBet + (pot + lg.toCall) * frac)))
      options.push({ key, label, ev: raiseEv(h, seat, bb, base, to), to })
    }
  }
  base.options = options
  base.best = options.reduce((a, b) => (b.ev > a.ev ? b : a))
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
  bestKey?: Option['key']
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
  if (sp.options.length === 0 || !sp.best)
    return { kind: 'free', grade: null, lossBB: 0, chosenEv: null, bestEv: null, text: 'Diese Aktion wurde nicht bewertet.' }

  const facing = sp.toCall > 0
  let chosen: Option | undefined
  if (k === 'fold') chosen = sp.options.find((o) => o.key === 'fold')
  else if (k === 'call') chosen = sp.options.find((o) => o.key === 'call' || o.key === 'check')
  else {
    const raises = sp.options.filter((o) => o.to !== undefined)
    const to = (action as { to: number }).to
    chosen = raises.reduce<Option | undefined>((a, o) => (!a || Math.abs(o.to! - to) < Math.abs(a.to! - to) ? o : a), undefined)
    chosen = chosen ?? sp.options.find((o) => o.key === 'call' || o.key === 'check')
  }
  const best = sp.best
  const chosenEv = chosen?.ev ?? 0
  const loss = Math.max(0, best.ev - chosenEv) / bb
  // Ohne Einsatz vor dir liegen Check und Bet oft nah beieinander: großzügiger bewerten, abhängig vom Pot.
  const potBB = sp.pot / bb
  const goodMax = facing ? 0.35 : Math.max(0.35, potBB * 0.06)
  const okMax = facing ? 1.5 : Math.max(1.5, potBB * 0.2)
  const grade: Grade = loss <= goodMax ? 'good' : loss <= okMax ? 'ok' : 'bad'
  const pc = (x: number) => `${(x * 100).toFixed(0)} %`
  const bbTxt = (ev: number) => `${ev >= 0 ? '+' : ''}${(ev / bb).toFixed(1).replace('.', ',')} BB`
  const eqTxt =
    sp.eq === null
      ? ''
      : facing
        ? `Du hast ${pc(sp.eq)} Gewinnchance gegen seine geschätzte Range, für den Call nötig sind ${pc(sp.need)}.`
        : `Du hast ${pc(sp.eq)} Gewinnchance gegen ihre geschätzten Ranges.`
  const choiceTxt = `${chosen?.label ?? 'Deine Aktion'} ${bbTxt(chosenEv)}, ${best.label} ${bbTxt(best.ev)}`
  const txt =
    grade === 'good'
      ? `Gute Entscheidung. ${eqTxt}`
      : grade === 'ok'
        ? `Grenzwertig: ${best.label} wäre etwas besser gewesen (${choiceTxt}). Beides ist vertretbar. ${eqTxt}`
        : `Fehler: ${best.label} wäre deutlich besser gewesen (${choiceTxt}). ${eqTxt}`
  return { kind: facing ? 'facing' : 'free', grade, lossBB: loss, chosenEv, bestEv: best.ev, bestKey: best.key, text: txt.trim() }
}

export const streetName = (s: Street) => STREET_DE[s]
