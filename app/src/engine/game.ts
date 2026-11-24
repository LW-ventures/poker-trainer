import { type Card, type Rng, shuffled, cryptoRng } from './cards'
import { evaluate, describe, bestFive } from './evaluator'

export type Street = 'preflop' | 'flop' | 'turn' | 'river' | 'showdown'
export const STREETS: Street[] = ['preflop', 'flop', 'turn', 'river']
export const STREET_DE: Record<Street, string> = { preflop: 'Preflop', flop: 'Flop', turn: 'Turn', river: 'River', showdown: 'Showdown' }
export type Position = 'BTN' | 'SB' | 'BB' | 'UTG' | 'MP' | 'CO'

export interface Seat {
  id: number
  name: string
  human: boolean
  style?: string
  stack: number // Chips hinter dem Einsatz
  hole: [Card, Card]
  bet: number // Einsatz in dieser Setzrunde
  committed: number // Gesamteinsatz in dieser Hand
  folded: boolean
  allIn: boolean
  acted: boolean
  canRaise: boolean
}

export type ActType = 'fold' | 'check' | 'call' | 'bet' | 'raise' | 'blind'
export interface Situation {
  pot: number // Pot vor der Aktion
  toCall: number
  preRaises: number // Raises über dem Big Blind (Preflop)
  numOpp: number
  scare: boolean
  aggressor: boolean // war Preflop-Aggressor
  boardLen: number
  stack: number
  bb: number
}
export interface ActionRec {
  seat: number
  street: Street
  type: ActType
  amount: number // zusätzlich eingezahlte Chips
  to: number // Einsatzhöhe dieses Sitzes danach
  allIn: boolean
  sit: Situation
}

export interface PotSlice {
  amount: number
  eligible: number[]
  winners: number[]
}
export interface HandResult {
  showdown: boolean
  pots: PotSlice[]
  payouts: number[] // Auszahlung je Sitz
  net: number[] // Gewinn/Verlust je Sitz
  names: (string | null)[] // Handname je Sitz (nur bei Showdown, nicht gefoldet)
  scores: (number | null)[]
  best: (Card[] | null)[] // die fünf Karten, die zählen (nur Showdown)
}

export interface HandState {
  n: number
  button: number
  sb: number
  bb: number
  seats: Seat[]
  deck: Card[]
  board: Card[]
  street: Street
  toAct: number // -1 wenn niemand
  currentBet: number
  lastRaise: number
  log: ActionRec[]
  over: boolean
  result: HandResult | null
  preRaises: number
  aggressor: number // Preflop-Aggressor oder -1
  runoutFrom: number // Boardgröße, ab der nur noch aufgedeckt wurde (-1 = nie)
  runoutAlive: number[] // wer war beim Aufdecken noch dabei
}

/** Position relativ zum Button. Bei 4 Spielern: BTN, SB, BB, UTG (wie immer), ab 5: Cutoff und Middle Position. */
export const posOf = (h: HandState, seat: number): Position => {
  if (seat === h.button) return 'BTN'
  if (seat === h.sb) return 'SB'
  if (seat === h.bb) return 'BB'
  if (h.n <= 4) return 'UTG'
  const d = (seat - h.button + h.n) % h.n // 3 = erster Platz links vom Big Blind
  if (d === 3) return 'UTG'
  return d === h.n - 1 ? 'CO' : 'MP'
}

export const potOf = (h: HandState) => h.seats.reduce((s, p) => s + p.committed, 0)

export interface SeatInit {
  name: string
  human: boolean
  style?: string
  stack: number
}

export function startHand(init: SeatInit[], button: number, sbAmt: number, bbAmt: number, rng: Rng = cryptoRng): HandState {
  const n = init.length
  const deck = shuffled(rng)
  const seats: Seat[] = init.map((p, i) => ({
    id: i,
    name: p.name,
    human: p.human,
    style: p.style,
    stack: p.stack,
    hole: [deck[i * 2], deck[i * 2 + 1]],
    bet: 0,
    committed: 0,
    folded: false,
    allIn: false,
    acted: false,
    canRaise: true,
  }))
  const sb = (button + 1) % n
  const bb = (button + 2) % n
  const h: HandState = {
    n,
    button,
    sb,
    bb,
    seats,
    deck: deck.slice(n * 2),
    board: [],
    street: 'preflop',
    toAct: -1,
    currentBet: 0,
    lastRaise: bbAmt,
    log: [],
    over: false,
    result: null,
    preRaises: 0,
    aggressor: -1,
    runoutFrom: -1,
    runoutAlive: [],
  }
  const post = (i: number, amt: number) => {
    const s = seats[i]
    const a = Math.min(amt, s.stack)
    s.stack -= a
    s.bet += a
    s.committed += a
    if (s.stack === 0) s.allIn = true
    h.log.push({ seat: i, street: 'preflop', type: 'blind', amount: a, to: s.bet, allIn: s.allIn, sit: sitOf(h, i, 0) })
  }
  post(sb, sbAmt)
  post(bb, bbAmt)
  h.currentBet = Math.max(seats[sb].bet, seats[bb].bet)
  h.toAct = nextToAct(h, bb)
  return h
}

