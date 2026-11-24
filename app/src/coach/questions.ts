import { type Card } from '../engine/cards'
import { evaluate, CAT_NAMES } from '../engine/evaluator'
import { equityVsRandom } from '../engine/equity'
import { hitChance, potOdds, ruleOfThumb, unknownCards, pct, impliedNeeded } from '../engine/odds'
import type { OutsInfo } from '../engine/outs'
import { allCombos } from '../engine/ranges'
import type { Street } from '../engine/game'

export type QType = 'preflopEq' | 'outs' | 'hit' | 'potodds' | 'beats' | 'bluffshare' | 'implied' | 'combos' | 'handrank' | 'range'
export type Tolerance = 'strict' | 'normal' | 'loose'

export interface Question {
  id: string
  type: QType
  street: Street | 'drill'
  title: string
  prompt: string
  lines: string[] // Ausgangslage in Stichpunkten
  answer: number
  unit: 'pct' | 'count' | 'chips'
  tol: { perfect: number; good: number }
  alt?: number[] // zusätzlich als „gut“ akzeptiert
  explain: string[]
  hint?: string
  level: number
  drawKind?: string
  grid?: { hole: Card[]; board: Card[]; outs: Card[]; dirty: Card[] }
  cards?: { hole: Card[]; board: Card[] }
  choices?: { label: string; value: number }[] // Auswahl statt Zahl
}

export interface QResult {
  q: Question
  given: number
  err: number
  grade: 'perfect' | 'good' | 'miss'
  ms: number
}

let uid = 0
const nid = () => `q${Date.now().toString(36)}${uid++}`

export function pctTol(t: Tolerance): { perfect: number; good: number } {
  return t === 'strict' ? { perfect: 1, good: 3 } : t === 'loose' ? { perfect: 4, good: 8 } : { perfect: 2, good: 5 }
}

export function gradeAnswer(q: Question, given: number): 'perfect' | 'good' | 'miss' {
  const err = Math.abs(given - q.answer)
  if (err <= q.tol.perfect) return 'perfect'
  if (err <= q.tol.good) return 'good'
  if (q.alt?.some((a) => Math.abs(given - a) <= q.tol.perfect)) return 'good'
  return 'miss'
}

const f1 = (x: number) => pct(x, 1) + ' %'
const KIND_DE: Record<string, string> = {
  flush: 'Flush',
  straight: 'Straße',
  trips: 'Drilling',
  fullhouse: 'Full House',
  quads: 'Vierling',
  overcard: 'Overcard-Paar',
}

export function qOuts(hole: [Card, Card], board: Card[], info: OutsInfo, street: Street): Question {
  const lines = (Object.keys(info.byKind) as (keyof typeof info.byKind)[])
    .filter((k) => info.byKind[k].length > 0)
    .map((k) => `${KIND_DE[k]}: ${info.byKind[k].length} Karten`)
  const explain = [`Dein Draw: ${info.label}.`, ...lines]
  if (info.dirty.length)
    explain.push(`${info.dirty.length} weitere Karten verbessern dich, geben dem Gegner aber vermutlich ein besseres Blatt. Sie zählen nicht als saubere Outs.`)
  if (info.byKind.flush.length && info.byKind.straight.length)
    explain.push('Karten, die Flush und Straße zugleich machen, zählst du nur einmal.')
  return {
    id: nid(),
    type: 'outs',
    street,
    title: 'Outs zählen',
    prompt: 'Wie viele Karten im Deck verbessern dich auf ein starkes Blatt?',
    lines: ['Zähle nur Karten, die dir wirklich helfen.', 'Keine Karte doppelt zählen.'],
    answer: info.outs.length,
    unit: 'count',
    tol: { perfect: 0, good: 1 },
    alt: info.dirty.length ? [info.outs.length + info.dirty.length] : undefined,
    explain,
    hint:
      info.flushDraw
        ? 'Eine Farbe hat 13 Karten. Ziehe die ab, die du selbst und auf dem Board siehst.'
        : info.straight
          ? 'Welche Ränge machen die Straße? Jeder Rang hat 4 Karten.'
          : 'Welche deiner Karten ist höher als alles auf dem Board? Es bleiben 3 Karten pro Rang.',
    level: 1,
    drawKind: info.label,
    grid: { hole, board, outs: info.outs, dirty: info.dirty },
    cards: { hole, board },
  }
}

