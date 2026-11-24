import { create } from 'zustand'
import { BOT_LIST, BOTS, type BotId } from '../bots/styles'
import { botMove } from '../bots/policy'
import { featOf } from '../bots/features'
import { analyseSpot, gradeDecision, type DecisionGrade, type SpotAnalysis } from '../coach/analysis'
import { planQuestions } from '../coach/plan'
import { gradeAnswer, pctTol, type QResult, type Question } from '../coach/questions'
import { type Card, cryptoRng } from '../engine/cards'
import { equity, type SeatSpec } from '../engine/equity'
import { act, computePots, startHand, STREET_DE, type Action, type HandState, type Street } from '../engine/game'
import { rangeToMatrix } from '../engine/ranges'
import { db, safe, type HandRec } from './db'
import { useProgress } from './progress'
import { getSettings, useSettings } from './settings'
import { rotateHand, type View } from '../online/core'

export interface Bubble {
  text: string
  kind: 'fold' | 'check' | 'call' | 'raise'
}
export interface HeroDecision {
  street: Street
  action: string
  grade: DecisionGrade | null
  pot: number
  toCall: number
  eq: number | null
  need: number
  facedBluff: boolean
}
export interface ResSeat {
  id: number
  name: string
  style?: BotId
  hole: [Card, Card]
  folded: boolean
  net: number
  handName: string | null
  shown: boolean
}
export interface Resolution {
  handNo: number
  bb: number
  board: Card[]
  seats: ResSeat[]
  showdown: boolean
  net: number
  evNet: number
  pot: number
  curve: { street: Street; boardLen: number; eq: number[] }[]
  curveSeats: number[]
  decisions: HeroDecision[]
  quiz: QResult[]
  bluffs: { seat: number; street: Street }[]
  matrices: { seat: number; name: string; matrix: number[][] }[]
  evLossBB: number
  log: HandState['log']
}

interface QuizState {
  questions: Question[]
  idx: number
  results: QResult[]
  answered: boolean
  startedAt: number
}

export interface GameState {
  /** true, solange am Online-Tisch gespielt wird; der Server leitet dann die Hand */
  online: boolean
  session: { id: number | null; startedAt: number; rebuys: number; hands: number; net: number } | null
  bots: BotId[]
  boardShown: number
  revealed: boolean
  stacks: number[]
  button: number
  handNo: number
  hand: HandState | null
  phase: 'idle' | 'think' | 'quiz' | 'hero' | 'over' | 'broke'
  spot: SpotAnalysis | null
  quiz: QuizState | null
  bubbles: Record<number, Bubble | undefined>
  botBluffs: { seat: number; street: Street }[]
  /** Bereits gestellte Fragen dieser Hand ("Straße:Typ"), damit nach einem Raise nichts doppelt kommt */
  asked: string[]
  decisions: HeroDecision[]
  resolution: Resolution | null
  resolutionOpen: boolean
  lastRanges: { seat: number; combos: { a: number; b: number; w: number }[] }[]
  newLevel: number | null
  startSession: () => void
  dealHand: () => void
  heroAct: (a: Action) => void
  answerQuiz: (v: number) => void
  nextQuiz: () => void
  rebuy: () => void
  closeResolution: () => void
  openResolution: () => void
  leave: () => void
  /** Online: neue Sicht vom Server übernehmen */
  applyOnlineView: (view: View) => void
  /** Online: Spiel ist zu Ende (zurück in der Lobby) */
  onlineEnded: () => void
}

// Anbindung an den Online-Tisch (setzt store/online.ts)
let onlineSend: ((a: Action, h: HandState) => void) | null = null
let onlineLeaveHook: (() => void) | null = null
export const setOnlineHooks = (send: typeof onlineSend, leave: typeof onlineLeaveHook) => {
  onlineSend = send
  onlineLeaveHook = leave
}
let onlineHandNo = 0
let onlineLogLen = 0
let onlineStreet: Street = 'preflop'
let onlineKey = ''
let onlineOverNo = 0
let onlineV = -1
/** Nach einem fehlgeschlagenen Senden: den Zug beim nächsten Abruf neu aufbauen */
export const onlineRetry = () => {
  onlineKey = ''
  onlineV = -1
}
let prevCfg: { sb: number; bb: number; startStack: number } | null = null

let timer: ReturnType<typeof setTimeout> | null = null
const clear = () => {
  if (timer) clearTimeout(timer)
  timer = null
}
const later = (fn: () => void, ms: number) => {
  clear()
  timer = setTimeout(fn, ms)
}

