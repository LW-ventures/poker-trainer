import { useMemo } from 'react'

export interface Series {
  values: number[]
  cls: 'ln-a' | 'ln-b'
  area?: boolean
}

export function LineChart({ series, h = 200, yFmt }: { series: Series[]; h?: number; yFmt?: (n: number) => string }) {
  const W = 360
  const pad = { l: 8, r: 8, t: 14, b: 14 }
  const { lo, hi, n } = useMemo(() => {
    const all = series.flatMap((s) => s.values)
    let lo = Math.min(0, ...all)
    let hi = Math.max(0, ...all)
    if (hi - lo < 1) hi = lo + 1
    const m = (hi - lo) * 0.08
    return { lo: lo - m, hi: hi + m, n: Math.max(...series.map((s) => s.values.length)) }
  }, [series])
  const x = (i: number) => pad.l + (n <= 1 ? 0 : (i / (n - 1)) * (W - pad.l - pad.r))
  const y = (v: number) => pad.t + (1 - (v - lo) / (hi - lo)) * (h - pad.t - pad.b)
  const path = (v: number[]) => v.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(p).toFixed(1)}`).join(' ')
  const f = yFmt ?? ((v: number) => String(Math.round(v)))
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${h}`} width="100%" role="img" aria-label="Verlauf">
      <line className="grid" x1={0} x2={W} y1={y(0)} y2={y(0)} />
      <line className="grid" x1={0} x2={W} y1={y(hi)} y2={y(hi)} strokeDasharray="2 4" />
      <line className="grid" x1={0} x2={W} y1={y(lo)} y2={y(lo)} strokeDasharray="2 4" />
      {series.map((s, i) => (
        <g key={i}>
          {s.area && s.values.length > 1 && <path className="ar" d={`${path(s.values)} L${x(s.values.length - 1)} ${y(0)} L${x(0)} ${y(0)} Z`} />}
          <path className={s.cls} d={path(s.values)} strokeLinejoin="round" />
        </g>
      ))}
      <text x={W - 4} y={y(hi) - 3} textAnchor="end">
        {f(hi)}
      </text>
      <text x={W - 4} y={y(0) - 3} textAnchor="end">
        0
      </text>
      <text x={W - 4} y={y(lo) - 3} textAnchor="end">
        {f(lo)}
      </text>
    </svg>
  )
}

export function Spark({ values, w = 220, h = 44 }: { values: number[]; w?: number; h?: number }) {
  if (values.length < 2) return null
  const lo = Math.min(...values)
  const hi = Math.max(...values)
  const r = hi - lo || 1
  const d = values.map((v, i) => `${i ? 'L' : 'M'}${((i / (values.length - 1)) * w).toFixed(1)} ${(h - 3 - ((v - lo) / r) * (h - 6)).toFixed(1)}`).join(' ')
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} aria-hidden>
      <path d={d} fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  )
}

export interface EqSeries {
  name: string
  values: number[]
  color: string
  dash?: string
}
export function EquityChart({ labels, series }: { labels: string[]; series: EqSeries[] }) {
  const W = 360
  const H = 200
  const p = { l: 38, r: 16, t: 14, b: 26 }
  const x = (i: number) => p.l + (labels.length <= 1 ? 0 : (i / (labels.length - 1)) * (W - p.l - p.r))
  const y = (v: number) => p.t + (1 - v) * (H - p.t - p.b)
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Gewinnchance je Straße">
      {[0, 0.25, 0.5, 0.75, 1].map((t) => (
        <g key={t}>
          <line className="grid" x1={p.l} x2={W - p.r} y1={y(t)} y2={y(t)} />
          <text x={p.l - 6} y={y(t) + 3} textAnchor="end">
            {Math.round(t * 100)}
          </text>
        </g>
      ))}
      {labels.map((l, i) => (
        <text key={l} x={x(i)} y={H - 7} textAnchor="middle">
          {l}
        </text>
      ))}
      {series.map((s) => (
        <g key={s.name}>
          <path d={s.values.map((v, i) => `${i ? 'L' : 'M'}${x(i)} ${y(v)}`).join(' ')} fill="none" stroke={s.color} strokeWidth="2.5" strokeDasharray={s.dash} strokeLinejoin="round" />
          {s.values.map((v, i) => (
            <rect key={i} x={x(i) - 3.5} y={y(v) - 3.5} width="7" height="7" fill={s.color} transform={`rotate(45 ${x(i)} ${y(v)})`} />
          ))}
        </g>
      ))}
    </svg>
  )
}
