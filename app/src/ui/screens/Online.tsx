import { useEffect, useRef, useState } from 'react'
import { ArrowLeft } from '@phosphor-icons/react'
import { useGame } from '../../store/game'
import { useOnline } from '../../store/online'
import { fmtSigned } from '../../util/format'
import { Btn } from '../components/Bits'

/** Gemeinsame Lobby: Name eintragen, warten, spielen. Kein Konto, kein Passwort. */
export function Online({ onBack, onTable }: { onBack: () => void; onTable: () => void }) {
  const o = useOnline()
  const inGame = useGame((s) => s.online)
  const hasHand = useGame((s) => !!s.hand)
  const [name, setName] = useState(o.name)
  const was = useRef(inGame)

  useEffect(() => {
    o.resume()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Sobald der Tisch läuft und man dabei ist, geht es von allein an den Tisch
  useEffect(() => {
    if (inGame && !was.current && hasHand) onTable()
    was.current = inGame
  }, [inGame, hasHand, onTable])

  const v = o.view
  const joined = o.status === 'on' && !!v
  const playing = v?.status === 'playing'
  const seated = !!v && v.mySeat >= 0
  const humans = v?.players.length ?? 0
  const bots = Math.max(0, 4 - humans)

  const leave = () => {
    if (playing && !confirm('Den Tisch verlassen? Ein Bot übernimmt deinen Platz samt Chips.')) return
    void o.leave()
  }
  const stop = () => {
    if (confirm('Das Spiel für alle beenden und zurück in die Lobby?')) void o.stop()
  }

  return (
    <div className="screen">
      <div className="topbar">
        <button className="icon-btn" aria-label="Zurück" onClick={onBack}>
          <ArrowLeft size={24} />
        </button>
        <h1>Mit Freunden</h1>
      </div>

      {!joined && (
        <section className="onl-join">
          <p className="lead">
            Eine gemeinsame Lobby für alle. Kein Konto, kein Passwort: Schreib einen Namen und setz dich dazu. Fehlen Mitspieler, füllen Bots den Tisch auf vier Plätze auf. Fragen und Bewertung vom Coach bleiben dabei.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              void o.join(name)
            }}
          >
            <label className="onl-label" htmlFor="onl-name">
              Dein Name
            </label>
            <input
              id="onl-name"
              className="onl-input"
              value={name}
              maxLength={14}
              autoComplete="off"
              autoCapitalize="words"
              spellCheck={false}
              placeholder="z. B. Theo"
              onChange={(e) => setName(e.target.value)}
            />
            {o.error && (
              <p className="onl-err" role="alert">
                {o.error}
              </p>
            )}
            <Btn variant="primary" block type="submit" disabled={o.busy || !name.trim()} style={{ marginTop: 18, minHeight: 56, fontSize: 18 }}>
              {o.busy ? 'Einen Moment' : 'In die Lobby'}
            </Btn>
          </form>
          <ul className="onl-rules">
            <li>
              <b>2 Spieler</b> + 2 Bots
            </li>
            <li>
              <b>3 Spieler</b> + 1 Bot
            </li>
            <li>
              <b>ab 4 Spielern</b> ohne Bots, bis 8 Plätze
            </li>
          </ul>
        </section>
      )}

      {joined && v && (
        <>
          <p className="lead" style={{ marginBottom: 6 }}>
            Du bist als <b className="acc">{o.name}</b> dabei.
          </p>

          <h2 className="h-section">{playing ? 'Am Tisch' : 'Lobby'}</h2>
          <ul className="onl-list">
            {[...v.players]
              .sort((a, b) => (playing ? b.net - a.net : 0))
              .map((p) => (
                <li key={p.pid} className={p.pid === v.me ? 'me' : ''}>
                  <i className={`dot ${p.online ? 'on' : ''}`} aria-label={p.online ? 'online' : 'offline'} />
                  <span className="nm">
                    {p.name}
                    {p.pid === v.me && <small> · du</small>}
                    {playing && !p.seated && <small> · wartet auf die nächste Hand</small>}
                  </span>
                  {playing && p.seated && <span className={`mono ${p.net > 0 ? 'pos' : p.net < 0 ? 'neg' : 'muted'}`}>{fmtSigned(p.net)}</span>}
                </li>
              ))}
            {playing &&
              v.seats
                .filter((s) => s.pid === null)
                .map((s) => (
                  <li key={s.name} className="bot">
                    <i className="dot on" />
                    <span className="nm">
                      {s.name}
                      <small> · Bot</small>
                    </span>
                  </li>
                ))}
          </ul>

          {o.error && (
            <p className="onl-err" role="alert">
              {o.error}
            </p>
          )}

          {!playing && (
            <>
              <p className="muted" style={{ fontSize: 14, margin: '14px 0 12px' }}>
                {humans < 2 ? 'Warte auf mindestens einen weiteren Spieler. Sie öffnen die App, tippen auf "Mit Freunden" und schreiben ihren Namen.' : `Mit ${humans} Spielern${bots ? ` und ${bots} Bot${bots > 1 ? 's' : ''}` : ''}. Es kann jeder starten.`}
              </p>
              <Btn variant="primary" block disabled={humans < 2 || o.busy} onClick={() => void o.start()} style={{ minHeight: 60, fontSize: 19 }}>
                Spiel starten
              </Btn>
            </>
          )}

          {playing && seated && (
            <Btn variant="primary" block onClick={onTable} style={{ marginTop: 16, minHeight: 60, fontSize: 19 }}>
              Zurück an den Tisch
            </Btn>
          )}
          {playing && !seated && (
            <p className="lead" style={{ marginTop: 14 }}>
              {v.pending ? 'Du bist ab der nächsten Hand am Tisch. Sobald sie beginnt, geht es von allein los.' : 'Du bist noch nicht am Tisch.'}
            </p>
          )}

          <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
            <Btn variant="ghost" block onClick={leave}>
              {playing ? 'Tisch verlassen' : 'Lobby verlassen'}
            </Btn>
            {playing && (
              <Btn variant="ghost" onClick={stop}>
                Für alle beenden
              </Btn>
            )}
          </div>
        </>
      )}
    </div>
  )
}
