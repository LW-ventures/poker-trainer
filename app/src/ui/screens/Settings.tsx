import { useState } from 'react'
import { ArrowLeft } from '@phosphor-icons/react'
import { BOT_LIST, type BotId } from '../../bots/styles'
import type { Tolerance } from '../../coach/questions'
import { db, safe } from '../../store/db'
import { useProgress } from '../../store/progress'
import { type QuizMode, useSettings } from '../../store/settings'
import { fmt } from '../../util/format'
import { Btn, Seg, Stepper, Switch } from '../components/Bits'

function Row({ k, sub, stack, children }: { k: string; sub?: string; stack?: boolean; children: React.ReactNode }) {
  return (
    <div className={`set-row ${stack ? 'stack' : ''}`}>
      <div className="k">
        {k}
        {sub && <small>{sub}</small>}
      </div>
      {children}
    </div>
  )
}

export function Settings({ onBack }: { onBack: () => void }) {
  const s = useSettings()
  const progress = useProgress()
  const [msg, setMsg] = useState('')
  const botOpts = [{ v: 'random' as BotId | 'random', l: 'Zufall' }, ...BOT_LIST.map((b) => ({ v: b.id as BotId | 'random', l: b.name }))]
  const T = (k: keyof typeof s.types, label: string, sub?: string) => (
    <Row k={label} sub={sub}>
      <Switch on={s.types[k]} onChange={(v) => s.set({ types: { ...s.types, [k]: v } })} label={label} />
    </Row>
  )

  const exportData = async () => {
    const data = {
      sessions: await safe(() => db.sessions.toArray(), []),
      hands: await safe(() => db.hands.toArray(), []),
      decisions: await safe(() => db.decisions.toArray(), []),
      answers: await safe(() => db.answers.toArray(), []),
    }
    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'pokerschule-daten.json'
    a.click()
    setMsg('Daten exportiert.')
  }
  const wipe = async () => {
    if (!confirm('Alle Hände, Antworten und Sessions löschen? Das lässt sich nicht rückgängig machen.')) return
    await Promise.all([db.sessions.clear(), db.hands.clear(), db.decisions.clear(), db.answers.clear(), db.review.clear()])
    progress.reset()
    setMsg('Statistik zurückgesetzt.')
  }

  return (
    <div className="screen">
      <div className="topbar">
        <button className="icon-btn" aria-label="Zurück" onClick={onBack}>
          <ArrowLeft size={24} />
        </button>
        <h1>Einstellungen</h1>
      </div>

      <div className="set-group">
        <h3>Coach</h3>
        <Row k="Wie oft fragen?" sub="„Nur wichtige Spots“ fragt bei Draws, großen Einsätzen und knappen Entscheidungen." stack>
          <Seg<QuizMode> value={s.quizMode} onChange={(v) => s.set({ quizMode: v })} options={[{ v: 'off', l: 'Aus' }, { v: 'important', l: 'Wichtig' }, { v: 'every', l: 'Jede Straße' }]} />
        </Row>
        <Row k="Zeit vor der Frage" sub="So lange kannst du dir das Board ansehen, bevor die Frage erscheint." stack>
          <Seg<number> value={s.quizDelay} onChange={(v) => s.set({ quizDelay: v })} options={[{ v: 0, l: 'Sofort' }, { v: 3, l: '3 s' }, { v: 5, l: '5 s' }, { v: 8, l: '8 s' }, { v: 12, l: '12 s' }]} />
        </Row>
        <Row k="Feedback" sub="Nach jeder Antwort oder gesammelt nach der Hand." stack>
          <Seg value={s.feedback} onChange={(v) => s.set({ feedback: v })} options={[{ v: 'instant', l: 'Sofort' }, { v: 'after', l: 'Nach der Hand' }]} />
        </Row>
        <Row k="Toleranz" sub="Wie genau deine Prozent-Schätzung sein muss. Normal: 2 Punkte perfekt, 5 gut." stack>
          <Seg<Tolerance> value={s.tolerance} onChange={(v) => s.set({ tolerance: v })} options={[{ v: 'strict', l: 'Streng' }, { v: 'normal', l: 'Normal' }, { v: 'loose', l: 'Locker' }]} />
        </Row>
        <h3>Fragetypen</h3>
        {T('preflop', 'Starthand-Stärke')}
        {T('outs', 'Outs zählen')}
        {T('hit', 'Trefferchance')}
        {T('potodds', 'Pot Odds')}
        {T('beats', 'Wer schlägt mich', 'Ab Lernstufe 8')}
        {T('bluffshare', 'Wie oft muss er bluffen', 'Ab Lernstufe 10')}
        <h3>Live-Hilfen am Tisch</h3>
        <Row k="Outs anzeigen">
          <Switch on={s.help.outs} onChange={(v) => s.set({ help: { ...s.help, outs: v } })} label="Outs anzeigen" />
        </Row>
        <Row k="Pot Odds anzeigen">
          <Switch on={s.help.potodds} onChange={(v) => s.set({ help: { ...s.help, potodds: v } })} label="Pot Odds anzeigen" />
        </Row>
        <Row k="Gewinnchance anzeigen" sub="Gegen die geschätzte Range deiner Gegner.">
          <Switch on={s.help.equity} onChange={(v) => s.set({ help: { ...s.help, equity: v } })} label="Gewinnchance anzeigen" />
        </Row>

        <h3>Gegner</h3>
        <Row k="Gegner 1" stack>
          <Seg value={s.opp1} onChange={(v) => s.set({ opp1: v })} options={botOpts} />
        </Row>
        <Row k="Gegner 2" stack>
          <Seg value={s.opp2} onChange={(v) => s.set({ opp2: v })} options={botOpts} />
        </Row>
        <Row k="Gegner 3" stack>
          <Seg value={s.opp3} onChange={(v) => s.set({ opp3: v })} options={botOpts} />
        </Row>
        <Row k="Spielstil der Gegner anzeigen" sub="VPIP und PFR am Platz, damit du sie lesen lernst.">
          <Switch on={s.botHud} onChange={(v) => s.set({ botHud: v })} label="Spielstil anzeigen" />
        </Row>
        {BOT_LIST.map((b) => (
          <div className="botrow" key={b.id}>
            <span className="avatar" style={{ background: 'var(--text-2)' }}>
              {b.name[0]}
            </span>
            <div>
              <b className="disp">
                {b.name}, {b.title}
              </b>
              <div className="muted" style={{ fontSize: 13.5 }}>
                {b.blurb}
              </div>
            </div>
            <div className="hud">
              <span>{b.hud.vpip}/{b.hud.pfr}</span>
            </div>
          </div>
        ))}

        <h3>Chips</h3>
        <Row k="Big Blind" sub="Small Blind ist die Hälfte.">
          <Stepper value={s.bb} step={10} min={10} max={200} onChange={(v) => s.set({ bb: v, sb: v / 2 })} />
        </Row>
        <Row k="Start-Stack" sub={`${Math.round(s.startStack / s.bb)} Big Blinds`}>
          <Stepper value={s.startStack} step={500} min={500} max={20000} onChange={(v) => s.set({ startStack: v })} fmt={fmt} />
        </Row>
        <p className="muted" style={{ fontSize: 13, paddingTop: 6 }}>
          Änderungen gelten ab der nächsten neuen Session.
        </p>

        <h3>Anzeige</h3>
        <Row k="Darstellung" stack>
          <Seg value={s.theme} onChange={(v) => s.set({ theme: v })} options={[{ v: 'auto', l: 'Auto' }, { v: 'dark', l: 'Dunkel' }, { v: 'light', l: 'Hell' }]} />
        </Row>
        <Row k="Vier Farben" sub="Pik schwarz, Herz rot, Karo blau, Kreuz grün. Erleichtert das Zählen von Flush-Outs.">
          <Switch on={s.fourColor} onChange={(v) => s.set({ fourColor: v })} label="Vier Farben" />
        </Row>
        <Row k="Gefoldete Gegnerkarten zeigen" sub="Nach der Hand, zum Lernen.">
          <Switch on={s.showFolded} onChange={(v) => s.set({ showFolded: v })} label="Gefoldete Karten zeigen" />
        </Row>
        <Row k="Tempo der Gegner" stack>
          <Seg value={s.speed} onChange={(v) => s.set({ speed: v })} options={[{ v: 'fast', l: 'Schnell' }, { v: 'normal', l: 'Normal' }, { v: 'slow', l: 'Langsam' }]} />
        </Row>

        <h3>Lernstufe</h3>
        <Row k={`Aktuell Stufe ${progress.maxLevel} von 10`} sub="Fragetypen schalten sich mit der Stufe frei.">
          <Stepper value={progress.maxLevel} step={1} min={1} max={10} onChange={(v) => progress.setLevel(v)} />
        </Row>
        <Row k="Alle Stufen freischalten" sub="Alle Fragetypen sofort im Spiel.">
          <Switch on={s.unlockAll} onChange={(v) => s.set({ unlockAll: v })} label="Alle Stufen freischalten" />
        </Row>

        <h3>Daten</h3>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', paddingTop: 8 }}>
          <Btn sm variant="ghost" onClick={() => void exportData()}>
            Daten exportieren
          </Btn>
          <Btn sm variant="danger" onClick={() => void wipe()}>
            Statistik zurücksetzen
          </Btn>
          <Btn sm variant="ghost" onClick={() => s.reset()}>
            Einstellungen zurücksetzen
          </Btn>
        </div>
        {msg && <p className="acc" style={{ marginTop: 10 }}>{msg}</p>}
        <p className="muted" style={{ fontSize: 13, marginTop: 24 }}>
          Alles bleibt auf diesem Gerät. Es gibt nur Spielgeld, keine Echtgeld-Funktion.
        </p>
      </div>
    </div>
  )
}