export function qHit(hole: [Card, Card], board: Card[], info: OutsInfo, street: Street): Question {
  const outs = info.outs.length
  const unk = unknownCards(board.length)
  const draws = 5 - board.length
  const exact = hitChance(outs, unk, draws) * 100
  const thumb = ruleOfThumb(outs, draws)
  const explain = [
    `${outs} Outs, ${unk} unbekannte Karten.`,
    draws === 2
      ? `Faustregel: ${outs} × 4 = ${outs * 4} %${outs > 8 ? `, minus ${outs - 8} Korrektur = ${thumb} %` : ''}.`
      : `Faustregel: ${outs} × 2 = ${thumb} %.`,
    `Exakt: 1 − C(${unk - outs},${draws}) ÷ C(${unk},${draws}) = ${f1(exact / 100)}.`,
  ]
  return {
    id: nid(),
    type: 'hit',
    street,
    title: draws === 2 ? 'Trefferchance bis zum River' : 'Trefferchance auf dem River',
    prompt: draws === 2 ? `Mit ${outs} Outs: wie wahrscheinlich triffst du bis zum River (2 Karten)?` : `Mit ${outs} Outs: wie wahrscheinlich triffst du mit der nächsten Karte?`,
    lines: [draws === 2 ? 'Zwei Karten kommen noch.' : 'Eine Karte kommt noch.', 'Antwort in Prozent.'],
    answer: exact,
    unit: 'pct',
    tol: { perfect: 2, good: 5 },
    explain,
    hint: draws === 2 ? 'Faustregel: Outs mal 4. Ab 9 Outs ziehst du (Outs − 8) wieder ab.' : 'Faustregel: Outs mal 2.',
    level: 3,
    drawKind: info.label,
    cards: { hole, board },
  }
}

export function qPotOdds(toCall: number, pot: number, street: Street, cards?: { hole: Card[]; board: Card[] }): Question {
  const po = potOdds(toCall, pot) * 100
  return {
    id: nid(),
    type: 'potodds',
    street,
    title: 'Pot Odds',
    prompt: 'Wie oft musst du mindestens gewinnen, damit der Call profitabel ist?',
    lines: [`Im Pot liegen ${pot} (inklusive Einsatz).`, `Du musst ${toCall} callen.`],
    answer: po,
    unit: 'pct',
    tol: { perfect: 2, good: 5 },
    explain: [`Pot Odds = Call ÷ (Pot + Call) = ${toCall} ÷ (${pot} + ${toCall}) = ${f1(po / 100)}.`, 'Hast du mehr Gewinnchance als diesen Wert, lohnt sich der Call auf Dauer.'],
    hint: 'Teile den Call durch den Pot nach deinem Call.',
    level: 4,
    cards,
  }
}

export function qBluffShare(toCall: number, pot: number, cards?: { hole: Card[]; board: Card[] }): Question {
  const bet = toCall
  const before = pot - bet
  const f = (bet / (before + 2 * bet)) * 100
  return {
    id: nid(),
    type: 'bluffshare',
    street: 'river',
    title: 'Wie oft muss er bluffen?',
    prompt: 'Wie viel Prozent der Setz-Hände deines Gegners müssen Bluffs sein, damit dein Call (mit einem Bluff-Catcher) break-even ist?',
    lines: [`Vor dem Einsatz lagen ${before} im Pot.`, `Er setzt ${bet}.`],
    answer: f,
    unit: 'pct',
    tol: { perfect: 2, good: 5 },
    explain: [
      `Break-even: Bluffs ÷ alle Setz-Hände = Einsatz ÷ (Pot + 2 × Einsatz) = ${bet} ÷ (${before} + ${2 * bet}) = ${f1(f / 100)}.`,
      `Gegen einen Pot-großen Einsatz sind das 33 %, gegen einen halben Pot 25 %.`,
      `Dein Gegner muss in dieser Lage mindestens ${f1(bet / (before + bet))} deiner Hände schlagen oder dich zum Aufgeben zwingen können.`,
    ],
    hint: 'Wie Pot Odds, nur mit dem doppelten Einsatz im Nenner.',
    level: 10,
    cards,
  }
}

const REF_EQ: Record<number, string> = {
  1: 'AA 85 %, KK 82 %, AKs 67 %, 77 66 %, QJs 61 %, 72o 35 %',
  2: 'AA 74 %, KK 69 %, AKs 51 %, 77 47 %, QJs 44 %, 72o 20 %',
  3: 'AA 64 %, KK 58 %, AKs 42 %, 77 35 %, QJs 36 %, 72o 14 %',
}
const NUM_DE = ['keine', 'eine', 'zwei', 'drei', 'vier']