const thinkMs = (fast: boolean) => {
  const sp = getSettings().speed
  const [a, b] = sp === 'fast' ? [300, 650] : sp === 'slow' ? [1200, 2200] : [650, 1400]
  return fast ? 220 : a + Math.random() * (b - a)
}

function bubbleOf(h: HandState): { seat: number; b: Bubble } {
  return bubbleOfRec(h.log[h.log.length - 1])
}

function bubbleOfRec(r: HandState['log'][number]): { seat: number; b: Bubble } {
  const allin = r.allIn ? ' (All-in)' : ''
  const f = (n: number) => Math.round(n).toLocaleString('de-DE')
  if (r.type === 'fold') return { seat: r.seat, b: { text: 'Fold', kind: 'fold' } }
  if (r.type === 'check') return { seat: r.seat, b: { text: 'Check', kind: 'check' } }
  if (r.type === 'call') return { seat: r.seat, b: { text: `Call ${f(r.amount)}${allin}`, kind: 'call' } }
  if (r.type === 'bet') return { seat: r.seat, b: { text: `Bet ${f(r.to)}${allin}`, kind: 'raise' } }
  return { seat: r.seat, b: { text: `Raise ${f(r.to)}${allin}`, kind: 'raise' } }
}

const pickBots = (): BotId[] => {
  const st = getSettings()
  const pool = BOT_LIST.map((b) => b.id)
  const slots = [st.opp1, st.opp2, st.opp3]
  const taken = new Set<BotId>(slots.filter((o): o is BotId => o !== 'random'))
  return slots.map((o) => {
    if (o !== 'random') return o
    let free = pool.filter((p) => !taken.has(p))
    if (free.length === 0) free = pool
    const pick = free[Math.floor(cryptoRng() * free.length)]
    taken.add(pick)
    return pick
  })
}

