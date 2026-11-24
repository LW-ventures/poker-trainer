import { useState } from 'react'
import { X } from '@phosphor-icons/react'
import { BOTS } from '../../bots/styles'
import { STREET_DE } from '../../engine/game'
import { fmtAnswer } from '../../coach/questions'
import { useGame } from '../../store/game'
import { f1, fmt, fmtBB, fmtSigned } from '../../util/format'
import { Btn } from '../components/Bits'
import { CardsLine } from '../components/Card'
import { EquityChart } from '../components/Charts'
import { RangeMatrix } from '../components/RangeMatrix'
import { useSettings } from '../../store/settings'

const GRADE_TXT = { good: 'Gut', ok: 'Grenzwertig', bad: 'Fehler' }

export function Resolution({ onClose }: { onClose: () => void }) {
  const r = useGame((s) => s.resolution)
  const dealHand = useGame((s) => s.dealHand)
  const closeRes = useGame((s) => s.closeResolution)
  const four = useSettings((s) => s.fourColor)
  const [showRange, setShowRange] = useState<number | null>(null)
  if (!r) return null
  const luck = r.net - r.evNet
  const oppColors = ['var(--text)', 'var(--text-2)', 'var(--muted)', 'var(--text)', 'var(--text-2)', 'var(--muted)', 'var(--text)']
  const oppDash = [undefined, '6 4', '2 4', '10 3 2 3', '4 4', '1 3', '14 4']
  const oppIdx = (id: number) => r.curveSeats.filter((i) => i !== 0).indexOf(id)
  const colorOf = (id: number) => (id === 0 ? 'var(--accent)' : oppColors[oppIdx(id) % 7])
  const heroIdx = r.curveSeats.indexOf(0)
  const bluffSeats = [...new Set(r.bluffs.map((b) => b.seat))]

  return (
    <div className={`overlay ${four ? '' : 'two-color'}`} role="dialog" aria-label="Auflösung">
      <div className="res">
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <span className="muted" style={{ flex: 1 }}>
            Hand {r.handNo} · Pot {fmt(r.pot)}
          </span>
          <button className="icon-btn" aria-label="Schließen" onClick={() => { closeRes(); onClose() }}>
            <X size={24} />
          </button>
        </div>
        <div className={`res-net ${r.net > 0 ? 'pos' : r.net < 0 ? 'neg' : ''}`}>{fmtSigned(r.net)}</div>
        <p className="lead" style={{ marginTop: 6 }}>
          {fmtBB(r.net, r.bb)} BB.{' '}
          {r.evNet !== r.net ? (
            <>
              Nach Gewinnchance beim All-in hättest du im Schnitt <b className="mono">{fmtSigned(r.evNet)}</b> gewonnen, du hattest also {luck >= 0 ? 'Glück' : 'Pech'} (<span className="mono">{fmtSigned(luck)}</span>).
            </>
          ) : r.decisions.length ? (
            'Das Ergebnis zählt nicht, die Entscheidungen schon. Hier die Bewertung.'
          ) : (
            'Du hast diese Hand früh abgegeben.'
          )}
        </p>

        {bluffSeats.length > 0 && (
          <p style={{ margin: '14px 0 0' }}>
            <span className="stamp">BLUFF!</span>{' '}
            <span className="lead">
              {bluffSeats.map((s) => r.seats[s].name).join(' und ')} {bluffSeats.length > 1 ? 'haben' : 'hat'} in dieser Hand mit schwachen Karten gesetzt.
            </span>
          </p>
        )}

        <h2 className="h-section">Am Tisch</h2>
        <div className="res-players">
          {r.seats.map((s) => (
            <div className="res-p" key={s.id} style={{ opacity: s.folded ? 0.6 : 1 }}>
              <div className="cards">{s.shown ? <CardsLine cards={s.hole} size="sm" /> : <CardsLine cards={[]} />}</div>
              <div>
                <div className="nm">
                  {s.name}
                  {s.style && <span className="muted" style={{ fontWeight: 400, fontSize: 13 }}> · {BOTS[s.style].title}</span>}
                </div>
                <div className="hn">{s.folded ? 'gefoldet' : (s.handName ?? 'ohne Showdown')}</div>
              </div>
              <div className={`net ${s.net > 0 ? 'pos' : s.net < 0 ? 'neg' : ''}`}>{fmtSigned(s.net)}</div>
            </div>
          ))}
        </div>
        {r.board.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <CardsLine cards={r.board} size="sm" />
          </div>
        )}

        {r.curve.length >= 2 && heroIdx >= 0 && (
          <>
            <h2 className="h-section">Gewinnchance je Straße</h2>
            <EquityChart
              labels={r.curve.map((c) => STREET_DE[c.street])}
              series={r.curveSeats.map((id, k) => ({
                name: r.seats[id].name,
                values: r.curve.map((c) => c.eq[k]),
                color: colorOf(id),
                dash: id === 0 ? undefined : oppDash[oppIdx(id) % 7],
              }))}
            />
            <div className="legend" style={{ marginTop: 6 }}>
              {r.curveSeats.map((id) => (
                <span key={id}>
                  <i style={{ background: colorOf(id) }} />
                  {r.seats[id].name}
                </span>
              ))}
            </div>
            <p className="lead" style={{ marginTop: 8, fontSize: 14 }}>
              Gegen die echten Karten. Während der Hand kennst du sie nicht, deshalb rechnest du gegen die Range.
            </p>
          </>
        )}

        {r.decisions.some((d) => d.grade) && (
          <>
            <h2 className="h-section">Deine Entscheidungen</h2>
            {r.decisions.filter((d) => d.grade).map((d, i) => (
              <div className="decl" key={i}>
                <div>
                  <div className="mono" style={{ fontSize: 13 }}>
                    {STREET_DE[d.street]}
                  </div>
                  <span className={`grade ${d.grade?.grade ?? 'none'}`}>{d.grade?.grade ? GRADE_TXT[d.grade.grade] : 'offen'}</span>
                </div>
                <div>
                  <b className="disp">{d.action}</b>
                  {d.toCall > 0 && <span className="muted"> · {fmt(d.toCall)} in Pot {fmt(d.pot)}</span>}
                  <p className="lead" style={{ fontSize: 14.5 }}>
                    {d.grade?.text}
                  </p>
                  {d.grade && d.grade.lossBB > 0.05 && <span className="mono neg" style={{ fontSize: 13 }}>−{f1(d.grade.lossBB)} BB EV</span>}
                  {d.facedBluff && <span className="muted" style={{ fontSize: 13 }}> · gegen einen Bluff</span>}
                </div>
              </div>
            ))}
          </>
        )}

        {r.quiz.length > 0 && (
          <>
            <h2 className="h-section">Deine Antworten</h2>
            {r.quiz.map((q, i) => (
              <div className="decl" key={i}>
                <span className={`grade ${q.grade === 'perfect' ? 'good' : q.grade === 'good' ? 'ok' : 'bad'}`}>{q.grade === 'perfect' ? 'Perfekt' : q.grade === 'good' ? 'Gut' : 'Daneben'}</span>
                <div>
                  <b className="disp">{q.q.title}</b>
                  <p className="lead" style={{ fontSize: 14.5 }}>
                    Du: <span className="mono">{fmtAnswer(q.q, q.given)}</span> · richtig: <span className="mono acc">{q.q.unit === 'pct' ? fmtAnswer(q.q, q.q.answer) : Math.round(q.q.answer)}</span> · {(q.ms / 1000).toFixed(1).replace('.', ',')} s
                  </p>
                </div>
              </div>
            ))}
          </>
        )}

        {r.matrices.length > 0 && (
          <>
            <h2 className="h-section">Geschätzte Ranges</h2>
            <p className="lead" style={{ fontSize: 14.5 }}>
              Aus den Aktionen der Gegner berechnet. Je heller ein Feld, desto wahrscheinlicher die Hand. Gleichfarbige Hände stehen oberhalb der Diagonale, Paare auf der Diagonale.
            </p>
            <div className="seg" style={{ margin: '10px 0' }}>
              {r.matrices.map((m) => (
                <button key={m.seat} className={`edge cutA ${showRange === m.seat ? 'on' : ''}`} onClick={() => setShowRange(showRange === m.seat ? null : m.seat)}>
                  {m.name}
                </button>
              ))}
            </div>
            {showRange !== null && <RangeMatrix matrix={r.matrices.find((m) => m.seat === showRange)!.matrix} />}
          </>
        )}
      </div>
      <div className="sticky-cta">
        <Btn variant="ghost" style={{ flex: 1 }} onClick={() => { closeRes(); onClose() }}>
          Zum Tisch
        </Btn>
        <Btn variant="primary" style={{ flex: 1.4 }} onClick={() => { closeRes(); dealHand() }}>
          Nächste Hand
        </Btn>
      </div>
    </div>
  )
}
