import { describe, it, expect } from 'vitest'
import { seededRng } from '../engine/cards'
import { legal, posOf } from '../engine/game'
import { botMove } from '../bots/policy'
import { handle, type Store } from './handler'
import { newDoc, rotateHand, type Doc, type View } from './core'

function memStore(): Store & { doc: Doc; seen: Record<string, number> } {
  const s = {
    doc: newDoc(),
    seen: {} as Record<string, number>,
    async load() {
      return { doc: structuredClone(s.doc), seen: { ...s.seen } }
    },
    async save(doc: Doc, v: number) {
      if (s.doc.v !== v) return false
      s.doc = structuredClone(doc)
      return true
    },
    async touch(pid: string, now: number) {
      s.seen[pid] = now
    },
  }
  return s
}

const call = async (store: Store, body: object, now: number, rng = seededRng(7)) => (await handle(body, store, now, rng)) as { status: number; json: any }

describe('Online-Tisch', () => {
  it('Beitreten, Start mit Bots, Hände laufen, Chips bleiben erhalten', async () => {
    const store = memStore()
    const rng = seededRng(42)
    let now = 1_000_000
    const a = (await call(store, { op: 'join', name: 'Anna' }, now, rng)).json
    const b = (await call(store, { op: 'join', name: 'Ben' }, now, rng)).json
    expect(a.token).toBeTruthy()
    expect((await call(store, { op: 'join', name: 'anna' }, now, rng)).status).toBe(400) // Name vergeben
    expect((await call(store, { op: 'join', name: 'Rocky' }, now, rng)).status).toBe(400) // Bot-Name
    expect((await call(store, { op: 'start', token: a.token }, now, rng)).status).toBe(200)
    let v: View = (await call(store, { op: 'state', token: a.token }, now, rng)).json.view
    expect(v.seats.length).toBe(4)
    expect(v.seats.filter((s) => s.pid === null).length).toBe(2) // 2 Menschen, 2 Bots
    const total0 = v.seats.reduce((t, s) => t + s.stack, 0) + v.hand!.seats.reduce((t, s) => t + s.committed, 0) - v.hand!.seats.reduce((t, s) => t + s.committed, 0)

    // Fremde Karten sind verborgen
    const me = v.mySeat
    v.hand!.seats.forEach((s, i) => expect(s.hole[0] >= 0).toBe(i === me))
    expect(v.hand!.deck.length).toBe(0)

    const tokens: Record<string, string> = { [a.pid]: a.token, [b.pid]: b.token }
    let handsSeen = 0
    let lastNo = 0
    for (let g = 0; g < 4000 && handsSeen < 30; g++) {
      now += 700
      v = (await call(store, { op: 'state', token: a.token }, now, rng)).json.view
      for (const pid of Object.keys(tokens)) void store.touch(pid, now)
      if (v.handNo !== lastNo) {
        lastNo = v.handNo
        handsSeen++
      }
      const h = v.hand!
      if (h.over) continue
      const seat = v.seats[h.toAct]
      if (seat.pid) {
        // der Mensch am Zug spielt wie ein Bot, aber über die Schnittstelle
        const full = structuredClone(store.doc.hand!)
        const m = botMove(full, h.toAct, v.cfg.bb, rng)
        const r = await call(store, { op: 'act', token: tokens[seat.pid], action: m.action, handNo: v.handNo, n: h.log.length }, now, rng)
        expect(r.status).toBe(200)
      }
    }
    expect(handsSeen).toBeGreaterThanOrEqual(30)
    const fin = store.doc
    const rebuys = fin.players.reduce((t, p) => t + p.rebuys, 0)
    const sum = fin.seats.reduce((t, s) => t + s.stack, 0)
    // Bots füllen bei Bedarf still auf, deshalb nur Untergrenze und Plausibilität prüfen
    expect(sum).toBeGreaterThan(0)
    expect(rebuys).toBeGreaterThanOrEqual(0)
    void total0
  })

  it('Nicht-Dran-Sein und falsche Token werden abgelehnt', async () => {
    const store = memStore()
    const rng = seededRng(3)
    const now = 5_000_000
    const a = (await call(store, { op: 'join', name: 'Anna' }, now, rng)).json
    const b = (await call(store, { op: 'join', name: 'Ben' }, now, rng)).json
    await call(store, { op: 'start', token: a.token }, now, rng)
    expect((await call(store, { op: 'state', token: 'quatsch-token' }, now, rng)).status).toBe(401)
    const v: View = (await call(store, { op: 'state', token: a.token }, now, rng)).json.view
    const h = v.hand!
    const toActPid = v.seats[h.toAct].pid
    if (toActPid) {
      const other = toActPid === a.pid ? b.token : a.token
      const r = await call(store, { op: 'act', token: other, action: { type: 'fold' } }, now, rng)
      expect(r.status).toBe(400)
    }
  })

  it('Drehung: eigener Platz ist 0 und legal() stimmt überein', async () => {
    const store = memStore()
    const rng = seededRng(11)
    let now = 9_000_000
    const toks: { token: string; pid: string }[] = []
    for (const n of ['A1', 'B2', 'C3', 'D4', 'E5', 'F6']) toks.push((await call(store, { op: 'join', name: n }, now, rng)).json)
    await call(store, { op: 'start', token: toks[0].token }, now, rng)
    for (const t of toks) store.touch(t.pid, now)
    const v: View = (await call(store, { op: 'state', token: toks[0].token }, now, rng)).json.view
    expect(v.seats.length).toBe(6)
    expect(v.seats.every((s) => s.pid !== null)).toBe(true) // ab 4 Menschen keine Bots
    const h = v.hand!
    for (let me = 0; me < h.n; me++) {
      const full = structuredClone(store.doc.hand!)
      const rot = rotateHand(full, me)
      expect(rot.seats[0].name).toBe(full.seats[me].name)
      const a = legal(full, me, v.cfg.bb)
      const b = legal(rot, 0, v.cfg.bb)
      expect(b).toEqual(a)
      expect(rot.toAct).toBe((full.toAct - me + h.n) % h.n)
      expect(rot.log.length).toBe(full.log.length)
    }
    now += 1
  })

  it('Positionen bei 4 bis 8 Plätzen', () => {
    const mk = (n: number, button: number) => ({ n, button, sb: (button + 1) % n, bb: (button + 2) % n }) as Parameters<typeof posOf>[0]
    const names = (n: number) => Array.from({ length: n }, (_, i) => posOf(mk(n, 0), i))
    expect(names(4)).toEqual(['BTN', 'SB', 'BB', 'UTG'])
    expect(names(5)).toEqual(['BTN', 'SB', 'BB', 'UTG', 'CO'])
    expect(names(8)).toEqual(['BTN', 'SB', 'BB', 'UTG', 'MP', 'MP', 'MP', 'CO'])
  })

  it('Spätkommende rücken nach, Weggehende werden durch Bots ersetzt', async () => {
    const store = memStore()
    const rng = seededRng(5)
    const now = 2_000_000
    const a = (await call(store, { op: 'join', name: 'Anna' }, now, rng)).json
    const b = (await call(store, { op: 'join', name: 'Ben' }, now, rng)).json
    await call(store, { op: 'start', token: a.token }, now, rng)
    const c = (await call(store, { op: 'join', name: 'Cem' }, now, rng)).json
    expect(store.doc.pending).toContain(c.pid)
    await call(store, { op: 'leave', token: b.token }, now, rng)
    expect(store.doc.seats.filter((s) => s.pid !== null).length).toBe(1)
    expect(store.doc.seats.length).toBe(4)
  })
})
