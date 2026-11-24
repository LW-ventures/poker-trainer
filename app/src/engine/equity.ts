import type { Card, Rng } from './cards'
import { evaluate } from './evaluator'
import type { WCombo } from './ranges'

export type SeatSpec =
  | { kind: 'hand'; cards: [Card, Card] }
  | { kind: 'range'; combos: WCombo[] }
  | { kind: 'random' }

export const hand = (a: Card, b: Card): SeatSpec => ({ kind: 'hand', cards: [a, b] })
export const random: SeatSpec = { kind: 'random' }

/**
 * Gewinnchance (inkl. geteilter Pots) jedes Sitzes.
 * Exakt, wenn alle Hände bekannt sind und höchstens 2 Boardkarten fehlen, sonst Monte-Carlo.
 */
export function equity(seats: SeatSpec[], board: Card[], iters = 6000, rng: Rng = Math.random): number[] {
  const n = seats.length
  const dead = new Uint8Array(52)
  for (const c of board) dead[c] = 1
  for (const s of seats) if (s.kind === 'hand') dead[s.cards[0]] = dead[s.cards[1]] = 1
  const missing = 5 - board.length
  const sums = new Array<number>(n).fill(0)
  const buf = new Array<number>(7)
  const scores = new Array<number>(n)

  const score = (full: Card[], hole: number[]): number => {
    buf.length = 0
    buf.push(hole[0], hole[1])
    for (const c of full) buf.push(c)
    return evaluate(buf)
  }

  const settle = (full: Card[], holes: number[][]) => {
    let best = -1
    let cnt = 0
    for (let i = 0; i < n; i++) {
      const sc = score(full, holes[i])
      scores[i] = sc
      if (sc > best) {
        best = sc
        cnt = 1
      } else if (sc === best) cnt++
    }
    for (let i = 0; i < n; i++) if (scores[i] === best) sums[i] += 1 / cnt
  }

  const allKnown = seats.every((s) => s.kind === 'hand')
  if (allKnown && missing <= 2) {
    const rem: Card[] = []
    for (let c = 0; c < 52; c++) if (!dead[c]) rem.push(c)
    const holes = seats.map((s) => (s as { cards: [Card, Card] }).cards as number[])
    let count = 0
    if (missing === 0) {
      settle(board, holes)
      count = 1
    } else if (missing === 1) {
      for (const c of rem) {
        settle([...board, c], holes)
        count++
      }
    } else {
      for (let i = 0; i < rem.length; i++)
        for (let j = i + 1; j < rem.length; j++) {
          settle([...board, rem[i], rem[j]], holes)
          count++
        }
    }
    return sums.map((s) => s / count)
  }

  // Monte-Carlo
  const cum: (Float64Array | null)[] = []
  const rangeCombos: (WCombo[] | null)[] = []
  for (const s of seats) {
    if (s.kind === 'range') {
      const list = s.combos.filter((c) => !dead[c.a] && !dead[c.b] && c.w > 0)
      if (list.length === 0) {
        cum.push(null)
        rangeCombos.push(null)
        continue
      }
      const cu = new Float64Array(list.length)
      let t = 0
      for (let i = 0; i < list.length; i++) {
        t += list[i].w
        cu[i] = t
      }
      cum.push(cu)
      rangeCombos.push(list)
    } else {
      cum.push(null)
      rangeCombos.push(null)
    }
  }

  const used = new Uint8Array(52)
  const holes: number[][] = seats.map(() => [0, 0])
  const drawCard = (): Card => {
    let c = Math.floor(rng() * 52)
    while (used[c]) c = Math.floor(rng() * 52)
    used[c] = 1
    return c
  }
  let valid = 0
  const full: Card[] = new Array(5)
  for (let k = 0; k < board.length; k++) full[k] = board[k]

  for (let it = 0; it < iters; it++) {
    used.set(dead)
    let ok = true
    for (let i = 0; i < n && ok; i++) {
      const s = seats[i]
      if (s.kind === 'hand') {
        holes[i][0] = s.cards[0]
        holes[i][1] = s.cards[1]
      } else if (s.kind === 'range' && cum[i]) {
        const cu = cum[i]!
        const list = rangeCombos[i]!
        let placed = false
        for (let tries = 0; tries < 24 && !placed; tries++) {
          const x = rng() * cu[cu.length - 1]
          let lo = 0
          let hi = cu.length - 1
          while (lo < hi) {
            const mid = (lo + hi) >> 1
            if (cu[mid] < x) lo = mid + 1
            else hi = mid
          }
          const cb = list[lo]
          if (!used[cb.a] && !used[cb.b]) {
            used[cb.a] = used[cb.b] = 1
            holes[i][0] = cb.a
            holes[i][1] = cb.b
            placed = true
          }
        }
        if (!placed) ok = false
      } else {
        holes[i][0] = drawCard()
        holes[i][1] = drawCard()
      }
    }
    if (!ok) continue
    for (let k = board.length; k < 5; k++) full[k] = drawCard()
    settle(full, holes)
    valid++
  }
  return sums.map((s) => (valid ? s / valid : 0))
}

/** Gewinnchance der Hand gegen `opponents` zufällige Hände. */
export function equityVsRandom(h: [Card, Card], board: Card[], opponents = 1, iters = 4000, rng?: Rng): number {
  const seats: SeatSpec[] = [{ kind: 'hand', cards: h }]
  for (let i = 0; i < opponents; i++) seats.push(random)
  return equity(seats, board, iters, rng)[0]
}
