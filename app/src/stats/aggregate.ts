import { db, safe, type AnswerRec, type DecisionRec, type HandRec, type SessionRec } from '../store/db'

export type Period = 'today' | '7' | '30' | 'all'
export interface Leak {
  id: string
  text: string
  costBB100: number // geschätzte Kosten in BB pro 100 Hände
  level: number // passende Lernstufe zum Üben
}
export interface Agg {
  hands: number
  net: number
  evNet: number
  netBB: number
  bbPer100: number
  cum: number[]
  cumEv: number[]
  vpip: number
  pfr: number
  af: number
  wtsd: number
  wsd: number
  foldToCbet: number | null
  biggestWin: number
  biggestLoss: number
  bestStreak: number
  byBot: { id: string; hands: number; net: number; bb: number }[]
  sessions: SessionRec[]
  answers: {
    total: number
    ok: number
    byType: Record<string, { n: number; ok: number }>
    byDraw: Record<string, { n: number; ok: number }>
    avgErr: number
    avgMs: number
    errTrend: number[]
  }
  dec: { n: number; good: number; ok: number; bad: number; lossBB: number; per100: number }
  bluff: { faced: number; folded: number; called: number }
  leaks: Leak[]
}

const since = (p: Period) => {
  const now = Date.now()
  if (p === 'today') {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d.getTime()
  }
  return p === '7' ? now - 7 * 864e5 : p === '30' ? now - 30 * 864e5 : 0
}

export async function loadStats(period: Period, bot: string): Promise<Agg> {
  const t0 = since(period)
  const [handsAll, sessions, decAll, ansAll] = await Promise.all([
    safe(() => db.hands.where('ts').aboveOrEqual(t0).toArray(), [] as HandRec[]),
    safe(() => db.sessions.where('startedAt').aboveOrEqual(t0).toArray(), [] as SessionRec[]),
    safe(() => db.decisions.where('ts').aboveOrEqual(t0).toArray(), [] as DecisionRec[]),
    safe(() => db.answers.where('ts').aboveOrEqual(t0).toArray(), [] as AnswerRec[]),
  ])
  const hands = (bot === 'all' ? handsAll : handsAll.filter((h) => h.oppStyles.includes(bot))).sort((a, b) => a.ts - b.ts)
  return aggregate(hands, sessions, decAll, ansAll)
}

export function aggregate(hands: HandRec[], sessions: SessionRec[], decs: DecisionRec[], ans: AnswerRec[]): Agg {
  const n = hands.length
  const net = hands.reduce((t, h) => t + h.net, 0)
  const evNet = hands.reduce((t, h) => t + h.evNet, 0)
  const netBB = hands.reduce((t, h) => t + h.net / h.bb, 0)
  let run = 0
  let runEv = 0
  const cum: number[] = [0]
  const cumEv: number[] = [0]
  for (const h of hands) {
    run += h.net
    runEv += h.evNet
    cum.push(run)
    cumEv.push(runEv)
  }
  const pctOf = (f: (h: HandRec) => boolean, base?: (h: HandRec) => boolean) => {
    const b = base ? hands.filter(base) : hands
    return b.length ? (b.filter(f).length / b.length) * 100 : 0
  }
  const bets = hands.reduce((t, h) => t + h.aggBets, 0)
  const calls = hands.reduce((t, h) => t + h.aggCalls, 0)
  const faced = hands.filter((h) => h.facedCbet)
  let streak = 0
  let best = 0
  for (const h of hands) {
    streak = h.net > 0 ? streak + 1 : 0
    best = Math.max(best, streak)
  }
  const botMap = new Map<string, { hands: number; net: number; bb: number }>()
  for (const h of hands)
    h.oppStyles.forEach((s, k) => {
      if (!s) return // Menschen vom Online-Tisch gehören nicht in die Bot-Auswertung
      const e = botMap.get(s) ?? { hands: 0, net: 0, bb: 0 }
      const n = h.oppNets?.[k] ?? 0
      e.hands++
      e.net += n
      e.bb += n / h.bb
      botMap.set(s, e)
    })

  const byType: Agg['answers']['byType'] = {}
  const byDraw: Agg['answers']['byDraw'] = {}
  let errSum = 0
  let errN = 0
  let msSum = 0
  const pctAns = ans.filter((a) => ['hit', 'potodds', 'preflopEq', 'bluffshare'].includes(a.type))
  for (const a of ans) {
    const ok = a.grade !== 'miss'
    const t = (byType[a.type] ??= { n: 0, ok: 0 })
    t.n++
    if (ok) t.ok++
    if (a.type === 'outs' && a.source === 'game') {
      const k = a.drawKind ?? '?'
      const d = (byDraw[k] ??= { n: 0, ok: 0 })
      d.n++
      if (ok) d.ok++
    }
    msSum += a.ms
  }
  for (const a of pctAns) {
    errSum += a.err
    errN++
  }
  const errTrend: number[] = []
  const win = 8
  for (let i = 0; i < pctAns.length; i += 1) {
    const w = pctAns.slice(Math.max(0, i - win + 1), i + 1)
    errTrend.push(w.reduce((t, a) => t + a.err, 0) / w.length)
  }

  const graded = decs.filter((d) => d.grade)
  const lossBB = graded.reduce((t, d) => t + d.lossBB, 0)
  const bluffFaced = decs.filter((d) => d.facedBluff)
  const agg: Agg = {
    hands: n,
    net,
    evNet,
    netBB,
    bbPer100: n ? (netBB / n) * 100 : 0,
    cum,
    cumEv,
    vpip: pctOf((h) => h.vpip),
    pfr: pctOf((h) => h.pfr),
    af: calls ? bets / calls : bets,
    wtsd: pctOf((h) => h.wtsd, (h) => h.sawFlop),
    wsd: pctOf((h) => h.wsd, (h) => h.wtsd),
    foldToCbet: faced.length >= 3 ? (faced.filter((h) => h.foldedToCbet).length / faced.length) * 100 : null,
    biggestWin: Math.max(0, ...hands.map((h) => h.net)),
    biggestLoss: Math.min(0, ...hands.map((h) => h.net)),
    bestStreak: best,
    byBot: [...botMap.entries()].map(([id, v]) => ({ id, ...v })),
    sessions: sessions.sort((a, b) => b.startedAt - a.startedAt),
    answers: {
      total: ans.length,
      ok: ans.filter((a) => a.grade !== 'miss').length,
      byType,
      byDraw,
      avgErr: errN ? errSum / errN : 0,
      avgMs: ans.length ? msSum / ans.length / 1000 : 0,
      errTrend,
    },
    dec: {
      n: graded.length,
      good: graded.filter((d) => d.grade === 'good').length,
      ok: graded.filter((d) => d.grade === 'ok').length,
      bad: graded.filter((d) => d.grade === 'bad').length,
      lossBB,
      per100: n ? (lossBB / n) * 100 : 0,
    },
    bluff: {
      faced: bluffFaced.length,
      folded: bluffFaced.filter((d) => d.action === 'Fold').length,
      called: bluffFaced.filter((d) => d.action === 'Call').length,
    },
    leaks: [],
  }
  agg.leaks = findLeaks(agg, decs, n)
  return agg
}

