import { useEffect, useState } from 'react'
import { ArrowLeft, Lock, Star } from '@phosphor-icons/react'
import { LEVELS } from '../../learn/levels'
import { useProgress } from '../../store/progress'
import { useSettings } from '../../store/settings'
import { db, safe } from '../../store/db'
import { Btn } from '../components/Bits'

export function Learn({ onBack, onDrill, onPlacement, onReview, onFacts }: { onBack: () => void; onDrill: (l: number) => void; onPlacement: () => void; onReview: () => void; onFacts: () => void }) {
  const { maxLevel, stars, placed } = useProgress()
  const unlockAll = useSettings((s) => s.unlockAll)
  const [open, setOpen] = useState<number | null>(null)
  const [due, setDue] = useState(0)
  useEffect(() => {
    void safe(() => db.review.count(), 0).then(setDue)
  }, [])

  if (open !== null) {
    const L = LEVELS[open]
    return (
      <div className="screen">
        <div className="topbar">
          <button className="icon-btn" aria-label="Zurück" onClick={() => setOpen(null)}>
            <ArrowLeft size={24} />
          </button>
          <h1>Stufe {L.n}</h1>
        </div>
        <div className="lesson">
          <h2 className="disp" style={{ fontSize: 30, lineHeight: 1.1, margin: '10px 0 4px' }}>
            {L.title}
          </h2>
          <p className="muted">{L.short}</p>
          {L.body.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
          <div className="formula">
            {L.formulas.map((f, i) => (
              <div key={i}>{f}</div>
            ))}
          </div>
          <h3 className="disp" style={{ fontSize: 17, margin: '18px 0 4px' }}>
            Beispiel
          </h3>
          {L.example.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
          <p className="muted" style={{ fontSize: 13.5 }}>
            {L.unlocks}
          </p>
        </div>
        <div style={{ marginTop: 22 }}>
          <Btn variant="primary" block onClick={() => onDrill(L.n)}>
            Drill starten
          </Btn>
        </div>
      </div>
    )
  }

  return (
    <div className="screen">
      <div className="topbar">
        <button className="icon-btn" aria-label="Zurück" onClick={onBack}>
          <ArrowLeft size={24} />
        </button>
        <h1>Lernpfad</h1>
      </div>
      <p className="lead" style={{ marginTop: 4 }}>
        Von Outs bis Bluff-Mathe. Jede Stufe hat eine kurze Erklärung und einen Drill. Ab 80 % richtig schaltest du die nächste Stufe frei. Im Spiel kommen die Fragen erst, wenn du die Stufe erreicht hast.
      </p>
      <div style={{ display: 'flex', gap: 8, margin: '14px 0 6px', flexWrap: 'wrap' }}>
        {!placed && (
          <Btn sm variant="primary" onClick={onPlacement}>
            Einstufungstest
          </Btn>
        )}
        <Btn sm variant="ghost" onClick={onReview}>
          Fehler wiederholen{due ? ` (${due})` : ''}
        </Btn>
        <Btn sm variant="ghost" onClick={onFacts}>
          Spickzettel
        </Btn>
      </div>
      <div className="rail">
        {LEVELS.map((L) => {
          const locked = !unlockAll && L.n > maxLevel
          const s = stars[L.n] ?? 0
          return (
            <button key={L.n} className={`lvl ${locked ? 'locked' : 'open'}`} onClick={() => setOpen(L.n)}>
              <span className="n">{L.n}</span>
              <span>
                <div className="t">{L.title}</div>
                <div className="d">{L.short}</div>
              </span>
              <span className="stars" aria-label={`${s} von 3 Sternen`}>
                {locked ? <Lock size={20} /> : [1, 2, 3].map((i) => <Star key={i} size={18} weight={i <= s ? 'fill' : 'regular'} />)}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
