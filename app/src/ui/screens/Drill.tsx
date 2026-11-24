import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, Star } from '@phosphor-icons/react'
import { gradeAnswer, type QResult, type Question } from '../../coach/questions'
import { genQuestion, placementLevel, placementSet } from '../../learn/drills'
import { LEVELS } from '../../learn/levels'
import { db, safe } from '../../store/db'
import { useProgress } from '../../store/progress'
import { useSettings } from '../../store/settings'
import { Btn } from '../components/Bits'
import { QuestionBody } from './Quiz'

export type DrillSpec = { kind: 'level'; level: number } | { kind: 'placement' } | { kind: 'review' } | { kind: 'mixed' }
const N = 10

export function Drill({ spec, onBack }: { spec: DrillSpec; onBack: () => void }) {
  const [qs, setQs] = useState<(Question & { reviewId?: number })[] | null>(null)
  const [idx, setIdx] = useState(0)
  const [results, setResults] = useState<QResult[]>([])
  const [current, setCurrent] = useState<QResult | undefined>()
  const [done, setDone] = useState(false)
  const [stars, setStars] = useState(0)
  const t0 = useRef(Date.now())
  const four = useSettings((s) => s.fourColor)
  const progress = useProgress()

  const start = async () => {
    setIdx(0)
    setResults([])
    setCurrent(undefined)
    setDone(false)
    t0.current = Date.now()
    if (spec.kind === 'level') setQs(Array.from({ length: N }, () => genQuestion(spec.level)))
    else if (spec.kind === 'placement') setQs(placementSet())
    else if (spec.kind === 'mixed') setQs(Array.from({ length: N }, (_, i) => genQuestion([1, 3, 4, 5, 7][i % 5])))
    else {
      const items = await safe(() => db.review.orderBy('due').limit(N).toArray(), [])
      setQs(items.map((r) => ({ ...r.q, reviewId: r.id })))
    }
  }
  useEffect(() => {
    void start()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const title =
    spec.kind === 'level' ? `Drill: ${LEVELS[spec.level].title}` : spec.kind === 'placement' ? 'Einstufungstest' : spec.kind === 'review' ? 'Fehler wiederholen' : 'Gemischter Drill'

  const finish = async (all: QResult[]) => {
    const ok = all.filter((r) => r.grade !== 'miss').length
    const ratio = all.length ? ok / all.length : 0
    if (spec.kind === 'level') setStars(progress.drillResult(spec.level, ratio))
    if (spec.kind === 'placement') progress.place(placementLevel(ratio))
    if (spec.kind === 'review' && qs) {
      for (let i = 0; i < all.length; i++) {
        const id = qs[i].reviewId
        if (id && all[i].grade !== 'miss') await safe(() => db.review.delete(id), undefined)
      }
    }
    setDone(true)
  }

  const submit = (v: number) => {
    if (!qs) return
    const q = qs[idx]
    const grade = gradeAnswer(q, v)
    const res: QResult = { q, given: v, err: Math.abs(v - q.answer), grade, ms: Date.now() - t0.current }
    setCurrent(res)
    void safe(
      () => db.answers.add({ ts: Date.now(), type: q.type, street: 'drill', drawKind: q.drawKind, given: v, correct: q.answer, err: res.err, grade, ms: res.ms, source: 'drill', level: q.level }),
      0,
    )
    if (grade === 'miss' && spec.kind !== 'review') void safe(() => db.review.add({ due: Date.now() + 86400000, fails: 1, q }), 0)
  }
  const next = () => {
    if (!current || !qs) return
    const all = [...results, current]
    setResults(all)
    setCurrent(undefined)
    t0.current = Date.now()
    if (idx + 1 >= qs.length) void finish(all)
    else setIdx(idx + 1)
  }

  const ok = results.filter((r) => r.grade !== 'miss').length
  return (
    <div className={`screen ${four ? '' : 'two-color'}`}>
      <div className="topbar">
        <button className="icon-btn" aria-label="Zurück" onClick={onBack}>
          <ArrowLeft size={24} />
        </button>
        <h1>{title}</h1>
        {qs && !done && (
          <span className="mono muted">
            {Math.min(idx + 1, qs.length)}/{qs.length}
          </span>
        )}
      </div>
      {!qs && <p className="empty">Lädt …</p>}
      {qs && qs.length === 0 && (
        <div className="empty">
          <p>Keine Fragen zum Wiederholen. Falsch beantwortete Fragen landen automatisch hier.</p>
          <div style={{ marginTop: 14 }}>
            <Btn variant="primary" onClick={onBack}>
              Zurück
            </Btn>
          </div>
        </div>
      )}
      {qs && qs.length > 0 && !done && (
        <div className="edge cutB slab" style={{ marginTop: 10 }} key={qs[idx].id + idx}>
          <QuestionBody q={qs[idx]} onSubmit={submit} result={current} onNext={next} last={idx + 1 >= qs.length} />
        </div>
      )}
      {done && (
        <div style={{ marginTop: 28 }}>
          <div className="big-num">
            {ok}
            <span className="muted">/{results.length}</span>
          </div>
          <p className="lead" style={{ marginTop: 6 }}>
            {spec.kind === 'placement'
              ? `Du startest auf Stufe ${progress.maxLevel}. Fragen darüber schaltest du durch Üben frei.`
              : ok / results.length >= 0.8
                ? 'Stark. Die nächste Stufe ist freigeschaltet.'
                : 'Noch nicht ganz. Ab 80 % schaltest du die nächste Stufe frei.'}
          </p>
          {spec.kind === 'level' && (
            <div className="stars" style={{ margin: '12px 0' }}>
              {[1, 2, 3].map((i) => (
                <Star key={i} size={32} weight={i <= stars ? 'fill' : 'regular'} />
              ))}
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
            <Btn variant="ghost" onClick={onBack} style={{ flex: 1 }}>
              Fertig
            </Btn>
            <Btn variant="primary" onClick={() => void start()} style={{ flex: 1.4 }}>
              Nochmal
            </Btn>
          </div>
        </div>
      )}
    </div>
  )
}
