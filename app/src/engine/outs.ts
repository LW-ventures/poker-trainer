import { type Card, freshDeck } from './cards'
import { evaluate } from './evaluator'

export type OutKind = 'flush' | 'straight' | 'trips' | 'fullhouse' | 'quads' | 'overcard'

export interface OutsInfo {
  outs: Card[] // saubere Outs
  dirty: Card[] // Outs, die dem Gegner vermutlich noch mehr geben
  byKind: Record<OutKind, Card[]>
  label: string
  flushDraw: boolean
  straight: 'open' | 'gutshot' | null
  overcards: number // Anzahl Overcard-Ränge, die ein Paar machen würden
  cat0: number
  hasDraw: boolean
  cardsToCome: number
}

const KIND_OF_CAT: Record<number, OutKind> = {
  3: 'trips',
  4: 'straight',
  5: 'flush',
  6: 'fullhouse',
  7: 'quads',
  8: 'flush',
}

function suitCounts(cards: Card[]): number[] {
  const s = [0, 0, 0, 0]
  for (const c of cards) s[c & 3]++
  return s
}

function hasPair(cards: Card[]): boolean {
  const seen = new Set<number>()
  for (const c of cards) {
    if (seen.has(c >> 2)) return true
    seen.add(c >> 2)
  }
  return false
}

export function findOuts(hole: [Card, Card], board: Card[]): OutsInfo {
  const all = [...hole, ...board]
  const cat0 = evaluate(all) >> 20
  const unseen = freshDeck().filter((c) => !all.includes(c))
  const maxBoard = board.reduce((m, c) => Math.max(m, c >> 2), -1)
    const byKind: Record<OutKind, Card[]> = { flush: [], straight: [], trips: [], fullhouse: [], quads: [], overcard: [] }
  const outs: Card[] = []
  const dirty: Card[] = []
  const straightRanks = new Set<number>()
  const overRanks = new Set<number>()

  for (const c of unseen) {
    const s1 = evaluate([...all, c])
    const cat1 = s1 >> 20
    if (cat1 <= cat0) continue
    const boardOnly = evaluate([...board, c])
    if (s1 <= boardOnly) continue // das Board spielt, deine Karten helfen nicht
    let kind: OutKind
    if (cat1 === 1) {
      const r = c >> 2
      if (!((hole[0] >> 2) === r || (hole[1] >> 2) === r) || r <= maxBoard) continue
      kind = 'overcard'
      overRanks.add(r)
    } else if (cat1 === 2) {
      continue
    } else {
      kind = KIND_OF_CAT[cat1]
    }
    const boardC = [...board, c]
    const sc = suitCounts(boardC)
    const flushOnBoard = Math.max(...sc) >= 4
        const isDirty = kind !== 'overcard' && (flushOnBoard && cat1 < 5)
    if (isDirty) {
      dirty.push(c)
      continue
    }
    byKind[kind].push(c)
    outs.push(c)
    if (kind === 'straight') straightRanks.add(c >> 2)
  }

  const flushDraw = byKind.flush.length > 0
  const straight = straightRanks.size === 0 ? null : straightRanks.size >= 2 ? 'open' : 'gutshot'
  const parts: string[] = []
  if (flushDraw) parts.push('Flush Draw')
  if (straight === 'open') parts.push('Offener Straight Draw')
  if (straight === 'gutshot') parts.push('Gutshot')
  if (overRanks.size >= 2 && cat0 === 0) parts.push('Zwei Overcards')
  else if (overRanks.size === 1 && cat0 === 0) parts.push('Eine Overcard')
  if (cat0 === 1 && byKind.trips.length > 0 && parts.length === 0) parts.push('Drilling-Chance')
  const hasDraw = flushDraw || straight !== null || (cat0 === 0 && overRanks.size > 0)

  return {
    outs,
    dirty,
    byKind,
    label: parts.join(' + ') || 'Kein Draw',
    flushDraw,
    straight,
    overcards: overRanks.size,
    cat0,
    hasDraw,
    cardsToCome: 5 - board.length,
  }
}
