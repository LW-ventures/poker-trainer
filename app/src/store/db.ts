import Dexie, { type Table } from 'dexie'
import type { ActionRec, Street } from '../engine/game'
import type { Card } from '../engine/cards'
import type { Question } from '../coach/questions'

export interface SessionRec {
  id?: number
  startedAt: number
  endedAt?: number
  startStack: number
  bb: number
  rebuys: number
  hands: number
  net: number
  opps: string[]
}
export interface HandRec {
  id?: number
  sessionId: number
  ts: number
  bb: number
  handNo: number
  pos: string
  hole: [Card, Card]
  board: Card[]
  oppHoles: [Card, Card][]
  oppStyles: string[]
  oppNets?: number[]
  net: number
  evNet: number
  pot: number
  showdown: boolean
  wtsd: boolean
  wsd: boolean
  vpip: boolean
  pfr: boolean
  sawFlop: boolean
  aggBets: number
  aggCalls: number
  facedCbet: boolean
  foldedToCbet: boolean
  botBluffs: number
  foldedToBluff: number
  calledBluff: number
  heroBluffs: number
  heroBluffWon: boolean
  evLossBB: number
  handName: string | null
  log: ActionRec[]
}
export interface DecisionRec {
  id?: number
  sessionId: number
  ts: number
  street: Street
  kind: string
  grade: string | null
  lossBB: number
  pot: number
  toCall: number
  eq: number | null
  need: number
  action: string
  facedBluff: boolean
  /** Was die Analyse stattdessen empfohlen hat (fold, call, check, raiseHalf, raisePot) */
  bestKey?: string
}
export interface AnswerRec {
  id?: number
  ts: number
  type: string
  street: string
  drawKind?: string
  given: number
  correct: number
  err: number
  grade: string
  ms: number
  source: 'game' | 'drill'
  level: number
}
export interface ReviewRec {
  id?: number
  due: number
  fails: number
  q: Question
}

class PokerDB extends Dexie {
  sessions!: Table<SessionRec, number>
  hands!: Table<HandRec, number>
  decisions!: Table<DecisionRec, number>
  answers!: Table<AnswerRec, number>
  review!: Table<ReviewRec, number>
  constructor() {
    super('pokerschule')
    this.version(1).stores({
      sessions: '++id,startedAt',
      hands: '++id,sessionId,ts',
      decisions: '++id,sessionId,ts',
      answers: '++id,ts,type',
      review: '++id,due',
    })
  }
}
export const db = new PokerDB()

export async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn()
  } catch (e) {
    console.warn('DB', e)
    return fallback
  }
}
