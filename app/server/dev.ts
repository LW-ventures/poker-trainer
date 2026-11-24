// Lokaler Testserver mit Speicher im Arbeitsspeicher (nur zum Entwickeln, wird nicht veröffentlicht).
import { createServer } from 'node:http'
import { handle, newDoc, type Store } from '../src/online/handler'
import type { Doc } from '../src/online/core'

let doc: Doc = newDoc()
const seen: Record<string, number> = {}
const store: Store = {
  async load() {
    return { doc: structuredClone(doc), seen: { ...seen } }
  },
  async save(next, v) {
    if (doc.v !== v) return false
    doc = structuredClone(next)
    return true
  },
  async touch(pid, now) {
    seen[pid] = now
  },
}

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

createServer((req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, cors).end()
    return
  }
  let raw = ''
  req.on('data', (c) => (raw += c))
  req.on('end', async () => {
    try {
      const out = await handle(JSON.parse(raw || '{}'), store)
      res.writeHead(out.status, { ...cors, 'Content-Type': 'application/json' }).end(JSON.stringify(out.json))
    } catch (e) {
      res.writeHead(500, { ...cors, 'Content-Type': 'application/json' }).end(JSON.stringify({ error: 'Serverfehler', detail: String(e) }))
    }
  })
}).listen(8787, () => console.log('Testserver auf http://localhost:8787'))
