// Supabase Edge Function "poker": leitet den Online-Tisch. Wird mit rolldown zu einer Datei gebündelt.
import { handle, newDoc, type Store } from '../src/online/handler'
import type { Doc } from '../src/online/core'

declare const Deno: {
  env: { get(k: string): string | undefined }
  serve(h: (req: Request) => Response | Promise<Response>): void
}

const BASE = Deno.env.get('SUPABASE_URL')!
const KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

async function rest(path: string, init: RequestInit = {}) {
  const res = await fetch(`${BASE}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json', ...(init.headers as Record<string, string>) },
  })
  if (!res.ok) throw new Error(`DB ${res.status}: ${await res.text()}`)
  const text = await res.text()
  return text ? JSON.parse(text) : null
}

const store: Store = {
  async load() {
    let rows = (await rest('pk_secret?id=eq.1&select=v,doc')) as { v: number; doc: Doc }[]
    if (!rows.length) {
      const doc = newDoc()
      await rest('pk_secret', { method: 'POST', headers: { Prefer: 'resolution=ignore-duplicates' }, body: JSON.stringify({ id: 1, v: 0, doc }) })
      rows = (await rest('pk_secret?id=eq.1&select=v,doc')) as { v: number; doc: Doc }[]
    }
    const doc = rows[0].doc
    doc.v = rows[0].v
    const seenRows = (await rest('pk_seen?select=pid,seen')) as { pid: string; seen: number }[]
    const seen: Record<string, number> = {}
    for (const r of seenRows) seen[r.pid] = Number(r.seen)
    return { doc, seen }
  },
  async save(doc, expectedV) {
    const upd = (await rest(`pk_secret?id=eq.1&v=eq.${expectedV}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({ v: doc.v, doc }),
    })) as unknown[]
    if (!upd.length) return false
    // Signal für Realtime: alle Clients holen sich dann ihre Sicht
    await rest('pk_table?id=eq.1', { method: 'PATCH', body: JSON.stringify({ v: doc.v, ts: new Date().toISOString() }) })
    return true
  },
  async touch(pid, now) {
    await rest('pk_seen?on_conflict=pid', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates' }, body: JSON.stringify({ pid, seen: now }) })
  },
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const body = await req.json()
    const out = await handle(body, store)
    return new Response(JSON.stringify(out.json), { status: out.status, headers: { ...cors, 'Content-Type': 'application/json' } })
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Serverfehler', detail: String((e as Error)?.message ?? e) }), {
      status: 500,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }
})