export function qPreflopEq(hole: [Card, Card], opponents = 3, rng?: () => number): Question {
  const n = Math.max(1, Math.min(3, opponents))
  const eq = equityVsRandom(hole, [], n, 12000, rng) * 100
  const fair = 100 / (n + 1)
  return {
    id: nid(),
    type: 'preflopEq',
    street: 'preflop',
    title: 'Starthand-Stärke',
    prompt: `Wie oft gewinnt deine Hand gegen ${n === 1 ? 'eine zufällige Hand' : NUM_DE[n] + ' zufällige Hände'}?`,
    lines: ['Alle fünf Gemeinschaftskarten kommen noch.', 'Zufällige Hände: nichts ist bekannt.'],
    answer: eq,
    unit: 'pct',
    tol: { perfect: 3, good: 7 },
    explain: [
      `Simulation: ${f1(eq / 100)}.`,
      `Zur Einordnung (gegen ${n === 1 ? 'eine' : NUM_DE[n]} zufällige${n === 1 ? ' Hand' : ' Hände'}): ${REF_EQ[n]}.`,
      `Mit ${NUM_DE[n + 1]} Spielern gewinnt im Schnitt jeder ${fair.toFixed(0)} %. Alles darüber ist ein Vorteil.`,
    ],
    hint: `Im Schnitt gewinnt jeder von ${NUM_DE[n + 1]} Spielern ${fair.toFixed(0)} %. Ist deine Hand besser als der Durchschnitt?`,
    level: 1,
    cards: { hole, board: [] },
  }
}

/** Wie viele Starthand-Kombinationen schlagen dich gerade? */
export function qBeats(hole: [Card, Card], board: Card[], street: Street): Question {
  const mine = evaluate([...hole, ...board])
  const dead = new Set<number>([...hole, ...board])
  let beats = 0
  let total = 0
  const byCat: Record<string, number> = {}
  for (const [a, b] of allCombos()) {
    if (dead.has(a) || dead.has(b)) continue
    total++
    const s = evaluate([a, b, ...board])
    if (s > mine) {
      beats++
      const n = CAT_NAMES[s >> 20]
      byCat[n] = (byCat[n] ?? 0) + 1
    }
  }
  const lines = Object.entries(byCat)
    .sort((x, y) => y[1] - x[1])
    .map(([k, v]) => `${k}: ${v} Kombinationen`)
  return {
    id: nid(),
    type: 'beats',
    street,
    title: 'Wer schlägt mich?',
    prompt: 'Wie viele von allen möglichen Starthand-Kombinationen schlagen dich auf diesem Board?',
    lines: [`Insgesamt gibt es ${total} mögliche Kombinationen für einen Gegner.`, 'Ein Paar hat 6 Kombinationen, zwei verschiedene Karten 16 (oder 12 und 4).'],
    answer: beats,
    unit: 'count',
    tol: { perfect: Math.max(3, Math.round(beats * 0.1)), good: Math.max(8, Math.round(beats * 0.25)) },
    explain: [`${beats} von ${total} Kombinationen schlagen dich (${f1(beats / total)}).`, ...lines],
    hint: 'Gehe die Kategorien durch: Welche Paare, Drillinge, Straßen, Flushs sind möglich?',
    level: 8,
    cards: { hole, board },
  }
}

export function qImplied(hit: number, toCall: number, pot: number, street: Street): Question {
  const need = impliedNeeded(hit, pot, toCall)
  return {
    id: nid(),
    type: 'implied',
    street,
    title: 'Implied Odds',
    prompt: 'Wie viel musst du bei einem Treffer im Schnitt später noch gewinnen, damit der Call break-even ist?',
    lines: [`Im Pot liegen ${pot}.`, `Du musst ${toCall} callen.`, `Deine Trefferchance: ${f1(hit)}.`],
    answer: Math.round(need),
    unit: 'chips',
    tol: { perfect: Math.max(5, Math.round(need * 0.1)), good: Math.max(12, Math.round(need * 0.25)) },
    explain: [
      `Break-even: Trefferchance × (Pot + Zusatz) = (1 − Trefferchance) × Call.`,
      `Zusatz = ${(1 - hit).toFixed(2).replace('.', ',')} × ${toCall} ÷ ${hit.toFixed(2).replace('.', ',')} − ${pot} = ${Math.round(need)}.`,
    ],
    hint: 'Was kostet dich jeder Fehlversuch, und wie oft triffst du?',
    level: 7,
  }
}

export const fmtAnswer = (q: Question, v: number) =>
  q.unit === 'pct' ? f1(v / 100) : q.unit === 'chips' ? `${Math.round(v)}` : `${Math.round(v)}`
