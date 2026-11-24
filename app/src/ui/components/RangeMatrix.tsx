import { typeByCell } from '../../engine/ranges'

export function RangeMatrix({ matrix, you }: { matrix: number[][]; you?: { row: number; col: number } }) {
  const max = Math.max(...matrix.flat(), 1e-9)
  return (
    <div className="matrix" role="img" aria-label="Range-Matrix, 13 mal 13 Starthände">
      {matrix.flatMap((row, r) =>
        row.map((w, c) => {
          const t = typeByCell(r, c)
          const a = Math.pow(w / max, 0.6)
          return (
            <div key={`${r}-${c}`} className={`m ${you && you.row === r && you.col === c ? 'you' : ''}`} title={t.name}>
              <i style={{ opacity: a * 0.95 }} />
              <span style={{ color: a > 0.55 ? 'var(--on-accent)' : undefined }}>{t.name}</span>
            </div>
          )
        }),
      )}
    </div>
  )
}
