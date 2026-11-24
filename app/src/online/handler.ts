// Die Anfragen-Verarbeitung der Server-Funktion. Kennt keine Datenbank, nur das Store-Interface,
// damit sie in Tests mit einem Speicher im Arbeitsspeicher läuft.
import { cryptoRng, type Rng } from '../engine/cards'
import type { Action } from '../engine/game'
import {
  OnlineError,
  applyAction,
  findByToken,
  joinPlayer,
  leavePlayer,
  markReady,
  newDoc,
  startGame,
  step,
  toLobby,
  viewFor,
  type Doc,
} from './core'

export interface Store {
  load(): Promise<{ doc: Doc; seen: Record<string, number> }>
  /** Schreibt nur, wenn die gespeicherte Version noch `expectedV` ist. */
  save(doc: Doc, expectedV: number): Promise<boolean>
  touch(pid: string, now: number): Promise<void>
}

export interface Reply {
  status: number
  json: unknown
}

type Body = {
  op?: string
  name?: string
  token?: string
  action?: { type?: string; to?: number }
  n?: number
  handNo?: number
  cfg?: { bb?: number; startStack?: number }
}

const clampInt = (x: unknown, lo: number, hi: number, dflt: number) => {
  const v = Math.round(Number(x))
  return Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : dflt
}

function toAction(a: Body['action']): Action {
  if (!a) throw new OnlineError('Aktion fehlt.')
  if (a.type === 'fold' || a.type === 'check' || a.type === 'call') return { type: a.type }
  if (a.type === 'raise' && Number.isFinite(Number(a.to))) return { type: 'raise', to: Math.round(Number(a.to)) }
  throw new OnlineError('Unbekannte Aktion.')
}

export async function handle(body: Body, store: Store, now = Date.now(), rng: Rng = cryptoRng): Promise<Reply> {
  const op = String(body?.op ?? '')
  if (!['join', 'state', 'start', 'act', 'ready', 'leave', 'stop'].includes(op)) return { status: 400, json: { error: 'Unbekannte Anfrage.' } }

  for (let attempt = 0; attempt < 5; attempt++) {
    const { doc, seen } = await store.load()
    doc.ready ??= []
    for (const p of doc.players) p.idle ??= 0
    const v0 = doc.v
    let changed = false
    let extra: Record<string, unknown> = {}
    let pid = ''
    try {
      if (op === 'join') {
        const p = joinPlayer(doc, body.name, body.token, now, seen)
        pid = p.pid
        seen[pid] = now
        changed = true
        extra = { token: p.token, pid }
      } else {
        const p = findByToken(doc, body.token)
        if (!p) return { status: 401, json: { error: 'Nicht angemeldet.', code: 'auth' } }
        pid = p.pid
        seen[pid] = now
      }
      await store.touch(pid, now)

      if (op === 'start') {
        if (body.cfg) {
          const bb = clampInt(body.cfg.bb, 2, 2000, doc.cfg.bb)
          doc.cfg = { bb, sb: Math.max(1, Math.floor(bb / 2)), startStack: clampInt(body.cfg.startStack, bb * 20, bb * 1000, doc.cfg.startStack) }
        }
        startGame(doc, now, rng)
        changed = true
      } else if (op === 'act') {
        const h = doc.hand
        const stale = !h || (typeof body.handNo === 'number' && body.handNo !== doc.handNo) || (typeof body.n === 'number' && h.log.length !== body.n)
        if (!stale) {
          applyAction(doc, pid, toAction(body.action), now, rng)
          changed = true
        }
      } else if (op === 'ready') {
        markReady(doc, pid)
        changed = true
      } else if (op === 'leave') {
        leavePlayer(doc, pid, now, rng)
        changed = true
      } else if (op === 'stop') {
        toLobby(doc, rng)
        changed = true
      }
      if (step(doc, now, seen, rng)) changed = true
    } catch (e) {
      if (e instanceof OnlineError) return { status: 400, json: { error: e.message } }
      throw e
    }

    if (changed) {
      doc.v = v0 + 1
      const ok = await store.save(doc, v0)
      if (!ok) continue
    }
    if (op === 'leave') return { status: 200, json: { ok: true } }
    return { status: 200, json: { ...extra, view: viewFor(doc, pid, now, seen) } }
  }
  return { status: 409, json: { error: 'Der Server ist gerade beschäftigt. Versuche es nochmal.' } }
}

export { newDoc }
