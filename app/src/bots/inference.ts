import type { Card } from '../engine/cards'
import { type HandState, posOf } from '../engine/game'
import { allCombos, type WCombo } from '../engine/ranges'
import { BOTS } from './styles'
import { categoryOf, probs } from './policy'
import { featOf } from './features'

/**
 * Schätzt die Range eines Bots aus seinen bisherigen Aktionen.
 * Dieselbe Entscheidungslogik wie beim Spielen: für jede Starthand wird die Wahrscheinlichkeit
 * multipliziert, dass der Bot genau diese Aktionen gewählt hätte.
 */
export function inferRange(h: HandState, botIdx: number, hero: [Card, Card], bb: number): WCombo[] {
  const style = BOTS[(h.seats[botIdx].style as keyof typeof BOTS) ?? 'rex']
  const recs = h.log.filter((r) => r.seat === botIdx && r.type !== 'blind')
  const dead = new Uint8Array(52)
  dead[hero[0]] = dead[hero[1]] = 1
  for (const c of h.board) dead[c] = 1
  const pos = posOf(h, botIdx)
  const out: WCombo[] = []
  let total = 0
  for (const [a, b] of allCombos()) {
    if (dead[a] || dead[b]) continue
    let w = 1
    for (const r of recs) {
      const cat = categoryOf(r)
      if (!cat) continue
      const board = h.board.slice(0, r.sit.boardLen)
      const f = featOf([a, b], board)
      const pr = probs(style, r.street, pos, { ...r.sit, bb }, f)
      w *= Math.max(pr[cat], 0.003)
    }
    out.push({ a, b, w })
    total += w
  }
  if (total > 0) for (const c of out) c.w /= total
  return out
}
