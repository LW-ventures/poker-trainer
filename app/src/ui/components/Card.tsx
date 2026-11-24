import { motion } from 'motion/react'
import { RANKS, type Card } from '../../engine/cards'

export const rankLabel = (c: Card) => (RANKS[c >> 2] === 'T' ? '10' : RANKS[c >> 2])

/** Die vier Farben als saubere Vektorformen (Pik, Herz, Karo, Kreuz). */
export function SuitIcon({ s, className }: { s: number; className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden fill="currentColor">
      {s === 0 && <path d="M50 3C50 3 7 36 7 60c0 16 12 25 26 25 8 0 13-3 16-8-1 11-5 17-13 20h28c-8-3-12-9-13-20 3 5 8 8 16 8 14 0 26-9 26-25C93 36 50 3 50 3Z" />}
      {s === 1 && <path d="M50 95C50 95 5 64 5 33 5 17 17 6 32 6c8 0 15 4 18 12 3-8 10-12 18-12 15 0 27 11 27 27 0 31-45 62-45 62Z" />}
      {s === 2 && <path d="M50 2 85 50 50 98 15 50Z" />}
      {s === 3 && (
        <>
          <circle cx="50" cy="29" r="22" />
          <circle cx="26" cy="61" r="22" />
          <circle cx="74" cy="61" r="22" />
          <circle cx="50" cy="55" r="12" />
          <path d="M50 52c0 24-4 38-14 46h28C54 90 50 76 50 52Z" />
        </>
      )}
    </svg>
  )
}

// Anordnung der Symbole wie auf echten Karten: [Spalte 0 links, 1 Mitte, 2 rechts, Höhe in %]
const T = 8
const B = 92
const PIPS: Record<number, [number, number][]> = {
  2: [[1, T], [1, B]],
  3: [[1, T], [1, 50], [1, B]],
  4: [[0, T], [2, T], [0, B], [2, B]],
  5: [[0, T], [2, T], [1, 50], [0, B], [2, B]],
  6: [[0, T], [2, T], [0, 50], [2, 50], [0, B], [2, B]],
  7: [[0, T], [2, T], [1, 29], [0, 50], [2, 50], [0, B], [2, B]],
  8: [[0, T], [2, T], [1, 29], [0, 50], [2, 50], [1, 71], [0, B], [2, B]],
  9: [[0, T], [2, T], [0, 36.5], [2, 36.5], [1, 50], [0, 63.5], [2, 63.5], [0, B], [2, B]],
  10: [[0, T], [2, T], [1, 22], [0, 36.5], [2, 36.5], [0, 63.5], [2, 63.5], [1, 78], [0, B], [2, B]],
}

function Face({ card, simple }: { card: Card; simple: boolean }) {
  const r = card >> 2
  const s = card & 3
  const label = rankLabel(card)
  const idx = (pos: 'tl' | 'br') => (
    <span className={`idx ${pos} ${label === '10' ? 'ten' : ''}`}>
      <b>{label}</b>
      <SuitIcon s={s} />
    </span>
  )
  let center: React.ReactNode
  if (simple || r === 12) {
    center = <span className={simple ? 'solo' : 'ace'}><SuitIcon s={s} /></span>
  } else if (r >= 9) {
    center = (
      <span className="court">
        <b>{label}</b>
        <span className="cp tl"><SuitIcon s={s} /></span>
        <span className="cp br"><SuitIcon s={s} /></span>
      </span>
    )
  } else {
    const n = r + 2
    center = (
      <span className="pips">
        {PIPS[n].map(([col, y], i) => (
          <span key={i} className="pip" style={{ left: `${col * 50}%`, top: `${y}%`, transform: `translate(-50%, -50%)${y > 50 ? ' rotate(180deg)' : ''}` }}>
            <SuitIcon s={s} />
          </span>
        ))}
      </span>
    )
  }
  return (
    <>
      {idx('tl')}
      {center}
      {idx('br')}
    </>
  )
}

interface Props {
  card?: Card
  size?: 'sm' | 'md' | 'lg' | 'xl'
  back?: boolean
  slot?: boolean
  dim?: boolean
  hit?: boolean
  tilt?: number
  deal?: boolean
  flip?: boolean
  delay?: number
}

export function PlayingCard({ card, size = 'md', back, slot, dim, hit, tilt = 0, deal, flip, delay = 0 }: Props) {
  const cls = ['pc', size, back ? 'back' : '', slot ? 'slot' : '', dim ? 'dim' : '', hit ? 'hit' : '']
  const face = card !== undefined && !back && !slot
  if (face) cls.push('s' + (card! & 3))
  const inner = face ? <Face card={card!} simple={size === 'sm'} /> : null
  const label = face ? `${rankLabel(card!)} ${['Pik', 'Herz', 'Karo', 'Kreuz'][card! & 3]}` : back ? 'Verdeckte Karte' : undefined
  if (flip)
    return (
      <motion.div
        className={cls.join(' ')}
        role={label ? 'img' : undefined}
        aria-label={label}
        style={{ rotate: tilt }}
        initial={{ rotateY: 90, opacity: 0.2 }}
        animate={{ rotateY: 0, opacity: 1 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1], delay }}
      >
        {inner}
      </motion.div>
    )
  if (!deal)
    return (
      <div className={cls.join(' ')} style={{ rotate: `${tilt}deg` }} role={label ? 'img' : undefined} aria-label={label}>
        {inner}
      </div>
    )
  return (
    <motion.div
      className={cls.join(' ')}
      role={label ? 'img' : undefined}
      aria-label={label}
      initial={{ opacity: 0, y: -26, rotate: tilt - 10, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, rotate: tilt, scale: 1 }}
      transition={{ type: 'spring', stiffness: 260, damping: 22, delay }}
    >
      {inner}
    </motion.div>
  )
}

export function CardsLine({ cards, size = 'md' }: { cards: Card[]; size?: Props['size'] }) {
  return (
    <div className="cards-line">
      {cards.map((c) => (
        <PlayingCard key={c} card={c} size={size} />
      ))}
    </div>
  )
}

export function Chip({ color, size = 22 }: { color?: string; size?: number }) {
  return <i className="chip" style={{ ['--s' as string]: `${size}px`, ['--chip-c' as string]: color }} />
}

export function ChipStack({ n = 3 }: { n?: number }) {
  const cols = ['#e3b341', '#d6402f', '#2563c9']
  return (
    <span className="chipstack">
      {Array.from({ length: n }, (_, i) => (
        <Chip key={i} color={cols[i % cols.length]} />
      ))}
    </span>
  )
}
