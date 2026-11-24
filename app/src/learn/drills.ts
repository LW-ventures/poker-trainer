import { type Card, cryptoRng, shuffled, cardStr } from '../engine/cards'
import { evaluate, describe } from '../engine/evaluator'
import { findOuts } from '../engine/outs'
import { hitChance, potOdds, unknownCards, mdf, pct } from '../engine/odds'
import { comboCountOfName } from '../engine/ranges'
import { type Question, qBluffShare, qHit, qImplied, qOuts, qPotOdds } from '../coach/questions'

const ri = (a: number, b: number) => a + Math.floor(cryptoRng() * (b - a + 1))
const pickOf = <T,>(a: T[]): T => a[Math.floor(cryptoRng() * a.length)]
const f1 = (x: number) => pct(x, 1) + ' %'

function randomDraw(boardLen: 3 | 4, want: (i: ReturnType<typeof findOuts>) => boolean, tries = 400) {
  for (let t = 0; t < tries; t++) {
    const d = shuffled(cryptoRng)
    const hole: [Card, Card] = [d[0], d[1]]
    const board = d.slice(2, 2 + boardLen)
    const info = findOuts(hole, board)
    if (want(info)) return { hole, board, info }
  }
  const d = shuffled(cryptoRng)
  const hole: [Card, Card] = [d[0], d[1]]
  const board = d.slice(2, 2 + boardLen)
  return { hole, board, info: findOuts(hole, board) }
}

const drawOk = (i: ReturnType<typeof findOuts>) => i.hasDraw && i.outs.length >= 4 && i.dirty.length === 0 && i.cat0 <= 1

function genHandRank(): Question {
  const d = shuffled(cryptoRng)
  const board = d.slice(0, 5)
  const a: [Card, Card] = [d[5], d[6]]
  const b: [Card, Card] = [d[7], d[8]]
  const sa = evaluate([...a, ...board])
  const sb = evaluate([...b, ...board])
  const ans = sa > sb ? 0 : sb > sa ? 1 : 2
  return {
    id: 'hr' + Math.random(),
    type: 'handrank',
    street: 'drill',
    title: 'Wer gewinnt?',
    prompt: 'Welche Hand gewinnt am Showdown?',
    lines: [`Hand A: ${a.map(cardStr).join(' ')}`, `Hand B: ${b.map(cardStr).join(' ')}`],
    answer: ans,
    unit: 'count',
    tol: { perfect: 0, good: 0 },
    explain: [`Hand A: ${describe(sa)}.`, `Hand B: ${describe(sb)}.`, ans === 2 ? 'Beide haben dasselbe Blatt: Pot wird geteilt.' : `${ans === 0 ? 'A' : 'B'} gewinnt.`],
    level: 0,
    cards: { hole: a, board },
    choices: [
      { label: 'Hand A', value: 0 },
      { label: 'Hand B', value: 1 },
      { label: 'Split', value: 2 },
    ],
  }
}

function genDecision(): Question {
  const flop = cryptoRng() < 0.6
  const { hole, board, info } = randomDraw(flop ? 3 : 4, drawOk)
  const outs = info.outs.length
  const draws = 5 - board.length
  const hit = hitChance(outs, unknownCards(board.length), draws)
  const pot = ri(8, 40) * 10
  const call = Math.round((pot * (ri(25, 100) / 100)) / 5) * 5
  const need = potOdds(call, pot)
  const callIt = hit >= need
  return {
    id: 'dc' + Math.random(),
    type: 'potodds',
    street: 'drill',
    title: 'Call oder Fold?',
    prompt: `Du hast ${outs} Outs und ${draws === 2 ? 'zwei Karten' : 'eine Karte'} kommen noch. Callst du?`,
    lines: [`Pot ${pot} (inklusive Einsatz), Call ${call}.`, 'Vergleiche deine Trefferchance mit den Pot Odds.'],
    answer: callIt ? 1 : 0,
    unit: 'count',
    tol: { perfect: 0, good: 0 },
    explain: [`Trefferchance: ${f1(hit)}.`, `Pot Odds: ${call} ÷ (${pot} + ${call}) = ${f1(need)}.`, callIt ? 'Die Trefferchance ist größer als die Pot Odds: Call.' : 'Die Trefferchance ist kleiner als die Pot Odds: Fold (ohne Implied Odds).'],
    level: 5,
    cards: { hole, board },
    choices: [
      { label: 'Call', value: 1 },
      { label: 'Fold', value: 0 },
    ],
    grid: { hole, board, outs: info.outs, dirty: [] },
  }
}

