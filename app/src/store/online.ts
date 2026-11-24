import { create } from 'zustand'
import type { Action, HandState } from '../engine/game'
import type { View } from '../online/core'
import { api, ApiError } from '../online/api'
import { onlineRetry, setOnlineHooks, useGame } from './game'
import { getSettings } from './settings'

const KEY = 'pokerschule-online'
const load = (): { name: string; token: string | null } => {
  try {
    const j = JSON.parse(localStorage.getItem(KEY) ?? '{}')
    return { name: typeof j.name === 'string' ? j.name : '', token: typeof j.token === 'string' ? j.token : null }
  } catch {
    return { name: '', token: null }
  }
}
const save = (name: string, token: string | null) => {
  try {
    localStorage.setItem(KEY, JSON.stringify({ name, token }))
  } catch {
    /* privater Modus: dann gilt der Name nur bis zum Schließen */
  }
}

interface OnlineState {
  name: string
  token: string | null
  /** off: nicht angemeldet, on: in der Lobby oder am Tisch */
  status: 'off' | 'joining' | 'on'
  view: View | null
  error: string | null
  busy: boolean
  join: (name: string) => Promise<boolean>
  resume: () => void
  start: () => Promise<void>
  stop: () => Promise<void>
  ready: () => Promise<void>
  leave: () => Promise<void>
  refresh: () => Promise<void>
}

let pollTimer: ReturnType<typeof setTimeout> | null = null
let polling = false
let inflight = false
let clockOffset = 0 // Serverzeit minus Gerätezeit

export const useOnline = create<OnlineState>((set, get) => {
  const accept = (view: View) => {
    clockOffset = view.now - Date.now()
    set({ view, error: null })
    useGame.getState().applyOnlineView(view)
  }

  function nextDelay(): number {
    const v = get().view
    let d = document.hidden ? 6000 : v?.status === 'playing' ? 1300 : 2500
    if (v?.nextAt) {
      const wait = v.nextAt - (Date.now() + clockOffset) + 80
      if (wait < d) d = Math.max(250, wait)
    }
    return d
  }

  function schedule(ms?: number) {
    if (!polling) return
    if (pollTimer) clearTimeout(pollTimer)
    pollTimer = setTimeout(() => void get().refresh(), ms ?? nextDelay())
  }

  function startPolling() {
    if (polling) return
    polling = true
    document.addEventListener('visibilitychange', onVisible)
    schedule(50)
  }
  function stopPolling() {
    polling = false
    if (pollTimer) clearTimeout(pollTimer)
    pollTimer = null
    document.removeEventListener('visibilitychange', onVisible)
  }
  function onVisible() {
    if (!document.hidden) schedule(50)
  }

  async function call(body: Record<string, unknown>) {
    const { token } = get()
    return api({ ...body, token })
  }

  async function rejoin(): Promise<boolean> {
    const { name, token } = get()
    if (!name) return false
    try {
      const r = await api({ op: 'join', name, token })
      if (r.token) {
        save(name, r.token)
        set({ token: r.token })
      }
      if (r.view) accept(r.view)
      return true
    } catch (e) {
      set({ status: 'off', view: null, error: e instanceof Error ? e.message : 'Fehler' })
      return false
    }
  }

  const fail = (e: unknown) => set({ error: e instanceof Error ? e.message : 'Unbekannter Fehler' })

  setOnlineHooks(
    (a: Action, h: HandState) => {
      void (async () => {
        try {
          const r = await call({ op: 'act', action: a, handNo: get().view?.handNo, n: h.log.length })
          if (r.view) accept(r.view)
        } catch (e) {
          fail(e)
          onlineRetry()
          void get().refresh()
        }
      })()
    },
    () => void get().leave(),
  )

  const saved = load()
  return {
    name: saved.name,
    token: saved.token,
    status: 'off',
    view: null,
    error: null,
    busy: false,

    join: async (nameRaw) => {
      const name = nameRaw.replace(/\s+/g, ' ').trim().slice(0, 14)
      if (!name) {
        set({ error: 'Bitte gib einen Namen ein.' })
        return false
      }
      set({ busy: true, status: 'joining', error: null })
      try {
        // Das gespeicherte Token gilt nur zum selben Namen
        const token = name === get().name ? get().token : null
        const r = await api({ op: 'join', name, token })
        save(name, r.token ?? null)
        set({ name, token: r.token ?? null, status: 'on', busy: false })
        if (r.view) accept(r.view)
        startPolling()
        return true
      } catch (e) {
        set({ busy: false, status: 'off', error: e instanceof Error ? e.message : 'Fehler' })
        return false
      }
    },

    // Beim Öffnen des Lobby-Bildschirms: mit gespeichertem Namen direkt wieder rein
    resume: () => {
      const { name, token, status } = get()
      if (status !== 'off' || !name || !token) return
      void get().join(name)
    },

    start: async () => {
      const s = getSettings()
      set({ busy: true })
      try {
        const r = await call({ op: 'start', cfg: { bb: s.bb, startStack: s.startStack } })
        if (r.view) accept(r.view)
      } catch (e) {
        fail(e)
      }
      set({ busy: false })
    },

    stop: async () => {
      try {
        const r = await call({ op: 'stop' })
        if (r.view) accept(r.view)
      } catch (e) {
        fail(e)
      }
    },

    ready: async () => {
      try {
        const r = await call({ op: 'ready' })
        if (r.view) accept(r.view)
      } catch (e) {
        fail(e)
      }
    },

    leave: async () => {
      stopPolling()
      const { token } = get()
      set({ status: 'off', view: null, error: null })
      useGame.getState().onlineEnded()
      if (token) {
        try {
          await api({ op: 'leave', token })
        } catch {
          /* der Server räumt verwaiste Plätze selbst auf */
        }
      }
    },

    refresh: async () => {
      if (inflight || get().status === 'off') return
      inflight = true
      try {
        const r = await call({ op: 'state' })
        if (r.view) accept(r.view)
      } catch (e) {
        if (e instanceof ApiError && e.code === 'auth') {
          // Server kennt das Token nicht mehr (z. B. nach langer Pause): mit dem Namen neu anmelden
          await rejoin()
        } else {
          fail(e)
        }
      } finally {
        inflight = false
        schedule(get().error ? 3000 : undefined)
      }
    },
  }
})
