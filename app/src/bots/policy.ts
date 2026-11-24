import type { Rng } from '../engine/cards'
import { type Action, type ActionRec, type HandState, type Position, type Situation, type Street, legal, posOf } from '../engine/game'
import { BOTS, type BotStyle } from './styles'
import { type Feat, featOf } from './features'

export type Outcome = 'fold' | 'call' | 'betS' | 'betM' | 'betL'
export type Probs = Record<Outcome, number>

const sig = (x: number) => 1 / (1 + Math.exp(-x))
const norm = (p: Probs): Probs => {
  let s = 0
  for (const k of Object.keys(p) as Outcome[]) {
    p[k] = Math.max(0, p[k])
    s += p[k]
  }
  if (s <= 0) return { fold: 0, call: 1, betS: 0, betM: 0, betL: 0 }
  for (const k of Object.keys(p) as Outcome[]) p[k] /= s
  return p
}

export type Cls = 'monster' | 'strong' | 'medium' | 'draw' | 'weak' | 'air'
export function classify(eq: number, draw: boolean, street: Street): Cls {
  let c: Cls = eq >= 0.88 ? 'monster' : eq >= 0.72 ? 'strong' : eq >= 0.55 ? 'medium' : eq >= 0.42 ? 'weak' : 'air'
  if (draw && street !== 'river' && (c === 'weak' || c === 'air' || c === 'medium')) c = 'draw'
  return c
}

/** Wahrscheinlichkeiten der Aktionen eines Bot-Stils in einer Lage. Wird auch zur Range-Schätzung genutzt. */
export function probs(style: BotStyle, street: Street, pos: Position, sit: Situation, f: Feat): Probs {
  const p: Probs = { fold: 0, call: 0, betS: 0, betM: 0, betL: 0 }
  const bb = sit.bb

  if (street === 'preflop') {
    const mult = pos === 'BTN' ? 1 : pos === 'CO' ? 0.97 : pos === 'SB' ? 0.95 : pos === 'UTG' ? 0.82 : 0.9
    const free = sit.toCall === 0
    if (sit.preRaises === 0) {
      const playThr = 1 - style.openPlay * mult
      const raiseThr = 1 - style.raiseTop * mult
      const pPlay = sig((f.pct - playThr) / 0.03)
      const pRaiseZone = sig((f.pct - raiseThr) / 0.03)
      const raiseP = pRaiseZone * 0.92 + (1 - pRaiseZone) * pPlay * (1 - style.limp) * 0.9
      p.betM = pPlay * raiseP
      p.call = pPlay * (1 - raiseP)
      p.fold = 1 - pPlay
      if (free) {
        p.call += p.fold
        p.fold = 0
      }
      return norm(p)
    }
    const raiseBB = sit.toCall / bb + 1
    const lvl = sit.preRaises
    const contThr = 1 - (style.contFrac * mult * (lvl >= 2 ? 0.35 : 1)) / (1 + 0.1 * Math.max(0, raiseBB - 3))
    const pCont = sig((f.pct - contThr) / 0.03)
    const thr = lvl >= 2 ? 0.985 : style.threeBet
    const pTop = sig((f.pct - thr) / 0.015) * 0.85
    const band = lvl === 1 && f.pct > 0.5 && f.pct < 0.78 ? style.bluff3 : 0
    const raiseP = Math.max(pTop, band)
    const big = sit.stack < 18 * bb || lvl >= 2
    p.betM = big ? 0 : raiseP
    p.betL = big ? raiseP : 0
    p.call = Math.max(0, pCont - raiseP)
    p.fold = Math.max(0, 1 - p.call - raiseP)
    return norm(p)
  }

  const cls = classify(f.eq, f.draw, street)
  const river = street === 'river'

  if (sit.toCall === 0) {
    let pBet: number
    const flop = street === 'flop'
    const multi = sit.numOpp >= 2
    let bluffBase = flop
      ? sit.aggressor
        ? style.cbet
        : style.bluff * 0.6
      : street === 'turn'
        ? style.bluff * (sit.aggressor ? 1.1 : 0.8)
        : style.bluff
    if (river && style.id === 'rex') bluffBase = 0.24
    if (sit.scare && !flop) bluffBase *= 1.3
    if (multi) bluffBase *= flop && sit.aggressor ? 0.7 : 0.6
    switch (cls) {
      case 'monster':
        pBet = 1 - style.slow * (river ? 0.4 : 1)
        break
      case 'strong':
        pBet = style.vBet
        break
      case 'medium':
        pBet = style.medBet
        break
      case 'draw':
        pBet = style.semi * (multi ? 0.7 : 1)
        break
      case 'weak':
        pBet = Math.max(style.medBet * 0.35, flop && sit.aggressor ? bluffBase * 0.7 : 0)
        break
      default:
        pBet = bluffBase
    }
    pBet = Math.min(0.97, pBet)
    const value = cls === 'monster' || cls === 'strong' || cls === 'medium'
    const mix = value ? style.sizeValue : style.sizeBluff
    p.call = 1 - pBet
    p.betS = pBet * mix[0]
    p.betM = pBet * mix[1]
    p.betL = pBet * mix[2]
    return norm(p)
  }

  // Gegen einen Einsatz
  const betFrac = sit.toCall / Math.max(1, sit.pot - sit.toCall)
  const need = sit.toCall / (sit.pot + sit.toCall)
  const shift = 0.07 + 0.2 * Math.min(betFrac, 1.5) - style.callLoose + (river ? 0.03 : 0)
  const cont = sig((f.eq - shift - need) / 0.05)
  const rp = cls === 'monster' ? 0.5 : cls === 'strong' ? 0.18 : cls === 'medium' ? 0.02 : cls === 'draw' ? style.semi * 0.3 : 0
  const raiseP = cont * rp
  const weakish = cls === 'air' || cls === 'weak' || cls === 'draw'
  const bluffRaise = weakish && !river ? style.raiseBluff * (1 - cont) * 0.5 : weakish ? style.raiseBluff * (1 - cont) * 0.25 : 0
  const total = raiseP + bluffRaise
  const bigShare = cls === 'monster' ? 0.35 : 0.15
  p.betM = total * (1 - bigShare)
  p.betL = total * bigShare
  p.call = Math.max(0, cont - raiseP)
  p.fold = Math.max(0, 1 - p.call - total)
  return norm(p)
}

