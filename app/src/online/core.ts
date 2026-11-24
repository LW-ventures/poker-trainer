// Spiellogik für den Online-Tisch. Reine Funktionen ohne Netzwerk, damit sie sich testen lassen
// und sowohl in der Server-Funktion (Supabase Edge Function) als auch im Client laufen können.
import { BOT_LIST, BOTS, type BotId } from '../bots/styles'
import { botMove } from '../bots/policy'
import { cryptoRng, type Card, type Rng } from '../engine/cards'
import { act, legal, startHand, type Action, type HandState, type Street } from '../engine/game'

export const MIN_SEATS = 4
export const MAX_SEATS = 8
export const ACT_TIMEOUT_MS = 90_000 // so lange darf ein Mensch überlegen (inklusive Fragen vom Coach)
export const IDLE_AFTER = 2 // nach so vielen verpassten Zügen spielt ein Bot für den Spieler, bis er wieder zieht
export const OFFLINE_ACT_MS = 3_500 // ist jemand weg, spielt nach dieser Zeit ein Bot für ihn
export const ONLINE_MS = 25_000 // so lange gilt jemand nach dem letzten Lebenszeichen als online
export const LOBBY_PRUNE_MS = 3 * 60_000
export const SEAT_PRUNE_MS = 10 * 60_000

export interface OPlayer {
  pid: string
  name: string
  token: string // geheim, nie an andere Clients schicken
  joined: number
  hands: number
  net: number
  rebuys: number
  idle: number // verpasste Züge in Folge
}
export interface OSeat {
  pid: string | null // null = Bot
  name: string
  style?: BotId
  stack: number
}
export interface Cfg {
  sb: number
  bb: number
  startStack: number
}
export interface Doc {
  v: number
  status: 'lobby' | 'playing'
  players: OPlayer[]
  seats: OSeat[]
  pending: string[] // pids, die ab der nächsten Hand mitspielen
  ready: string[] // pids, die nach dem Showdown "weiter" gedrückt haben
  hand: HandState | null
  handNo: number
  button: number
  dueAt: number // ab wann der Server den nächsten Schritt (Bot, nächste Hand) machen darf
  turnSince: number
  bluffs: { seat: number; street: Street }[]
  cfg: Cfg
}

export const newDoc = (): Doc => ({
  v: 0,
  status: 'lobby',
  players: [],
  seats: [],
  pending: [],
  ready: [],
  hand: null,
  handNo: 0,
  button: 0,
  dueAt: 0,
  turnSince: 0,
  bluffs: [],
  cfg: { sb: 10, bb: 20, startStack: 2000 },
})

export class OnlineError extends Error {}
const fail = (msg: string): never => {
  throw new OnlineError(msg)
}

const uid = () => crypto.randomUUID()
export const cleanName = (raw: unknown): string => String(raw ?? '').replace(/\s+/g, ' ').trim().slice(0, 14)

const sameName = (a: string, b: string) => a.toLocaleLowerCase('de') === b.toLocaleLowerCase('de')
const botNames = () => BOT_LIST.map((b) => b.name)

const humanSeats = (d: Doc) => d.seats.filter((s) => s.pid !== null).length
export const seatOf = (d: Doc, pid: string) => d.seats.findIndex((s) => s.pid === pid)
const playerOf = (d: Doc, pid: string) => d.players.find((p) => p.pid === pid)

export function findByToken(d: Doc, token: unknown): OPlayer | undefined {
  if (typeof token !== 'string' || token.length < 8) return undefined
  return d.players.find((p) => p.token === token)
}

// ---------------------------------------------------------------- Beitreten und Gehen

export function joinPlayer(d: Doc, nameRaw: unknown, token: unknown, now: number, seen: Record<string, number>): OPlayer {
  const name = cleanName(nameRaw)
  if (name.length < 1) fail('Bitte gib einen Namen ein.')
  const existing = d.players.find((p) => sameName(p.name, name))
  if (existing) {
    // Wiedereinstieg mit demselben Gerät oder, wenn der Name verwaist ist, Übernahme
    if (existing.token === token) return existing
    const idle = now - (seen[existing.pid] ?? 0)
    if (idle < ONLINE_MS) fail('Dieser Name ist gerade vergeben.')
    existing.token = uid()
    return existing
  }
  if (botNames().some((b) => sameName(b, name))) fail('Diesen Namen tragen die Bots. Nimm einen anderen.')
  const humans = d.status === 'lobby' ? d.players.length : humanSeats(d) + d.pending.length
  if (humans >= MAX_SEATS) fail('Der Tisch ist voll (8 Spieler).')
  const p: OPlayer = { pid: uid().slice(0, 8), name, token: uid(), joined: now, hands: 0, net: 0, rebuys: 0, idle: 0 }
  d.players.push(p)
  if (d.status === 'playing') d.pending.push(p.pid)
  return p
}

