import { Fragment } from 'react'
import { RANKS, type Card } from '../../engine/cards'
import { SuitIcon } from './Card'

export function OutsGrid({ hole, board, outs, dirty }: { hole: Card[]; board: Card[]; outs: Card[]; dirty: Card[] }) {
  return (
    <div>
      <div className="outsgrid" role="img" aria-label="Alle 52 Karten, Outs hervorgehoben">
        {[0, 1, 2, 3].map((s) => (
          <Fragment key={s}>
            <span className={`sl s${s}`}>
              <SuitIcon s={s} />
            </span>
            {Array.from({ length: 13 }, (_, i) => {
              const r = 12 - i
              const c = r * 4 + s
              const cls = hole.includes(c) ? 'mine' : board.includes(c) ? 'bd' : outs.includes(c) ? 'out' : dirty.includes(c) ? 'dirty' : ''
              return (
                <span key={c} className={`c ${cls}`}>
                  {RANKS[r] === 'T' ? '10' : RANKS[r]}
                </span>
              )
            })}
          </Fragment>
        ))}
      </div>
      <div className="legend" style={{ marginTop: 8 }}>
        <span>
          <i style={{ background: 'var(--text)' }} />
          Deine Karten
        </span>
        <span>
          <i style={{ background: 'var(--line-2)' }} />
          Board
        </span>
        <span>
          <i style={{ background: 'var(--pos)' }} />
          Outs
        </span>
        {dirty.length > 0 && (
          <span>
            <i style={{ boxShadow: '0 0 0 1.5px var(--accent) inset' }} />
            Unsichere Outs
          </span>
        )}
      </div>
    </div>
  )
}