export function categoryOf(rec: ActionRec): Outcome | null {
  switch (rec.type) {
    case 'blind':
      return null
    case 'fold':
      return 'fold'
    case 'check':
    case 'call':
      return 'call'
    default:
      break
  }
  if (rec.street === 'preflop') return rec.allIn && rec.sit.stack <= rec.amount + 1 && rec.sit.stack < 25 * rec.sit.bb ? 'betL' : rec.sit.preRaises >= 1 && rec.amount > 12 * rec.sit.bb ? 'betL' : 'betM'
  if (rec.type === 'bet') {
    const r = rec.amount / Math.max(1, rec.sit.pot)
    return r < 0.5 ? 'betS' : r < 0.85 ? 'betM' : 'betL'
  }
  return rec.allIn || rec.amount >= (rec.sit.pot + rec.sit.toCall) * 1.3 ? 'betL' : 'betM'
}

function pick(p: Probs, rng: Rng): Outcome {
  let x = rng()
  for (const k of Object.keys(p) as Outcome[]) {
    x -= p[k]
    if (x <= 0) return k
  }
  return 'call'
}

export interface BotMove {
  action: Action
  outcome: Outcome
  bluff: boolean
}

/** Wählt die Aktion des Bots am Zug. */
export function botMove(h: HandState, seat: number, bb: number, rng: Rng): BotMove {
  const s = h.seats[seat]
  const style = BOTS[(s.style as keyof typeof BOTS) ?? 'rex']
  const lg = legal(h, seat, bb)
  const feat = featOf(s.hole, h.board)
  const sit: Situation = {
    pot: h.seats.reduce((t, p) => t + p.committed, 0),
    toCall: lg.toCall,
    preRaises: h.preRaises,
    numOpp: h.seats.filter((p, i) => i !== seat && !p.folded).length,
    scare: scareOf(h),
    aggressor: h.aggressor === seat,
    boardLen: h.board.length,
    stack: s.stack,
    bb,
  }
  const pr = probs(style, h.street, posOf(h, seat), sit, feat)
  const outcome = pick(pr, rng)
  const cls = h.street === 'preflop' ? null : classify(feat.eq, feat.draw, h.street)
  const weakCls = cls === 'air' || cls === 'weak' || cls === 'draw'
  const unit = Math.max(1, Math.round(bb / 4))
  const rnd = (x: number) => Math.max(unit, Math.round(x / unit) * unit)

  if (outcome === 'fold') return { action: lg.canCheck ? { type: 'check' } : { type: 'fold' }, outcome, bluff: false }
  if (outcome === 'call') return { action: lg.toCall === 0 ? { type: 'check' } : { type: 'call' }, outcome, bluff: false }
  if (!lg.canRaise) return { action: lg.toCall === 0 ? { type: 'check' } : { type: 'call' }, outcome: 'call', bluff: false }

  let to: number
  if (h.street === 'preflop') {
    if (h.preRaises === 0) to = rnd(bb * (style.id === 'max' ? 3 + rng() : 2.5 + rng() * 0.5))
    else to = rnd(h.currentBet * (outcome === 'betL' ? 3.2 : style.id === 'max' ? 3.3 : 2.9))
    if (outcome === 'betL' && h.preRaises >= 1 && sit.stack < 40 * bb) to = lg.maxRaiseTo
  } else if (h.currentBet === 0) {
    const frac = outcome === 'betS' ? 0.33 : outcome === 'betM' ? 0.66 : 1
    to = rnd(sit.pot * frac)
  } else {
    const potAfter = sit.pot + lg.toCall
    to = outcome === 'betL' ? rnd(h.currentBet + potAfter * 1.4) : rnd(h.currentBet + Math.max(h.lastRaise, potAfter * 0.7))
  }
  to = Math.min(lg.maxRaiseTo, Math.max(lg.minRaiseTo, to))
  if (to >= 0.62 * lg.maxRaiseTo) to = lg.maxRaiseTo
  const bluff = weakCls && h.street !== 'preflop'
  return { action: { type: 'raise', to }, outcome, bluff }
}

function scareOf(h: HandState): boolean {
  if (h.board.length < 4) return false
  const last = h.board[h.board.length - 1]
  const suits = [0, 0, 0, 0]
  for (const c of h.board) suits[c & 3]++
  return suits[last & 3] >= 3 || last >> 2 === 12
}
