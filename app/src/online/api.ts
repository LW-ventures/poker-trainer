import type { View } from './core'

const PROD_URL = 'https://mkqaqggjbzmfxqxgxpsr.supabase.co/functions/v1/poker'
// Beim Entwickeln kann ein lokaler Testserver benutzt werden (localStorage "pk-local" = "1")
const local = import.meta.env.DEV && typeof localStorage !== 'undefined' && localStorage.getItem('pk-local') === '1'
export const FN_URL = local ? 'http://localhost:8787' : PROD_URL

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
  ) {
    super(message)
  }
}

export interface Reply {
  view?: View
  token?: string
  pid?: string
  ok?: boolean
}

export async function api(body: Record<string, unknown>): Promise<Reply> {
  let res: Response
  try {
    res = await fetch(FN_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  } catch {
    throw new ApiError('Keine Verbindung zum Server.', 0, 'net')
  }
  const json = (await res.json().catch(() => ({}))) as Reply & { error?: string; code?: string }
  if (!res.ok) throw new ApiError(json.error ?? 'Der Server antwortet nicht richtig.', res.status, json.code)
  return json
}