function botFor(d: Doc, taken: Set<string>): OSeat {
  const used = new Set(d.seats.filter((s) => s.pid === null).map((s) => s.style))
  const pool = BOT_LIST.map((b) => b.id)
  const free = pool.filter((id) => !used.has(id))
  const style = (free.length ? free : pool)[Math.floor(cryptoRng() * (free.length ? free.length : pool.length))]
  let name = BOTS[style].name
  for (let k = 2; taken.has(name.toLocaleLowerCase('de')); k++) name = `${BOTS[style].name} ${k}`
  taken.add(name.toLocaleLowerCase('de'))
  return { pid: null, name, style, stack: d.cfg.startStack }
}

export function leavePlayer(d: Doc, pid: string, now: number, rng: Rng = cryptoRng): void {
  const idx = d.players.findIndex((p) => p.pid === pid)
  if (idx < 0) return
  d.players.splice(idx, 1)
  d.pending = d.pending.filter((x) => x !== pid)
  if (d.status !== 'playing') return
  const si = seatOf(d, pid)
  if (si >= 0) {
    const h = d.hand
    const taken = new Set(d.seats.filter((s) => s.pid !== pid).map((s) => s.name.toLocaleLowerCase('de')))
    const bot = botFor(d, taken)
    // Der Bot übernimmt den Platz samt Chips; laufende Hand spielt er mit den Karten des Gehenden weiter
    d.seats[si] = { ...bot, stack: h && !h.over ? h.seats[si].stack : d.seats[si].stack }
    if (h) {
      h.seats[si].name = bot.name
      h.seats[si].style = bot.style
      h.seats[si].human = false
      if (!h.over && h.toAct === si) {
        d.turnSince = now
        d.dueAt = now + 700
      }
    }
  }
  if (humanSeats(d) === 0) toLobby(d, rng)
}

export function toLobby(d: Doc, _rng: Rng = cryptoRng): void {
  d.status = 'lobby'
  d.seats = []
  d.pending = []
  d.ready = []
  d.hand = null
  d.handNo = 0
  d.bluffs = []
  d.dueAt = 0
  for (const p of d.players) {
    p.hands = 0
    p.net = 0
    p.rebuys = 0
    p.idle = 0
  }
}

// ---------------------------------------------------------------- Spielstart und Händeablauf

export function startGame(d: Doc, now: number, rng: Rng = cryptoRng): void {
  if (d.status === 'playing') fail('Das Spiel läuft schon.')
  if (d.players.length < 2) fail('Zum Starten braucht ihr mindestens 2 Spieler.')
  const humans = shuffle(d.players.slice(), rng)
  const n = Math.max(MIN_SEATS, humans.length)
  const taken = new Set(humans.map((p) => p.name.toLocaleLowerCase('de')))
  d.seats = humans.map((p) => ({ pid: p.pid, name: p.name, stack: d.cfg.startStack }))
  d.pending = []
  while (d.seats.length < n) d.seats.push(botFor(d, taken))
  d.seats = shuffle(d.seats, rng)
  d.status = 'playing'
  d.handNo = 0
  d.button = Math.floor(rng() * d.seats.length)
  dealNext(d, now, rng)
}

