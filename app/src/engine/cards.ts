// Karte = Zahl 0..51. Rang = c >> 2 (0 = Zwei ... 12 = Ass), Farbe = c & 3.
export type Card = number
export type Rng = () => number

export const RANKS = '23456789TJQKA'
export const SUITS = ['s', 'h', 'd', 'c'] as const // Pik, Herz, Karo, Kreuz
export const SUIT_GLYPH = ['♠', '♥', '♦', '♣']
export const SUIT_NAME = ['Pik', 'Herz', 'Karo', 'Kreuz']

export const rankOf = (c: Card) => c >> 2
export const suitOf = (c: Card) => c & 3
export const mk = (rank: number, suit: number): Card => rank * 4 + suit
export const rankChar = (c: Card) => RANKS[c >> 2]
export const cardStr = (c: Card) => RANKS[c >> 2] + SUITS[c & 3]

export function parseCard(s: string): Card {
  const r = RANKS.indexOf(s[0].toUpperCase())
  const su = SUITS.indexOf(s[1].toLowerCase() as (typeof SUITS)[number])
  if (r < 0 || su < 0) throw new Error('Ungültige Karte: ' + s)
  return mk(r, su)
}
export const parseCards = (s: string): Card[] => s.trim().split(/\s+/).filter(Boolean).map(parseCard)

export function cryptoRng(): number {
  const a = new Uint32Array(1)
  crypto.getRandomValues(a)
  return a[0] / 4294967296
}

/** Mulberry32, für reproduzierbare Tests */
export function seededRng(seed: number): Rng {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function freshDeck(): Card[] {
  return Array.from({ length: 52 }, (_, i) => i)
}

/** Fisher-Yates */
export function shuffled(rng: Rng = cryptoRng, deck: Card[] = freshDeck()): Card[] {
  const d = deck.slice()
  for (let i = d.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    const t = d[i]
    d[i] = d[j]
    d[j] = t
  }
  return d
}

export function sortDesc(cards: Card[]): Card[] {
  return cards.slice().sort((a, b) => (b >> 2) - (a >> 2) || (a & 3) - (b & 3))
}
