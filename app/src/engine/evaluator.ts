import type { Card } from './cards'

// Score = Kategorie << 20 | bis zu 5 Nibbles (Ränge). Höher ist besser.
export const CAT_NAMES = [
  'Hohe Karte',
  'Ein Paar',
  'Zwei Paare',
  'Drilling',
  'Straße',
  'Flush',
  'Full House',
  'Vierling',
  'Straight Flush',
]

export const catOf = (score: number) => score >> 20

function straightHigh(mask: number): number {
  // Bit 0 = Ass als Eins, Bit r+1 = Rang r
  const m = (mask << 1) | ((mask >> 12) & 1)
  for (let h = 13; h >= 4; h--) {
    const w = 0b11111 << (h - 4)
    if ((m & w) === w) return h - 1
  }
  return -1
}

function topRanks(mask: number, n: number): number {
  let v = 0
  let left = n
  for (let r = 12; r >= 0 && left > 0; r--) {
    if (mask & (1 << r)) {
      v = (v << 4) | r
      left--
    }
  }
  while (left-- > 0) v <<= 4
  return v
}

export function evaluate(cards: readonly Card[]): number {
  const rc = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
  const sc = [0, 0, 0, 0]
  const sm = [0, 0, 0, 0]
  let mask = 0
  for (let i = 0; i < cards.length; i++) {
    const c = cards[i]
    const r = c >> 2
    const s = c & 3
    rc[r]++
    sc[s]++
    sm[s] |= 1 << r
    mask |= 1 << r
  }

  let flushSuit = -1
  for (let s = 0; s < 4; s++) if (sc[s] >= 5) flushSuit = s
  if (flushSuit >= 0) {
    const fm = sm[flushSuit]
    const sf = straightHigh(fm)
    if (sf >= 0) return (8 << 20) | (sf << 16)
  }

  const quads: number[] = []
  const trips: number[] = []
  const pairs: number[] = []
  for (let r = 12; r >= 0; r--) {
    if (rc[r] === 4) quads.push(r)
    else if (rc[r] === 3) trips.push(r)
    else if (rc[r] === 2) pairs.push(r)
  }

  const bestOther = (...excl: number[]): number => {
    for (let r = 12; r >= 0; r--) if (rc[r] > 0 && !excl.includes(r)) return r
    return 0
  }

  if (quads.length) {
    const q = quads[0]
    return (7 << 20) | (q << 16) | (bestOther(q) << 12)
  }
  if (trips.length && (trips.length >= 2 || pairs.length >= 1)) {
    const t = trips[0]
    const p = Math.max(trips.length >= 2 ? trips[1] : -1, pairs.length ? pairs[0] : -1)
    return (6 << 20) | (t << 16) | (p << 12)
  }
  if (flushSuit >= 0) return (5 << 20) | topRanks(sm[flushSuit], 5)
  const sh = straightHigh(mask)
  if (sh >= 0) return (4 << 20) | (sh << 16)
  if (trips.length) {
    const t = trips[0]
    const k1 = bestOther(t)
    const k2 = bestOther(t, k1)
    return (3 << 20) | (t << 16) | (k1 << 12) | (k2 << 8)
  }
  if (pairs.length >= 2) {
    const a = pairs[0]
    const b = pairs[1]
    return (2 << 20) | (a << 16) | (b << 12) | (bestOther(a, b) << 8)
  }
  if (pairs.length === 1) {
    const p = pairs[0]
    const k1 = bestOther(p)
    const k2 = bestOther(p, k1)
    const k3 = bestOther(p, k1, k2)
    return (1 << 20) | (p << 16) | (k1 << 12) | (k2 << 8) | (k3 << 4)
  }
  return topRanks(mask, 5)
}

const RN = ['Zwei', 'Drei', 'Vier', 'Fünf', 'Sechs', 'Sieben', 'Acht', 'Neun', 'Zehn', 'Bube', 'Dame', 'König', 'Ass']
const RN_PL = ['Zweier', 'Dreier', 'Vierer', 'Fünfer', 'Sechser', 'Siebener', 'Achter', 'Neuner', 'Zehner', 'Buben', 'Damen', 'Könige', 'Asse']

export function describe(score: number): string {
  const c = score >> 20
  const r = (n: number) => (score >> (16 - 4 * n)) & 15
  switch (c) {
    case 8:
      return r(0) === 12 ? 'Royal Flush' : `Straight Flush, ${RN[r(0)]} hoch`
    case 7:
      return `Vierling (${RN_PL[r(0)]})`
    case 6:
      return `Full House (${RN_PL[r(0)]} voll ${RN_PL[r(1)]})`
    case 5:
      return `Flush, ${RN[r(0)]} hoch`
    case 4:
      return `Straße, ${RN[r(0)]} hoch`
    case 3:
      return `Drilling (${RN_PL[r(0)]})`
    case 2:
      return `Zwei Paare (${RN_PL[r(0)]} und ${RN_PL[r(1)]})`
    case 1:
      return `Paar (${RN_PL[r(0)]})`
    default:
      return `${RN[r(0)]} hoch`
  }
}

/** Die fünf Karten, die das beste Blatt bilden. */
export function bestFive(cards: readonly Card[]): Card[] {
  if (cards.length <= 5) return cards.slice()
  let best = -1
  let pick: Card[] = []
  const cur: Card[] = []
  const rec = (start: number) => {
    if (cur.length === 5) {
      const sc = evaluate(cur)
      if (sc > best) {
        best = sc
        pick = cur.slice()
      }
      return
    }
    for (let i = start; i < cards.length; i++) {
      cur.push(cards[i])
      rec(i + 1)
      cur.pop()
    }
  }
  rec(0)
  return pick
}