function nextToAct(h: HandState, from: number): number {
  for (let k = 1; k <= h.n; k++) {
    const i = (from + k) % h.n
    const s = h.seats[i]
    if (!s.folded && !s.allIn) return i
  }
  return -1
}

function isScare(board: Card[]): boolean {
  if (board.length < 4) return false
  const last = board[board.length - 1]
  const suits = [0, 0, 0, 0]
  for (const c of board) suits[c & 3]++
  const flushy = suits[last & 3] >= 3
  const ace = last >> 2 === 12
  return flushy || ace
}

function sitOf(h: HandState, seat: number, bbAmt: number): Situation {
  const s = h.seats[seat]
  return {
    pot: potOf(h),
    toCall: Math.max(0, Math.min(h.currentBet - s.bet, s.stack)),
    preRaises: h.preRaises,
    numOpp: h.seats.filter((p, i) => i !== seat && !p.folded).length,
    scare: isScare(h.board),
    aggressor: h.aggressor === seat,
    boardLen: h.board.length,
    stack: s.stack,
    bb: bbAmt || h.lastRaise,
  }
}

export interface Legal {
  toCall: number
  canCheck: boolean
  canRaise: boolean
  minRaiseTo: number
  maxRaiseTo: number
}

export function legal(h: HandState, i: number, bbAmt: number): Legal {
  const s = h.seats[i]
  const toCall = Math.max(0, Math.min(h.currentBet - s.bet, s.stack))
  const others = h.seats.some((p, j) => j !== i && !p.folded && !p.allIn)
  const maxTo = s.bet + s.stack
  const canRaise = s.canRaise && others && s.stack > toCall
  const minTo = Math.min(maxTo, Math.max(h.currentBet + h.lastRaise, bbAmt))
  return { toCall, canCheck: h.currentBet === s.bet, canRaise, minRaiseTo: minTo, maxRaiseTo: maxTo }
}

export type Action = { type: 'fold' } | { type: 'check' } | { type: 'call' } | { type: 'raise'; to: number }

function clone(h: HandState): HandState {
  return structuredClone(h)
}

export function act(prev: HandState, action: Action, bbAmt: number): HandState {
  if (prev.over || prev.toAct < 0) throw new Error('Keine Aktion möglich')
  const h = clone(prev)
  const i = h.toAct
  const s = h.seats[i]
  const lg = legal(h, i, bbAmt)
  const sit = sitOf(h, i, bbAmt)
  const rec = (type: ActType, amount: number) =>
    h.log.push({ seat: i, street: h.street, type, amount, to: s.bet, allIn: s.allIn, sit })

  if (action.type === 'fold') {
    s.folded = true
    s.acted = true
    rec('fold', 0)
  } else if (action.type === 'check') {
    if (!lg.canCheck) throw new Error('Check nicht erlaubt')
    s.acted = true
    rec('check', 0)
  } else if (action.type === 'call') {
    const a = lg.toCall
    s.stack -= a
    s.bet += a
    s.committed += a
    if (s.stack === 0) s.allIn = true
    s.acted = true
    rec(a === 0 ? 'check' : 'call', a)
  } else {
    if (!lg.canRaise) throw new Error('Raise nicht erlaubt')
    const to = Math.min(Math.max(action.to, lg.minRaiseTo), lg.maxRaiseTo)
    const add = to - s.bet
    const raiseSize = to - h.currentBet
    const wasBet = h.currentBet === 0 || (h.street === 'preflop' && h.preRaises === 0 && h.currentBet <= bbAmt)
    s.stack -= add
    s.bet = to
    s.committed += add
    if (s.stack === 0) s.allIn = true
    s.acted = true
    const full = raiseSize >= h.lastRaise
    h.currentBet = to
    if (full) {
      h.lastRaise = raiseSize
      for (const p of h.seats) if (p.id !== i && !p.folded && !p.allIn) { p.acted = false; p.canRaise = true }
    } else {
      for (const p of h.seats) if (p.id !== i && !p.folded && !p.allIn) { if (p.acted) p.canRaise = false; p.acted = false }
    }
    if (h.street === 'preflop') h.preRaises++
    h.aggressor = h.street === 'preflop' ? i : h.aggressor
    rec(wasBet && h.street !== 'preflop' ? 'bet' : 'raise', add)
  }

  advance(h, bbAmt)
  return h
}

