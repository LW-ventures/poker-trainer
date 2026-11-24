export function comb(n: number, k: number): number {
  if (k < 0 || k > n) return 0
  let r = 1
  for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i
  return Math.round(r)
}

/** Chance, mindestens einen Out in `draws` kommenden Karten zu treffen (0..1). */
export function hitChance(outs: number, unknown: number, draws: number): number {
  if (draws <= 0) return 0
  return 1 - comb(unknown - outs, draws) / comb(unknown, draws)
}

export const unknownCards = (boardLen: number) => 52 - 2 - boardLen

/** Faustregel 2/4 (mit Korrektur ab 9 Outs bei zwei Karten), in Prozent. */
export function ruleOfThumb(outs: number, cardsToCome: number): number {
  if (cardsToCome === 1) return outs * 2
  return outs <= 8 ? outs * 4 : outs * 4 - (outs - 8)
}

/** Nötige Gewinnchance für einen profitablen Call. `pot` enthält schon den Einsatz des Gegners. */
export function potOdds(toCall: number, pot: number): number {
  return toCall / (pot + toCall)
}

/** Erwartungswert eines Calls (Chips, relativ zum Fold). */
export function evCall(equity: number, pot: number, toCall: number): number {
  return equity * pot - (1 - equity) * toCall
}

/** Wie viel muss man bei Treffer später noch gewinnen, damit der Call break-even ist (Implied Odds)? */
export function impliedNeeded(hit: number, pot: number, toCall: number): number {
  if (hit <= 0) return Infinity
  return Math.max(0, ((1 - hit) * toCall) / hit - pot)
}

/** Mindest-Verteidigung: Anteil, den man gegen einen Einsatz weiterspielen muss. */
export const mdf = (bet: number, pot: number) => pot / (pot + bet)

/** Anteil Bluffs in der Setz-Range, damit der Gegner indifferent ist. */
export const bluffShare = (bet: number, pot: number) => bet / (pot + 2 * bet)

export const pct = (x: number, digits = 0) => (x * 100).toFixed(digits).replace('.', ',')