const COMBO_Q = [
  { name: 'AA', t: 'Wie viele Kombinationen hat ein bestimmtes Paar, zum Beispiel AA?' },
  { name: 'AKs', t: 'Wie viele Kombinationen hat AKs (gleichfarbig)?' },
  { name: 'AKo', t: 'Wie viele Kombinationen hat AKo (verschiedenfarbig)?' },
  { name: 'QJs', t: 'Wie viele Kombinationen hat QJs?' },
  { name: '77', t: 'Wie viele Kombinationen hat 77?' },
  { name: 'T9o', t: 'Wie viele Kombinationen hat T9o?' },
]
function genCombos(): Question {
  const r = cryptoRng()
  if (r < 0.35) {
    const t = pickOf(COMBO_Q)
    const n = comboCountOfName(t.name)
    return {
      id: 'cb' + Math.random(),
      type: 'combos',
      street: 'drill',
      title: 'Kombinationen',
      prompt: t.t,
      lines: ['Paar 6, gleichfarbig 4, verschiedenfarbig 12.'],
      answer: n,
      unit: 'count',
      tol: { perfect: 0, good: 0 },
      explain: [`${t.name} hat ${n} Kombinationen.`],
      level: 8,
    }
  }
  if (r < 0.7) {
    const ranks = ['A', 'K', 'Q', 'J']
    const rk = pickOf(ranks)
    const mine = ri(0, 1)
    return {
      id: 'bl' + Math.random(),
      type: 'combos',
      street: 'drill',
      title: 'Blocker',
      prompt: `Du hältst ein ${rk}. Wie viele Kombinationen ${rk}${rk} kann dein Gegner noch haben?`,
      lines: [mine ? 'Eine Karte dieses Rangs liegt auch auf dem Board.' : 'Das Board enthält keinen solchen Rang.'],
      answer: mine ? 1 : 3,
      unit: 'count',
      tol: { perfect: 0, good: 0 },
      explain: mine ? [`Du hältst ein ${rk}, eines liegt auf dem Board: 2 von 4 sind weg, es bleiben 2 Karten, also 1 Kombination.`] : [`Du hältst ein ${rk}: 3 Karten bleiben, daraus 3 Paare.`],
      level: 8,
    }
  }
  return {
    id: 'bk' + Math.random(),
    type: 'combos',
    street: 'drill',
    title: 'Blocker',
    prompt: `Du hältst ein Ass. Wie viele Kombinationen AK hat dein Gegner noch (alle Farben)?`,
    lines: ['Alle 16 AK-Kombinationen: 4 Asse × 4 Könige.'],
    answer: 12,
    unit: 'count',
    tol: { perfect: 0, good: 0 },
    explain: ['Du blockierst ein Ass: 3 Asse × 4 Könige = 12.'],
    level: 8,
  }
}

const RANGES = [
  { text: 'AA, KK, QQ', n: 18 },
  { text: 'AA bis JJ und AKs', n: 28 },
  { text: 'AA bis TT, AKs, AKo', n: 46 },
  { text: 'Alle Paare von 22 bis AA', n: 78 },
  { text: 'AKs, AQs, AJs, KQs', n: 16 },
]
function genRange(): Question {
  const r = pickOf(RANGES)
  return {
    id: 'rg' + Math.random(),
    type: 'range',
    street: 'drill',
    title: 'Range zählen',
    prompt: `Wie viele Kombinationen enthält diese Range: ${r.text}?`,
    lines: ['Paar 6, gleichfarbig 4, verschiedenfarbig 12.'],
    answer: r.n,
    unit: 'count',
    tol: { perfect: 0, good: Math.max(2, Math.round(r.n * 0.08)) },
    explain: [`${r.text} ergibt ${r.n} Kombinationen. Das sind ${f1(r.n / 1326)} aller 1.326 Starthände.`],
    level: 9,
  }
}

