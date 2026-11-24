export const fmt = (n: number) => Math.round(n).toLocaleString('de-DE')
export const fmtSigned = (n: number) => (n > 0 ? '+' : n < 0 ? '\u2212' : '') + Math.abs(Math.round(n)).toLocaleString('de-DE')
export const fmtBB = (chips: number, bb: number, d = 1) => {
  const v = chips / bb
  return (v > 0 ? '+' : v < 0 ? '\u2212' : '') + Math.abs(v).toFixed(d).replace('.', ',')
}
export const f1 = (x: number) => x.toFixed(1).replace('.', ',')
export const pc = (x: number, d = 0) => (x * 100).toFixed(d).replace('.', ',') + ' %'