function shuffle<T>(a: T[], rng: Rng): T[] {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export function dealNext(d: Doc, now: number, rng: Rng = cryptoRng): void {
  // Wartende setzen sich auf einen Bot-Platz oder, wenn keiner frei ist, an einen neuen Platz
  for (const pid of d.pending.splice(0)) {
    const p = playerOf(d, pid)
    if (!p) continue
    const bi = d.seats.findIndex((s) => s.pid === null)
    const seat: OSeat = { pid, name: p.name, stack: d.cfg.startStack }
    if (bi >= 0) d.seats[bi] = seat
    else if (d.seats.length < MAX_SEATS) d.seats.push(seat)
    else d.pending.push(pid)
  }
  for (const s of d.seats) {
    if (s.stack > 0 && (s.pid !== null || s.stack >= d.cfg.bb * 10)) continue
    if (s.pid !== null) {
      const p = playerOf(d, s.pid)
      if (p) p.rebuys++
    }
    s.stack = d.cfg.startStack
  }
  d.ready = []
  d.handNo++
  d.button = d.handNo === 1 ? d.button : (d.button + 1) % d.seats.length
  const init = d.seats.map((s) => ({ name: s.name, human: s.pid !== null, style: s.style, stack: s.stack }))
  d.hand = startHand(init, d.button, d.cfg.sb, d.cfg.bb, rng)
  d.bluffs = []
  setTurn(d, now, rng)
}

function setTurn(d: Doc, now: number, rng: Rng): void {
  const h = d.hand!
  if (h.over) return
  d.turnSince = now
  const seat = d.seats[h.toAct]
  d.dueAt = seat.pid === null ? now + 700 + Math.floor(rng() * 900) : now + ACT_TIMEOUT_MS
}

function afterAct(d: Doc, now: number, rng: Rng): void {
  const h = d.hand!
  if (!h.over) {
    setTurn(d, now, rng)
    return
  }
  const res = h.result!
  h.seats.forEach((s, i) => {
    d.seats[i].stack = s.stack
    const pid = d.seats[i].pid
    if (pid) {
      const p = playerOf(d, pid)
      if (p) {
        p.hands++
        p.net += res.net[i]
      }
    }
  })
  // Zeit zum Anschauen und für die Auflösung. Wenn alle "Weiter" drücken, geht es früher los.
  d.dueAt = now + (res.showdown ? 30_000 : 12_000)
}

/** Alle online sitzenden Menschen haben "Weiter" gedrückt. */
const everyoneReady = (d: Doc, isOnline: (pid: string) => boolean) => {
  const need = d.seats.filter((s) => s.pid !== null && isOnline(s.pid)).map((s) => s.pid!)
  return need.length > 0 && need.every((pid) => d.ready.includes(pid))
}

export function markReady(d: Doc, pid: string): void {
  if (d.status === 'playing' && d.hand?.over && !d.ready.includes(pid)) d.ready.push(pid)
}

export function applyAction(d: Doc, pid: string, action: Action, now: number, rng: Rng = cryptoRng): void {
  const h = d.hand
  if (d.status !== 'playing' || !h || h.over) fail('Gerade ist keine Aktion möglich.')
  const si = seatOf(d, pid)
  if (si < 0 || h!.toAct !== si) fail('Du bist gerade nicht dran.')
  const lg = legal(h!, si, d.cfg.bb)
  if (action.type === 'check' && !lg.canCheck) fail('Check ist nicht erlaubt.')
  if (action.type === 'raise' && (!lg.canRaise || !Number.isFinite(action.to))) fail('Raise ist nicht erlaubt.')
  d.hand = act(h!, action, d.cfg.bb)
  const p = playerOf(d, pid)
  if (p) p.idle = 0
  afterAct(d, now, rng)
}

/** Wann der Server den nächsten Schritt machen darf (ms, Epoche), oder null. */
export function nextAt(d: Doc, isOnline: (pid: string) => boolean): number | null {
  if (d.status !== 'playing' || !d.hand) return null
  const h = d.hand
  if (h.over) return d.dueAt
  const seat = d.seats[h.toAct]
  if (seat.pid === null) return d.dueAt
  return attends(d, seat.pid, isOnline) ? d.turnSince + ACT_TIMEOUT_MS : d.turnSince + OFFLINE_ACT_MS
}

/** Ein Mensch ist "da", wenn er online ist und nicht schon mehrere Züge verpasst hat. */
const attends = (d: Doc, pid: string, isOnline: (pid: string) => boolean) => isOnline(pid) && (playerOf(d, pid)?.idle ?? 0) < IDLE_AFTER

/** Führt höchstens einen fälligen Schritt aus. Gibt zurück, ob sich etwas geändert hat. */
export function step(d: Doc, now: number, seen: Record<string, number>, rng: Rng = cryptoRng): boolean {
  const online = (pid: string) => now - (seen[pid] ?? 0) < ONLINE_MS
  let changed = false
  if (d.status === 'lobby') {
    const before = d.players.length
    d.players = d.players.filter((p) => now - (seen[p.pid] ?? p.joined) < LOBBY_PRUNE_MS)
    return d.players.length !== before
  }
  for (const p of d.players.slice()) {
    if (now - (seen[p.pid] ?? p.joined) > SEAT_PRUNE_MS) {
      leavePlayer(d, p.pid, now, rng)
      changed = true
    }
  }
  if (d.status !== 'playing') return changed
  if (!d.hand) {
    dealNext(d, now, rng)
    return true
  }
  const h = d.hand
  if (h.over && everyoneReady(d, online)) {
    dealNext(d, now, rng)
    return true
  }
  const due = nextAt(d, online)
  if (due === null || now < due) return changed
  if (h.over) {
    dealNext(d, now, rng)
    return true
  }
  const i = h.toAct
  const seat = d.seats[i]
  const humanHere = seat.pid !== null && attends(d, seat.pid, online)
  if (humanHere) {
    // Zeit abgelaufen: Check, sonst Fold
    const p = playerOf(d, seat.pid!)
    if (p) p.idle++
    const canCheck = legal(h, i, d.cfg.bb).canCheck
    d.hand = act(h, canCheck ? { type: 'check' } : { type: 'fold' }, d.cfg.bb)
  } else {
    const m = botMove(h, i, d.cfg.bb, rng)
    if (m.bluff && m.action.type === 'raise') d.bluffs.push({ seat: i, street: h.street })
    d.hand = act(h, m.action, d.cfg.bb)
  }
  afterAct(d, now, rng)
  return true
}

// ---------------------------------------------------------------- Sicht für einen Spieler

export interface ViewPlayer {
  pid: string
  name: string
  online: boolean
  seated: boolean
  hands: number
  net: number
  rebuys: number
}
export interface ViewSeat {
  pid: string | null
  name: string
  style?: BotId
  stack: number
  online: boolean
}
export interface View {
  v: number
  now: number
  nextAt: number | null
  status: Doc['status']
  cfg: Cfg
  me: string
  mySeat: number
  pending: boolean
  ready: string[]
  players: ViewPlayer[]
  seats: ViewSeat[]
  hand: HandState | null
  handNo: number
  button: number
  bluffs: Doc['bluffs']
}

export function viewFor(d: Doc, pid: string, now: number, seen: Record<string, number>): View {
  const online = (p: string) => now - (seen[p] ?? 0) < ONLINE_MS
  const mySeat = seatOf(d, pid)
  let hand: HandState | null = null
  if (d.hand) {
    hand = structuredClone(d.hand)
    hand.deck = []
    const open = hand.over && !!hand.result?.showdown
    hand.seats.forEach((s, i) => {
      if (i === mySeat) return
      if (open && !s.folded) return
      s.hole = [-1, -1]
    })
  }
  return {
    v: d.v,
    now,
    nextAt: nextAt(d, online),
    status: d.status,
    cfg: d.cfg,
    me: pid,
    mySeat,
    pending: d.pending.includes(pid),
    ready: d.ready,
    players: d.players.map((p) => ({
      pid: p.pid,
      name: p.name,
      online: online(p.pid),
      seated: seatOf(d, p.pid) >= 0,
      hands: p.hands,
      net: p.net,
      rebuys: p.rebuys,
    })),
    seats: d.seats.map((s) => ({ pid: s.pid, name: s.name, style: s.style, stack: s.stack, online: s.pid === null || online(s.pid) })),
    hand,
    handNo: d.handNo,
    button: d.button,
    bluffs: d.bluffs,
  }
}

// ---------------------------------------------------------------- Drehung: eigener Platz wird Platz 0

const rot = (i: number, me: number, n: number) => (i < 0 ? i : (i - me + n) % n)
const rotArr = <T>(a: T[], me: number): T[] => a.map((_, k) => a[(me + k) % a.length])

/** Dreht die Sicht so, dass der eigene Platz Index 0 hat. Dann funktionieren Coach und Tisch unverändert. */
export function rotateHand(h: HandState, me: number): HandState {
  const n = h.n
  if (me <= 0) return { ...h, seats: h.seats.map((s, k) => ({ ...s, id: k, human: k === 0 && me === 0 })) }
  const r = (i: number) => rot(i, me, n)
  const seats = rotArr(h.seats, me).map((s, k) => ({ ...s, id: k, human: k === 0 }))
  const res = h.result
  return {
    ...h,
    button: r(h.button),
    sb: r(h.sb),
    bb: r(h.bb),
    seats,
    toAct: r(h.toAct),
    aggressor: r(h.aggressor),
    runoutAlive: h.runoutAlive.map(r),
    log: h.log.map((l) => ({ ...l, seat: r(l.seat) })),
    result: res
      ? {
          ...res,
          pots: res.pots.map((p) => ({ ...p, eligible: p.eligible.map(r), winners: p.winners.map(r) })),
          payouts: rotArr(res.payouts, me),
          net: rotArr(res.net, me),
          names: rotArr(res.names, me),
          scores: rotArr(res.scores, me),
          best: rotArr<Card[] | null>(res.best, me),
        }
      : null,
  }
}

export const unrotate = (i: number, me: number, n: number) => (i + me) % n
