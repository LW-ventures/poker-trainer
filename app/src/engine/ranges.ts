import { type Card, RANKS } from './cards'

export interface WCombo {
  a: Card
  b: Card
  w: number
}

export interface HandType {
  name: string // z. B. "AKs"
  row: number // 0 = Ass ... 12 = Zwei
  col: number
  hi: number
  lo: number
  suited: boolean
  pair: boolean
}

/** 13x13-Matrix: Paare auf der Diagonale, gleichfarbig oberhalb, verschiedenfarbig unterhalb. */
export function typeOf(x: Card, y: Card): HandType {
  const rx = x >> 2
  const ry = y >> 2
  const hi = Math.max(rx, ry)
  const lo = Math.min(rx, ry)
  const pair = hi === lo
  const suited = !pair && (x & 3) === (y & 3)
  const hiI = 12 - hi
  const loI = 12 - lo
  const name = RANKS[hi] + RANKS[lo] + (pair ? '' : suited ? 's' : 'o')
  return {
    name,
    row: suited || pair ? hiI : loI,
    col: suited || pair ? loI : hiI,
    hi,
    lo,
    suited,
    pair,
  }
}

export function typeByCell(row: number, col: number): { name: string; combos: number } {
  const hiI = Math.min(row, col)
  const loI = Math.max(row, col)
  const hi = 12 - hiI
  const lo = 12 - loI
  if (row === col) return { name: RANKS[hi] + RANKS[lo], combos: 6 }
  const suited = row < col
  return { name: RANKS[hi] + RANKS[lo] + (suited ? 's' : 'o'), combos: suited ? 4 : 12 }
}

export function comboCountOfName(name: string): number {
  if (name.length === 2) return 6
  return name[2] === 's' ? 4 : 12
}

let ALL: [Card, Card][] | null = null
export function allCombos(): [Card, Card][] {
  if (!ALL) {
    ALL = []
    for (let a = 0; a < 52; a++) for (let b = a + 1; b < 52; b++) ALL.push([a, b])
  }
  return ALL
}

/** Chen-Formel (gerundet), Grundlage für die Starthand-Stärke der Bots. */
export function chen(x: Card, y: Card): number {
  const rx = x >> 2
  const ry = y >> 2
  const hi = Math.max(rx, ry)
  const lo = Math.min(rx, ry)
  const pts = (r: number) => (r === 12 ? 10 : r === 11 ? 8 : r === 10 ? 7 : r === 9 ? 6 : (r + 2) / 2)
  let s = pts(hi)
  if (hi === lo) return Math.ceil(Math.max(5, s * 2))
  if ((x & 3) === (y & 3)) s += 2
  const gap = hi - lo - 1
  s -= gap === 0 ? 0 : gap === 1 ? 1 : gap === 2 ? 2 : gap === 3 ? 4 : 5
  if (gap <= 1 && hi < 10) s += 1
  return Math.ceil(s)
}

let PCT: Map<string, number> | null = null
/** Perzentil einer Starthand (0..1, 1 = beste). */
export function preflopPct(x: Card, y: Card): number {
  if (!PCT) {
    const scored = allCombos().map(([a, b]) => ({
      name: typeOf(a, b).name,
      s: chen(a, b) + 0.01 * Math.max(a >> 2, b >> 2) + 0.001 * Math.min(a >> 2, b >> 2),
    }))
    const sorted = scored.map((e) => e.s).sort((p, q) => p - q)
    const map = new Map<string, number>()
    for (const e of scored) {
      if (map.has(e.name)) continue
      let lower = 0
      let equal = 0
      for (const v of sorted) {
        if (v < e.s) lower++
        else if (v === e.s) equal++
      }
      map.set(e.name, (lower + equal / 2) / sorted.length)
    }
    PCT = map
  }
  return PCT.get(typeOf(x, y).name) ?? 0
}

export function rangeToMatrix(combos: WCombo[]): number[][] {
  const m = Array.from({ length: 13 }, () => new Array(13).fill(0))
  let total = 0
  for (const c of combos) {
    const t = typeOf(c.a, c.b)
    m[t.row][t.col] += c.w
    total += c.w
  }
  if (total > 0) for (const r of m) for (let i = 0; i < 13; i++) r[i] /= total
  return m
}