function findLeaks(a: Agg, decs: DecisionRec[], hands: number): Leak[] {
  const out: Leak[] = []
  const per100 = (bb: number) => (hands ? (bb / hands) * 100 : 0)
  for (const [k, v] of Object.entries(a.answers.byDraw))
    if (v.n >= 3 && v.ok / v.n < 0.6)
      out.push({
        id: 'draw-' + k,
        text: `Bei "${k}" zählst du die Outs oft falsch (${v.n - v.ok} von ${v.n} Fragen daneben).`,
        costBB100: per100((v.n - v.ok) * 0.4),
        level: k.includes('Gutshot') || k.includes('Overcard') ? 1 : 2,
      })
  // Nur wenn Fold wirklich besser war (nicht, wenn ein Raise noch besser gewesen wäre)
  const badCalls = decs.filter((d) => d.action === 'Call' && (d.grade === 'bad' || d.grade === 'ok') && d.lossBB > 0.35 && (d.bestKey === undefined || d.bestKey === 'fold'))
  if (badCalls.length >= 3)
    out.push({ id: 'calls', text: `Du callst zu oft ohne passende Odds (${badCalls.length}-mal).`, costBB100: per100(badCalls.reduce((t, d) => t + d.lossBB, 0)), level: 5 })
  const badFolds = decs.filter((d) => d.action === 'Fold' && d.lossBB > 0.35 && d.kind === 'facing')
  if (badFolds.length >= 3)
    out.push({ id: 'folds', text: `Du gibst zu oft auf, obwohl die Odds stimmen (${badFolds.length}-mal).`, costBB100: per100(badFolds.reduce((t, d) => t + d.lossBB, 0)), level: 4 })
  if (a.foldToCbet !== null && a.foldToCbet > 65)
    out.push({ id: 'cbet', text: `Du foldest in ${a.foldToCbet.toFixed(0)} % der Fälle gegen eine C-Bet. Die Gegner bluffen da öfter, als du denkst.`, costBB100: 4, level: 10 })
  const po = a.answers.byType['potodds']
  if (po && po.n >= 4 && po.ok / po.n < 0.6)
    out.push({ id: 'po', text: `Pot Odds rechnest du nur in ${Math.round((po.ok / po.n) * 100)} % der Fälle richtig.`, costBB100: 3, level: 4 })
  const pre = decs.filter((d) => d.kind === 'preflop' && d.grade === 'bad')
  if (pre.length >= 4)
    out.push({ id: 'pre', text: `Preflop spielst du ${pre.length}-mal Hände, die du besser wegwirfst oder anders spielst.`, costBB100: per100(pre.length), level: 0 })
  return out.sort((x, y) => y.costBB100 - x.costBB100).slice(0, 3)
}