function advance(h: HandState, bbAmt: number) {
  const alive = h.seats.filter((p) => !p.folded)
  if (alive.length === 1) {
    finish(h, false)
    return
  }
  const movers = alive.filter((p) => !p.allIn)
  const roundDone = movers.every((p) => p.acted && p.bet === h.currentBet)
  const onlyOneCanAct = movers.length <= 1 && movers.every((p) => p.bet >= h.currentBet)
  if (!roundDone && !onlyOneCanAct) {
    h.toAct = nextToAct(h, h.toAct)
    return
  }
  // Setzrunde beendet
  if (h.street === 'river') {
    finish(h, true)
    return
  }
  if (movers.length <= 1) {
    // alle All-in (oder nur einer kann noch handeln): Board aufdecken
    h.runoutFrom = h.board.length
    h.runoutAlive = alive.map((p) => p.id)
    while (h.board.length < 5) h.board.push(h.deck.shift()!)
    h.street = 'river'
    finish(h, true)
    return
  }
  nextStreet(h, bbAmt)
}

function nextStreet(h: HandState, bbAmt: number) {
  for (const p of h.seats) {
    p.bet = 0
    p.acted = false
    p.canRaise = true
  }
  h.currentBet = 0
  h.lastRaise = bbAmt
  if (h.street === 'preflop') {
    h.street = 'flop'
    h.board.push(h.deck.shift()!, h.deck.shift()!, h.deck.shift()!)
  } else if (h.street === 'flop') {
    h.street = 'turn'
    h.board.push(h.deck.shift()!)
  } else {
    h.street = 'river'
    h.board.push(h.deck.shift()!)
  }
  h.toAct = nextToAct(h, h.button)
}

export function computePots(h: HandState): { amount: number; eligible: number[] }[] {
  const levels = Array.from(new Set(h.seats.map((p) => p.committed).filter((c) => c > 0))).sort((a, b) => a - b)
  const out: { amount: number; eligible: number[] }[] = []
  let prev = 0
  for (const lv of levels) {
    const contributors = h.seats.filter((p) => p.committed >= lv)
    const amount = (lv - prev) * contributors.length
    const eligible = contributors.filter((p) => !p.folded).map((p) => p.id)
    if (amount > 0) {
      if (eligible.length > 0) out.push({ amount, eligible })
      else if (out.length) out[out.length - 1].amount += amount
    }
    prev = lv
  }
  return out
}

function finish(h: HandState, showdown: boolean) {
  h.over = true
  h.toAct = -1
  h.street = showdown ? 'showdown' : h.street
  const n = h.n
  const payouts = new Array<number>(n).fill(0)
  const scores: (number | null)[] = new Array(n).fill(null)
  const names: (string | null)[] = new Array(n).fill(null)
  const best: (Card[] | null)[] = new Array(n).fill(null)
  const pots = computePots(h)
  const slices: PotSlice[] = []

  if (showdown) {
    for (const p of h.seats) {
      if (!p.folded) {
        scores[p.id] = evaluate([...p.hole, ...h.board])
        names[p.id] = describe(scores[p.id]!)
        best[p.id] = bestFive([...p.hole, ...h.board])
      }
    }
  }
  for (const pot of pots) {
    let winners: number[]
    if (!showdown || pot.eligible.length === 1) {
      winners = pot.eligible.length === 1 ? pot.eligible : pot.eligible
    } else {
      const best = Math.max(...pot.eligible.map((i) => scores[i]!))
      winners = pot.eligible.filter((i) => scores[i] === best)
    }
    const share = Math.floor(pot.amount / winners.length)
    let rest = pot.amount - share * winners.length
    // Rest an den ersten Gewinner links vom Button
    const ordered = winners.slice().sort((a, b) => ((a - h.button + n) % n) - ((b - h.button + n) % n))
    for (const w of ordered) {
      payouts[w] += share + (rest > 0 ? 1 : 0)
      if (rest > 0) rest--
    }
    slices.push({ amount: pot.amount, eligible: pot.eligible, winners: ordered })
  }
  for (const p of h.seats) p.stack += payouts[p.id]
  h.result = {
    showdown,
    pots: slices,
    payouts,
    net: h.seats.map((p) => payouts[p.id] - p.committed),
    names,
    scores,
    best,
  }
}
