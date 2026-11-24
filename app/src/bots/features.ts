import { type Card, freshDeck } from '../engine/cards'
import { evaluate } from '../engine/evaluator'
import { hitChance } from '../engine/odds'
import { findOuts } from '../engine/outs'
import { allCombos, preflopPct } from '../engine/ranges'

export interface Feat {
  pct: number // Preflop-Perzentil
  eq: number // Handstärke auf dem aktuellen Board (0..1) inkl. Draw-Potenzial
  draw: boolean // Flush- oder Straight-Draw
}

const COMBOS = allCombos()
const IDX = new Int16Array(52 * 52).fill(-1)
COMBOS.forEach(([a, b], i) => {
  IDX[a * 52 + b] = i
  IDX[b * 52 + a] = i
})
export const comboIndex = (a: Card, b: Card) => IDX[a * 52 + b]

const cache = new Map<string, Float32Array>()

/** Handstärke jeder Starthand auf diesem Board als Perzentil (Anteil schlechterer Hände). */
function boardStrengths(board: Card[]): Float32Array {
  const key = board.join(',')
  const hit = cache.get(key)
  if (hit) return hit
  const dead = new Uint8Array(52)
  for (const c of board) dead[c] = 1
  const scores = new Float64Array(COMBOS.length).fill(-1)
  const valid: number[] = []
  for (let i = 0; i < COMBOS.length; i++) {
    const [a, b] = COMBOS[i]
    if (dead[a] || dead[b]) continue
    scores[i] = evaluate([a, b, ...board])
    valid.push(scores[i])
  }
  valid.sort((x, y) => x - y)
  const n = valid.length
  const lowerIdx = (v: number, strict: boolean) => {
    let lo = 0
    let hi = n
    while (lo < hi) {
      const mid = (lo + hi) >> 1
      if (strict ? valid[mid] < v : valid[mid] <= v) lo = mid + 1
      else hi = mid
    }
    return lo
  }
  const out = new Float32Array(COMBOS.length).fill(NaN)
  for (let i = 0; i < COMBOS.length; i++) {
    if (scores[i] < 0) continue
    const lo = lowerIdx(scores[i], true)
    const hi = lowerIdx(scores[i], false)
    out[i] = (lo + (hi - lo) / 2) / n
  }
  if (cache.size > 60) cache.clear()
  cache.set(key, out)
  return out
}

export function featOf(hole: [Card, Card], board: Card[]): Feat {
  const pct = preflopPct(hole[0], hole[1])
  if (board.length < 3) return { pct, eq: pct, draw: false }
  const hs = boardStrengths(board)[comboIndex(hole[0], hole[1])]
  let eq = Number.isNaN(hs) ? 0.5 : hs
  let draw = false
  if (board.length < 5) {
    const info = findOuts(hole, board)
    draw = info.flushDraw || info.straight !== null
    const unknown = 52 - 2 - board.length
    const hit = hitChance(info.outs.length, unknown, 5 - board.length)
    eq = Math.min(0.97, eq + hit * (1 - eq) * 0.8)
  }
  return { pct, eq, draw }
}

export { freshDeck }
