import type { Settings } from '../store/settings'
import type { SpotAnalysis } from './analysis'
import { qBeats, qBluffShare, qHit, qOuts, qPotOdds, qPreflopEq, type Question } from './questions'

/** Ist dieser Spot „wichtig“ genug für Fragen? */
export function isImportant(sp: SpotAnalysis, bb: number): boolean {
  if (sp.street === 'preflop') return sp.toCall > bb
  if (sp.info?.hasDraw && sp.info.outs.length >= 4) return true
  if (sp.toCall > 0) {
    const before = sp.pot - sp.toCall
    if (sp.toCall >= before / 3) return true
    if (sp.eq !== null && Math.abs(sp.eq - sp.need) < 0.1) return true
    if (sp.street === 'river') return true
  }
  return false
}

export function planQuestions(sp: SpotAnalysis, st: Settings, level: number, bb: number): Question[] {
  if (st.quizMode === 'off') return []
  if (st.quizMode === 'important' && !isImportant(sp, bb)) return []
  const qs: Question[] = []
  const t = st.types
  const cards = { hole: sp.hole, board: sp.board }
  if (sp.street === 'preflop') {
    if (t.preflop) qs.push(qPreflopEq(sp.hole, sp.numOpp))
    return qs.slice(0, 1)
  }
  const info = sp.info
  const drawOk = info && info.hasDraw && (st.quizMode === 'every' ? info.outs.length >= 1 : info.outs.length >= 4)
  if (drawOk && info) {
    if (t.outs && level >= 1) qs.push(qOuts(sp.hole, sp.board, info, sp.street))
    if (t.hit && level >= 3) qs.push(qHit(sp.hole, sp.board, info, sp.street))
  }
  if (sp.toCall > 0 && t.potodds && level >= 4) qs.push(qPotOdds(sp.toCall, sp.pot, sp.street, cards))
  if (t.beats && level >= 8 && sp.board.length >= 3 && (sp.toCall > 0 || st.quizMode === 'every')) qs.push(qBeats(sp.hole, sp.board, sp.street))
  if (sp.street === 'river' && sp.toCall > 0 && t.bluffshare && level >= 10) qs.push(qBluffShare(sp.toCall, sp.pot, cards))
  return qs.slice(0, 3)
}