export const useGame = create<GameState>((set, get) => {
  const level = () => (getSettings().unlockAll ? 10 : useProgress.getState().maxLevel)

  function pump() {
    const h = get().hand
    if (!h) return
    if (h.over) {
      const st = get()
      if (st.boardShown < h.board.length) {
        const nextLen = st.boardShown < 3 ? 3 : st.boardShown + 1
        later(() => {
          set({ boardShown: nextLen })
          pump()
        }, 1050)
        return
      }
      if (!st.revealed) {
        later(() => {
          set({ revealed: true })
          pump()
        }, h.runoutFrom >= 0 ? 800 : 550)
        return
      }
      later(finishHand, 350)
      return
    }
    if (h.toAct === 0) heroTurn()
    else {
      const heroOut = h.seats[0].folded
      set({ phase: heroOut ? 'over' : 'think' })
      later(botTurn, thinkMs(heroOut))
    }
  }

  function apply(a: Action) {
    const st = get()
    const h = st.hand!
    const bb = getSettings().bb
    const prevStreet = h.street
    const next = act(h, a, bb)
    const { seat, b } = bubbleOf(next)
    const bubbles = next.street !== prevStreet && !next.over ? {} : { ...st.bubbles, [seat]: b }
    set({ hand: next, bubbles, boardShown: next.over && next.runoutFrom >= 0 ? next.runoutFrom : next.board.length })
  }

  function botTurn() {
    const st = get()
    const h = st.hand
    if (!h || h.over || h.toAct === 0) return
    const bb = getSettings().bb
    const seat = h.toAct
    const m = botMove(h, seat, bb, cryptoRng)
    if (m.bluff && m.action.type === 'raise') set({ botBluffs: [...st.botBluffs, { seat, street: h.street }] })
    apply(m.action)
    pump()
  }

  function heroTurn() {
    set({ phase: 'think', spot: null, quiz: null })
    later(() => {
      const st = get()
      const h = st.hand
      if (!h || h.over || h.toAct !== 0) return
      const s = getSettings()
      const spot = analyseSpot(h, 0, s.bb)
      const qkey = (q: { street: string; type: string }) => `${q.street}:${q.type}`
      const qs = planQuestions(spot, s, level(), s.bb).filter((q) => !st.asked.includes(qkey(q)))
      const wait = qs.length ? Math.max(0, s.quizDelay ?? 0) * 1000 : 0
      set({
        spot,
        asked: [...st.asked, ...qs.map(qkey)],
        lastRanges: spot.ranges.length ? spot.ranges : st.lastRanges,
        quiz: qs.length ? { questions: qs, idx: 0, results: [], answered: false, startedAt: Date.now() } : null,
        phase: qs.length && wait === 0 ? 'quiz' : qs.length ? 'think' : 'hero',
      })
      // Erst das Board in Ruhe anschauen lassen, dann kommt die Frage
      if (qs.length && wait > 0)
        later(() => {
          const cur = get()
          if (!cur.hand || cur.hand.over || cur.hand.toAct !== 0 || cur.phase !== 'think' || !cur.quiz) return
          set({ phase: 'quiz', quiz: { ...cur.quiz, startedAt: Date.now() } })
        }, wait)
    }, 30)
  }

  async function finishHand() {
    const st = get()
    const h = st.hand
    if (!h || !h.result || st.phase === 'idle') return
    const s = getSettings()
    const bb = s.bb
    const res = h.result
    const hero = h.seats[0]
    const net = res.net[0]

    // All-in-bereinigter Erwartungswert
    let evNet = net
    if (h.runoutFrom >= 0 && !hero.folded) {
      const bd = h.board.slice(0, h.runoutFrom)
      let pay = 0
      for (const p of computePots(h)) {
        if (!p.eligible.includes(0)) continue
        const elig = p.eligible.filter((i) => h.runoutAlive.includes(i) || i === 0)
        const eqs = equity(
          elig.map((i): SeatSpec => ({ kind: 'hand', cards: h.seats[i].hole })),
          bd,
          6000,
        )
        pay += p.amount * eqs[elig.indexOf(0)]
      }
      evNet = pay - hero.committed
    }

    // Gewinnchancen je Straße
    const alive = h.seats.filter((p) => !p.folded).map((p) => p.id)
    const curveSeats = alive.length >= 2 ? alive : h.seats.map((p) => p.id)
    const showCurve = res.showdown || (s.showFolded && !st.online) // online sind abgelegte Karten unbekannt
    const curve: Resolution['curve'] = []
    if (showCurve) {
      const lens = [0, 3, 4, 5].filter((n) => n <= h.board.length)
      for (const n of lens) {
        const eqs = equity(
          curveSeats.map((i): SeatSpec => ({ kind: 'hand', cards: h.seats[i].hole })),
          h.board.slice(0, n),
          n === 0 ? 9000 : 4000,
        )
        curve.push({ street: n === 0 ? 'preflop' : n === 3 ? 'flop' : n === 4 ? 'turn' : 'river', boardLen: n, eq: eqs })
      }
    }

    const decisions = st.decisions
    const evLoss = decisions.reduce((t, d) => t + (d.grade?.lossBB ?? 0), 0)
    const hr = h.log.filter((r) => r.seat === 0 && r.type !== 'blind')
    const pre = hr.filter((r) => r.street === 'preflop')
    const post = hr.filter((r) => r.street !== 'preflop')
    const cbetStreet = h.aggressor !== -1 && h.aggressor !== 0
    const flopLog = h.log.filter((r) => r.street === 'flop' && r.type !== 'blind')
    const facedCbet = cbetStreet && flopLog.some((r) => r.seat === h.aggressor && (r.type === 'bet' || r.type === 'raise')) && flopLog.some((r) => r.seat === 0)
    const heroFlop = flopLog.find((r) => r.seat === 0)
    const heroBluffs = decisions.filter((d) => d.action.startsWith('Raise') || d.action.startsWith('Bet')).length
    const wtsd = res.showdown && !hero.folded
    const rec: HandRec = {
      sessionId: st.session?.id ?? 0,
      ts: Date.now(),
      bb,
      handNo: st.handNo,
      pos: h.button === 0 ? 'BTN' : h.sb === 0 ? 'SB' : 'BB',
      hole: hero.hole,
      board: h.board,
      oppHoles: h.seats.slice(1).map((p) => p.hole),
      oppStyles: h.seats.slice(1).map((p) => p.style ?? ''),
      oppNets: res.net.slice(1),
      net,
      evNet,
      pot: res.pots.reduce((t, p) => t + p.amount, 0),
      showdown: res.showdown,
      wtsd,
      wsd: wtsd && net > 0,
      vpip: pre.some((r) => (r.type === 'call' && r.amount > 0) || r.type === 'raise'),
      pfr: pre.some((r) => r.type === 'raise'),
      sawFlop: h.board.length >= 3 && !pre.some((r) => r.type === 'fold'),
      aggBets: post.filter((r) => r.type === 'bet' || r.type === 'raise').length,
      aggCalls: post.filter((r) => r.type === 'call').length,
      facedCbet: !!(facedCbet && heroFlop),
      foldedToCbet: !!(facedCbet && heroFlop && heroFlop.type === 'fold'),
      botBluffs: st.botBluffs.length,
      foldedToBluff: decisions.filter((d) => d.facedBluff && d.action === 'Fold').length,
      calledBluff: decisions.filter((d) => d.facedBluff && d.action.startsWith('Call')).length,
      heroBluffs,
      heroBluffWon: false,
      evLossBB: evLoss,
      handName: res.names[0],
      log: h.log,
    }
    const handId = await safe(() => db.hands.add(rec), 0)
    void handId
    for (const d of decisions)
      void safe(
        () =>
          db.decisions.add({
            sessionId: st.session?.id ?? 0,
            ts: Date.now(),
            street: d.street,
            kind: d.grade?.kind ?? 'free',
            grade: d.grade?.grade ?? null,
            lossBB: d.grade?.lossBB ?? 0,
            pot: d.pot,
            toCall: d.toCall,
            eq: d.eq,
            need: d.need,
            action: d.action,
            facedBluff: d.facedBluff,
            bestKey: d.grade?.bestKey,
          }),
        0,
      )

    const quizAll = st.quiz?.results ?? []
    const matrices = st.lastRanges.map((r) => ({ seat: r.seat, name: h.seats[r.seat].name, matrix: rangeToMatrix(r.combos) }))
    const resolution: Resolution = {
      handNo: st.handNo,
      bb,
      board: h.board,
      seats: h.seats.map((p) => ({
        id: p.id,
        name: p.name,
        style: p.style as BotId | undefined,
        hole: p.hole,
        folded: p.folded,
        net: res.net[p.id],
        handName: res.names[p.id],
        shown: (p.human || (res.showdown && !p.folded) || s.showFolded) && p.hole[0] >= 0,
      })),
      showdown: res.showdown,
      net,
      evNet,
      pot: rec.pot,
      curve,
      curveSeats,
      decisions,
      quiz: quizAll,
      bluffs: st.botBluffs,
      matrices,
      evLossBB: evLoss,
      log: h.log,
    }

    const stacks = h.seats.map((p) => p.stack)
    const ses = st.session
    if (ses?.id) void safe(() => db.sessions.update(ses.id!, { hands: ses.hands + 1, net: ses.net + net, rebuys: ses.rebuys }), 0)
    set({
      stacks,
      session: ses ? { ...ses, hands: ses.hands + 1, net: ses.net + net } : ses,
      resolution,
      resolutionOpen: false,
      boardShown: h.board.length,
      revealed: true,
      phase: !st.online && stacks[0] <= 0 ? 'broke' : 'over',
    })
  }

  // ------------------------------------------------------------ Online-Tisch

  function onlineSession(view: View) {
    const s = getSettings()
    prevCfg = { sb: s.sb, bb: s.bb, startStack: s.startStack }
    useSettings.getState().set({ sb: view.cfg.sb, bb: view.cfg.bb, startStack: view.cfg.startStack })
    const startedAt = Date.now()
    set({ session: { id: null, startedAt, rebuys: 0, hands: 0, net: 0 } })
    void safe(() => db.sessions.add({ startedAt, startStack: view.cfg.startStack, bb: view.cfg.bb, rebuys: 0, hands: 0, net: 0, opps: [] }), 0).then((id) => {
      const ses = get().session
      if (ses && ses.startedAt === startedAt) set({ session: { ...ses, id: id || null } })
    })
  }

  function applyOnlineView(view: View) {
    const st = get()
    if (view.status !== 'playing') {
      if (st.online) get().onlineEnded()
      return
    }
    if (view.mySeat < 0 || !view.hand) return // wartet auf die nächste Hand
    if (st.online && view.v === onlineV) return
    onlineV = view.v

    const raw = view.hand
    const me = view.mySeat
    const h = rotateHand(raw, me)
    const rotIdx = (i: number) => (i - me + raw.n) % raw.n
    const firstTime = !st.online
    if (firstTime) {
      clear()
      onlineHandNo = 0
      onlineOverNo = 0
      onlineKey = ''
      onlineSession(view)
    }
    const newHand = view.handNo !== onlineHandNo
    const botIds = [...new Set(view.seats.map((s) => s.style).filter((x): x is BotId => !!x))]

    if (newHand) {
      clear()
      onlineHandNo = view.handNo
      onlineLogLen = 0
      onlineStreet = 'preflop'
      onlineKey = ''
      set({
        online: true,
        bots: botIds,
        handNo: view.handNo,
        phase: 'think',
        spot: null,
        quiz: null,
        bubbles: {},
        decisions: [],
        resolution: null,
        resolutionOpen: false,
        lastRanges: [],
        newLevel: null,
        boardShown: 0,
        revealed: false,
        asked: [],
      })
    }

    // Blasen für neue Aktionen
    let bubbles = { ...get().bubbles }
    if (h.street !== onlineStreet && !h.over) bubbles = {}
    for (let k = onlineLogLen; k < h.log.length; k++) {
      const r = h.log[k]
      if (r.type === 'blind' || r.street !== h.street) continue
      const { seat, b } = bubbleOfRec(r)
      bubbles[seat] = b
    }
    onlineLogLen = h.log.length
    onlineStreet = h.street

    set({
      online: true,
      hand: h,
      bubbles,
      botBluffs: view.bluffs.map((b) => ({ seat: rotIdx(b.seat), street: b.street })),
      boardShown: h.over ? get().boardShown : h.board.length,
    })

    if (h.over) {
      if (onlineOverNo !== view.handNo) {
        onlineOverNo = view.handNo
        set({ boardShown: h.runoutFrom >= 0 ? h.runoutFrom : h.board.length, revealed: false, phase: 'think' })
        pump()
      }
      return
    }
    if (h.toAct === 0) {
      const key = `${view.handNo}:${h.log.length}`
      if (key !== onlineKey) {
        onlineKey = key
        heroTurn()
      }
    } else if (get().phase !== 'think') {
      set({ phase: 'think', quiz: null, spot: null })
    }
  }

  return {
    online: false,
    applyOnlineView,
    onlineEnded: () => {
      clear()
      if (prevCfg) useSettings.getState().set(prevCfg)
      prevCfg = null
      onlineV = -1
      onlineHandNo = 0
      const ses = get().session
      if (ses?.id) void safe(() => db.sessions.update(ses.id!, { endedAt: Date.now() }), 0)
      set({ online: false, hand: null, phase: 'idle', session: null, resolution: null, resolutionOpen: false, quiz: null, spot: null, bubbles: {} })
    },
    session: null,
    bots: ['rex', 'max', 'carla'],
    stacks: [0, 0, 0, 0],
    boardShown: 0,
    revealed: false,
    button: 0,
    handNo: 0,
    hand: null,
    phase: 'idle',
    spot: null,
    quiz: null,
    bubbles: {},
    botBluffs: [],
    asked: [],
    decisions: [],
    resolution: null,
    resolutionOpen: false,
    lastRanges: [],
    newLevel: null,

    startSession: () => {
      clear()
      const s = getSettings()
      const bots = pickBots()
      const startedAt = Date.now()
      set({
        session: { id: null, startedAt, rebuys: 0, hands: 0, net: 0 },
        bots,
        stacks: [s.startStack, s.startStack, s.startStack, s.startStack],
        button: Math.floor(cryptoRng() * 4),
        handNo: 0,
        hand: null,
        phase: 'idle',
        resolution: null,
        resolutionOpen: false,
      })
      void safe(() => db.sessions.add({ startedAt, startStack: s.startStack, bb: s.bb, rebuys: 0, hands: 0, net: 0, opps: bots }), 0).then((id) => {
        const ses = get().session
        if (ses && ses.startedAt === startedAt) set({ session: { ...ses, id: id || null } })
      })
      get().dealHand()
    },

    dealHand: () => {
      if (get().online) return // der Server teilt aus
      clear()
      const st = get()
      const s = getSettings()
      const stacks = st.stacks.slice()
      for (let i = 1; i < stacks.length; i++) if (stacks[i] < s.bb * 10) stacks[i] = s.startStack
      if (stacks[0] <= 0) {
        set({ phase: 'broke' })
        return
      }
      const button = st.handNo === 0 ? st.button : (st.button + 1) % 4
      const init = [
        { name: 'Du', human: true, stack: stacks[0] },
        { name: BOTS[st.bots[0]].name, human: false, style: st.bots[0], stack: stacks[1] },
        { name: BOTS[st.bots[1]].name, human: false, style: st.bots[1], stack: stacks[2] },
        { name: BOTS[st.bots[2]].name, human: false, style: st.bots[2], stack: stacks[3] },
      ]
      const hand = startHand(init, button, s.sb, s.bb, cryptoRng)
      set({
        hand,
        stacks,
        button,
        handNo: st.handNo + 1,
        phase: 'think',
        spot: null,
        quiz: null,
        bubbles: {},
        botBluffs: [],
        asked: [],
        decisions: [],
        resolution: null,
        resolutionOpen: false,
        lastRanges: [],
        newLevel: null,
        boardShown: 0,
        revealed: false,
      })
      later(pump, 450)
    },

    heroAct: (a) => {
      const st = get()
      const h = st.hand
      if (!h || h.toAct !== 0 || (st.phase !== 'hero' && st.phase !== 'quiz')) return
      const s = getSettings()
      const spot = st.spot
      const grade = spot ? gradeDecision(spot, a, s.bb) : null
      const label =
        a.type === 'fold' ? 'Fold' : a.type === 'check' ? 'Check' : a.type === 'call' ? (spot && spot.toCall > 0 ? 'Call' : 'Check') : h.currentBet === 0 ? 'Bet' : 'Raise'
      const facedBluff = st.botBluffs.some((b) => b.street === h.street)
      const dec: HeroDecision = {
        street: h.street,
        action: label,
        grade,
        pot: spot?.pot ?? 0,
        toCall: spot?.toCall ?? 0,
        eq: spot?.eq ?? null,
        need: spot?.need ?? 0,
        facedBluff,
      }
      void featOf
      if (st.online) {
        // Der Server führt die Aktion aus und schickt die neue Sicht zurück
        set({ decisions: [...st.decisions, dec], spot: null, phase: 'think' })
        onlineSend?.(a, h)
        return
      }
      set({ decisions: [...st.decisions, dec], quiz: st.quiz && st.quiz.answered ? st.quiz : st.quiz, spot: null })
      apply(a)
      set({ phase: 'think' })
      pump()
    },

    answerQuiz: (v) => {
      const st = get()
      const qz = st.quiz
      if (!qz || qz.answered) return
      const s = getSettings()
      const q = qz.questions[qz.idx]
      const adj: Question = q.unit === 'pct' && q.type !== 'preflopEq' ? { ...q, tol: pctTol(s.tolerance) } : q
      const grade = gradeAnswer(adj, v)
      const ms = Date.now() - qz.startedAt
      const result: QResult = { q: adj, given: v, err: Math.abs(v - q.answer), grade, ms }
      const unlocked = useProgress.getState().recordAnswer(grade !== 'miss')
      void safe(
        () =>
          db.answers.add({ ts: Date.now(), type: q.type, street: q.street, drawKind: q.drawKind, given: v, correct: q.answer, err: result.err, grade, ms, source: 'game', level: q.level }),
        0,
      )
      if (grade === 'miss') void safe(() => db.review.add({ due: Date.now() + 86400000, fails: 1, q }), 0)
      const quiz = { ...qz, results: [...qz.results, result], answered: true }
      set({ quiz, newLevel: unlocked ? useProgress.getState().maxLevel : st.newLevel })
      if (s.feedback === 'after') get().nextQuiz()
    },

    nextQuiz: () => {
      const st = get()
      const qz = st.quiz
      if (!qz) return
      if (qz.idx + 1 >= qz.questions.length) set({ quiz: { ...qz, answered: true, idx: qz.questions.length }, phase: 'hero' })
      else set({ quiz: { ...qz, idx: qz.idx + 1, answered: false, startedAt: Date.now() } })
    },

    rebuy: () => {
      const st = get()
      const s = getSettings()
      const stacks = st.stacks.slice()
      stacks[0] = s.startStack
      const ses = st.session
      if (ses?.id) void safe(() => db.sessions.update(ses.id!, { rebuys: ses.rebuys + 1 }), 0)
      set({ stacks, session: ses ? { ...ses, rebuys: ses.rebuys + 1 } : ses, phase: 'over' })
      get().dealHand()
    },

    closeResolution: () => set({ resolutionOpen: false }),
    openResolution: () => set({ resolutionOpen: true }),

    leave: () => {
      clear()
      if (get().online) {
        onlineLeaveHook?.()
        get().onlineEnded()
        return
      }
      const ses = get().session
      if (ses?.id) void safe(() => db.sessions.update(ses.id!, { endedAt: Date.now() }), 0)
      set({ hand: null, phase: 'idle', session: null, resolution: null, resolutionOpen: false, quiz: null, spot: null })
    },
  }
})

export { STREET_DE }
