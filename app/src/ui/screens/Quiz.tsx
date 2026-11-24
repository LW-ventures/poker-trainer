import { useState } from 'react'
import { ArrowRight, Backspace, Check, Lightbulb } from '@phosphor-icons/react'
import { useGame } from '../../store/game'
import { fmtAnswer, type QResult, type Question } from '../../coach/questions'
import { CardsLine } from '../components/Card'
import { OutsGrid } from '../components/OutsGrid'
import { useSettings } from '../../store/settings'
import { f1 } from '../../util/format'

const VERDICT = { perfect: 'Perfekt', good: 'Gut', miss: 'Daneben' } as const

type BodyProps = {
  q: Question
  onSubmit: (v: number) => void
  result?: QResult
  onNext: () => void
  last: boolean
  progress?: { i: number; n: number }
}

export function QuestionBody(props: BodyProps) {
  return (
    <div className="qbody">
      <QuestionInner {...props} />
    </div>
  )
}

function QuestionInner({
  q,
  onSubmit,
  result,
  onNext,
  last,
  progress,
}: BodyProps) {
  const [input, setInput] = useState('')
  const [hint, setHint] = useState(false)
  const press = (d: string) => setInput((s) => (s.length >= 5 ? s : s === '0' ? d : s + d))
  const unit = q.unit === 'pct' ? '%' : ''
  const submit = () => {
    if (input === '') return
    onSubmit(Number(input))
  }

  if (result) {
    const diff = result.given - q.answer
    return (
      <>
        <div className={`verdict ${result.grade}`}>
          <span className="t">{VERDICT[result.grade]}</span>
          <span className="c">
            {result.grade === 'perfect' && Math.abs(diff) < 0.05 ? 'genau getroffen' : `${diff > 0 ? '+' : '−'}${f1(Math.abs(diff))}${q.unit === 'pct' ? ' Punkte' : ''}`}
          </span>
        </div>
        <div className="compare">
          <div>
            <small>Deine Antwort</small>
            <b>{q.choices ? q.choices.find((c) => c.value === result.given)?.label : fmtAnswer(q, result.given)}</b>
          </div>
          <div>
            <small>Richtig</small>
            <b className="acc">{q.choices ? q.choices.find((c) => c.value === q.answer)?.label : q.unit === 'pct' ? fmtAnswer(q, q.answer) : Math.round(q.answer)}</b>
          </div>
        </div>
        <ul>
          {q.explain.map((l, i) => (
            <li key={i}>{l}</li>
          ))}
        </ul>
        {q.grid && <OutsGrid {...q.grid} />}
        <button className="btn edge cutA primary block" onClick={onNext}>
          {last ? 'Weiter zur Aktion' : 'Nächste Frage'} <ArrowRight size={20} weight="bold" />
        </button>
      </>
    )
  }

  return (
    <>
      {progress && progress.n > 1 && (
        <div className="qprogress">
          {Array.from({ length: progress.n }, (_, i) => (
            <i key={i} className={i <= progress.i ? 'on' : ''} />
          ))}
        </div>
      )}
      <h2>{q.title}</h2>
      {q.cards && (
        <div className="q-cards">
          <CardsLine cards={q.cards.hole} size="sm" />
          {q.cards.board.length > 0 && <CardsLine cards={q.cards.board} size="sm" />}
        </div>
      )}
      <p className="q">{q.prompt}</p>
      <ul>
        {q.lines.map((l, i) => (
          <li key={i}>{l}</li>
        ))}
        {hint && q.hint && (
          <li className="acc" style={{ color: 'var(--accent-text)' }}>
            Tipp: {q.hint}
          </li>
        )}
      </ul>
      {q.choices ? (
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${q.choices.length}, 1fr)`, gap: 8 }}>
          {q.choices.map((c) => (
            <button key={c.value} className="btn edge cutA" onClick={() => onSubmit(c.value)}>
              {c.label}
            </button>
          ))}
        </div>
      ) : (
      <>
      <div className="answer" aria-live="polite">
        <span className={`v ${input ? '' : 'empty'}`}>{input || '0'}</span>
        <span className="u">{unit}</span>
      </div>
      <div className="keypad">
        {['1', '2', '3'].map((d) => (
          <button key={d} className="key edge cutA" onClick={() => press(d)}>
            {d}
          </button>
        ))}
        <button className="key fn edge cutA" aria-label="Löschen" onClick={() => setInput((s) => s.slice(0, -1))}>
          <Backspace size={22} />
        </button>
        {['4', '5', '6'].map((d) => (
          <button key={d} className="key edge cutA" onClick={() => press(d)}>
            {d}
          </button>
        ))}
        <button className="key ok edge cutA" style={{ gridRow: 'span 3' }} disabled={input === ''} onClick={submit}>
          <span style={{ display: 'grid', placeItems: 'center', gap: 4 }}>
            <Check size={26} weight="bold" />
            Prüfen
          </span>
        </button>
        {['7', '8', '9'].map((d) => (
          <button key={d} className="key edge cutA" onClick={() => press(d)}>
            {d}
          </button>
        ))}
        <button className="key fn edge cutA" aria-label="Tipp" onClick={() => setHint(true)}>
          <Lightbulb size={22} />
        </button>
        <button className="key edge cutA" onClick={() => press('0')}>
          0
        </button>
        <button className="key fn edge cutA" aria-label="Alles löschen" onClick={() => setInput('')}>
          C
        </button>
      </div>
      </>
      )}
    </>
  )
}

export function QuizSheet() {
  const quiz = useGame((s) => s.quiz)
  const answerQuiz = useGame((s) => s.answerQuiz)
  const nextQuiz = useGame((s) => s.nextQuiz)
  const feedback = useSettings((s) => s.feedback)
  if (!quiz || quiz.idx >= quiz.questions.length) return null
  const q = quiz.questions[quiz.idx]
  const result = quiz.answered && feedback === 'instant' ? quiz.results[quiz.results.length - 1] : undefined
  return (
    <aside className="coach" aria-label="Coach">
      <div className="coach-card edge cutB" key={q.id}>
        <QuestionBody q={q} onSubmit={answerQuiz} result={result} onNext={nextQuiz} last={quiz.idx + 1 >= quiz.questions.length} progress={{ i: quiz.idx, n: quiz.questions.length }} />
      </div>
    </aside>
  )
}