function genMdf(): Question {
  const pot = ri(4, 20) * 10
  const bet = Math.round((pot * ri(25, 150)) / 100 / 5) * 5 || 5
  const v = mdf(bet, pot) * 100
  return {
    id: 'md' + Math.random(),
    type: 'bluffshare',
    street: 'drill',
    title: 'MDF',
    prompt: 'Wie oft musst du mindestens weiterspielen (Minimum Defense Frequency)?',
    lines: [`Pot ${pot}, Gegner setzt ${bet}.`],
    answer: v,
    unit: 'pct',
    tol: { perfect: 2, good: 5 },
    explain: [`MDF = Pot ÷ (Pot + Einsatz) = ${pot} ÷ ${pot + bet} = ${f1(v / 100)}.`, 'Foldest du öfter, sind Bluffs gegen dich automatisch profitabel.'],
    hint: 'Pot geteilt durch Pot plus Einsatz.',
    level: 10,
  }
}

export function genQuestion(level: number): Question {
  switch (level) {
    case 0:
      return genHandRank()
    case 1: {
      const d = randomDraw(cryptoRng() < 0.7 ? 3 : 4, drawOk)
      return { ...qOuts(d.hole, d.board, d.info, 'flop'), street: 'drill' }
    }
    case 2: {
      const d = randomDraw(3, (i) => i.flushDraw && i.straight !== null && i.dirty.length === 0, 3000)
      return { ...qOuts(d.hole, d.board, d.info, 'flop'), street: 'drill' }
    }
    case 3: {
      const d = randomDraw(cryptoRng() < 0.65 ? 3 : 4, drawOk)
      return { ...qHit(d.hole, d.board, d.info, d.board.length === 3 ? 'flop' : 'turn'), street: 'drill' }
    }
    case 4: {
      const pot = ri(6, 60) * 10
      const call = Math.max(5, Math.round((pot * ri(20, 110)) / 100 / 5) * 5)
      return { ...qPotOdds(call, pot, 'flop'), street: 'drill' }
    }
    case 5:
      return genDecision()
    case 6: {
      const d = randomDraw(3, (i) => i.dirty.length > 0 && i.outs.length >= 3, 6000)
      return { ...qOuts(d.hole, d.board, d.info, 'flop'), level: 6, street: 'drill' }
    }
    case 7: {
      const d = randomDraw(3, drawOk)
      const hit = hitChance(d.info.outs.length, 47, 1)
      const pot = ri(6, 30) * 10
      const call = Math.max(10, Math.round((pot * ri(30, 90)) / 100 / 5) * 5)
      return { ...qImplied(hit, call, pot, 'flop'), street: 'drill' }
    }
    case 8:
      return genCombos()
    case 9:
      return genRange()
    default:
      return cryptoRng() < 0.5
        ? genMdf()
        : (() => {
            const pot = ri(6, 40) * 10
            const bet = Math.max(5, Math.round((pot * ri(30, 120)) / 100 / 5) * 5)
            return { ...qBluffShare(bet, pot + bet), street: 'drill' as const }
          })()
  }
}

/** Einstufungstest: gemischte Fragen aus den Stufen 1 bis 7. */
export function placementSet(): Question[] {
  return [1, 1, 3, 3, 4, 4, 5, 5, 7, 6].map((l) => genQuestion(l))
}
export function placementLevel(ratio: number): number {
  return ratio < 0.35 ? 1 : ratio < 0.6 ? 3 : ratio < 0.8 ? 5 : 7
}
