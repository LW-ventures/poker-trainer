import { useEffect, useState } from 'react'
import { ArrowLeft } from '@phosphor-icons/react'
import { BOTS } from '../../bots/styles'
import { loadStats, type Agg, type Period } from '../../stats/aggregate'
import { f1, fmt, fmtBB, fmtSigned } from '../../util/format'
import { Btn, Seg } from '../components/Bits'
import { LineChart } from '../components/Charts'
import { useSettings } from '../../store/settings'

const TYPE_NAMES: Record<string, string> = {
  outs: 'Outs zählen',
  hit: 'Trefferchance',
  potodds: 'Pot Odds',
  preflopEq: 'Starthand-Stärke',
  beats: 'Wer schlägt mich',
  bluffshare: 'Bluff-Anteil',
  implied: 'Implied Odds',
  combos: 'Kombinationen',
  handrank: 'Handrankings',
  range: 'Ranges',
}

function Row({ k, sub, v, zone, val, children }: { k: string; sub?: string; v: string; zone?: [number, number]; val?: number; children?: React.ReactNode }) {
  return (
    <div className="rowstat">
      <div className="k">
        {k}
        {sub && <small>{sub}</small>}
      </div>
      <div className="v">{v}</div>
      {zone && val !== undefined && (
        <div className="rangebar" aria-hidden>
          <div className="zone" style={{ left: `${zone[0]}%`, width: `${zone[1] - zone[0]}%` }} />
          <div className="dot" style={{ left: `${Math.max(0, Math.min(100, val))}%` }} />
        </div>
      )}
      {children}
    </div>
  )
}

export function Stats({ onBack, onDrill }: { onBack: () => void; onDrill: (level: number) => void }) {
  const [period, setPeriod] = useState<Period>('all')
  const [bot, setBot] = useState('all')
  const [a, setA] = useState<Agg | null>(null)
  const bb = useSettings((s) => s.bb)
  useEffect(() => {
    void loadStats(period, bot).then(setA)
  }, [period, bot])

  return (
    <div className="screen">
      <div className="topbar">
        <button className="icon-btn" aria-label="Zurück" onClick={onBack}>
          <ArrowLeft size={24} />
        </button>
        <h1>Statistik</h1>
      </div>
      <div className="filters" style={{ marginTop: 6 }}>
        <Seg<Period> value={period} onChange={setPeriod} options={[{ v: 'today', l: 'Heute' }, { v: '7', l: '7 Tage' }, { v: '30', l: '30 Tage' }, { v: 'all', l: 'Alles' }]} />
      </div>
      <div className="filters" style={{ marginTop: 8 }}>
        <Seg<string> value={bot} onChange={setBot} options={[{ v: 'all', l: 'Alle Gegner' }, ...Object.values(BOTS).map((b) => ({ v: b.id as string, l: b.name }))]} />
      </div>

      {!a || a.hands === 0 ? (
        <p className="empty">{a ? 'Hier erscheinen deine Zahlen, sobald du die erste Hand gespielt hast.' : 'Lädt …'}</p>
      ) : (
        <>
          <section style={{ marginTop: 22 }}>
            <div className={`big-num ${a.net > 0 ? 'pos' : a.net < 0 ? 'neg' : ''}`}>{fmtSigned(a.net)}</div>
            <p className="mono muted" style={{ marginTop: 6 }}>
              {fmtBB(a.netBB * bb, bb)} BB · {a.bbPer100 >= 0 ? '+' : '−'}
              {Math.abs(a.bbPer100).toFixed(1).replace('.', ',')} BB pro 100 Hände · {a.hands} Hände
            </p>
            <div style={{ marginTop: 14 }}>
              <LineChart series={[{ values: a.cum, cls: 'ln-a', area: true }, { values: a.cumEv, cls: 'ln-b' }]} yFmt={fmt} />
              <div className="legend" style={{ marginTop: 4 }}>
                <span>
                  <i style={{ background: 'var(--accent)' }} />
                  Echte Bilanz
                </span>
                <span>
                  <i style={{ background: 'var(--text-2)' }} />
                  Nach Gewinnchance beim All-in (EV)
                </span>
              </div>
              <p className="lead" style={{ marginTop: 8, fontSize: 14 }}>
                Abstand der Linien: <b className="mono">{fmtSigned(a.net - a.evNet)}</b> Chips. Positiv heißt Glück, negativ Pech. Auf lange Sicht laufen beide zusammen.
              </p>
            </div>
          </section>

          <h2 className="h-section">Rekorde</h2>
          <Row k="Größter gewonnener Pot" v={fmtSigned(a.biggestWin)} />
          <Row k="Größter verlorener Pot" v={fmtSigned(a.biggestLoss)} />
          <Row k="Längste Gewinnserie" v={`${a.bestStreak} Hände`} />
          {a.byBot.map((b) => (
            <Row key={b.id} k={`Ergebnis von ${BOTS[b.id as keyof typeof BOTS]?.name ?? b.id}`} sub={`${b.hands} Hände. Plus heißt: Dieser Gegner gewinnt Chips an eurem Tisch.`} v={fmtSigned(b.net)} />
          ))}

          <h2 className="h-section">Spielstil</h2>
          <p className="lead" style={{ fontSize: 14, marginBottom: 6 }}>
            Der grüne Bereich ist ein guter Richtwert für einen Tisch mit vier Spielern.
          </p>
          <Row k="VPIP" sub="Wie oft du freiwillig mitspielst" v={`${a.vpip.toFixed(0)} %`} zone={[28, 48]} val={a.vpip} />
          <Row k="PFR" sub="Wie oft du vor dem Flop raist" v={`${a.pfr.toFixed(0)} %`} zone={[18, 33]} val={a.pfr} />
          <Row k="Aggressionsfaktor" sub="(Bets + Raises) ÷ Calls" v={f1(a.af)} zone={[30, 60]} val={(a.af / 5) * 100} />
          <Row k="Showdown-Quote" sub="Wie oft du nach dem Flop bis zum Showdown gehst" v={`${a.wtsd.toFixed(0)} %`} zone={[25, 35]} val={a.wtsd} />
          <Row k="Showdown gewonnen" sub="Wie oft du dort gewinnst" v={`${a.wsd.toFixed(0)} %`} zone={[48, 58]} val={a.wsd} />
          {a.foldToCbet !== null && <Row k="Fold gegen C-Bet" sub="Wie oft du gegen die Fortsetzungswette aufgibst" v={`${a.foldToCbet.toFixed(0)} %`} zone={[35, 55]} val={a.foldToCbet} />}

          <h2 className="h-section">Entscheidungen</h2>
          {a.dec.n > 0 ? (
            <>
              <Row k="Gute Entscheidungen" sub={`${a.dec.n} bewertete Spots`} v={`${((a.dec.good / a.dec.n) * 100).toFixed(0)} %`} />
              <Row k="EV-Verlust" sub="Chips, die Fehler dich pro 100 Hände kosten" v={`${a.dec.per100.toFixed(1).replace('.', ',')} BB`} />
              <Row k="Grenzwertig / Fehler" v={`${a.dec.ok} / ${a.dec.bad}`} />
            </>
          ) : (
            <p className="empty">Noch keine bewerteten Entscheidungen.</p>
          )}
          {a.bluff.faced > 0 && (
            <>
              <Row k="Gegen Bluffs gefoldet" sub={`${a.bluff.faced}-mal ging ein Bluff gegen dich`} v={`${a.bluff.folded}`} />
              <Row k="Bluffs gecallt" v={`${a.bluff.called}`} />
            </>
          )}

          <h2 className="h-section">Lernwerte</h2>
          {a.answers.total > 0 ? (
            <>
              <Row k="Richtig oder gut beantwortet" sub={`${a.answers.total} Fragen`} v={`${((a.answers.ok / a.answers.total) * 100).toFixed(0)} %`} />
              <Row k="Durchschnittlicher Schätzfehler" sub="Bei Prozent-Fragen, in Prozentpunkten" v={f1(a.answers.avgErr)} />
              <Row k="Rechenzeit" sub="Pro Frage im Schnitt" v={`${a.answers.avgMs.toFixed(1).replace('.', ',')} s`} />
              {a.answers.errTrend.length >= 4 && (
                <div style={{ margin: '10px 0 0' }}>
                  <LineChart h={110} series={[{ values: a.answers.errTrend, cls: 'ln-a' }]} yFmt={(n) => n.toFixed(0)} />
                  <p className="muted" style={{ fontSize: 12.5 }}>
                    Schätzfehler im Verlauf (gleitender Schnitt). Die Linie soll sinken.
                  </p>
                </div>
              )}
              {Object.entries(a.answers.byType).map(([k, v]) => (
                <Row key={k} k={TYPE_NAMES[k] ?? k} sub={`${v.n} Fragen`} v={`${((v.ok / v.n) * 100).toFixed(0)} %`} />
              ))}
              {Object.entries(a.answers.byDraw).length > 0 && <h3 className="disp" style={{ margin: '18px 0 0', fontSize: 16 }}>Outs nach Draw-Typ</h3>}
              {Object.entries(a.answers.byDraw).map(([k, v]) => (
                <Row key={k} k={k} sub={`${v.n} Fragen`} v={`${((v.ok / v.n) * 100).toFixed(0)} %`} />
              ))}
            </>
          ) : (
            <p className="empty">Noch keine Fragen beantwortet. Stelle in den Einstellungen den Coach ein.</p>
          )}

          <h2 className="h-section">Leak-Finder</h2>
          {a.leaks.length === 0 ? (
            <p className="empty">Noch keine Auffälligkeiten. Dafür braucht es etwas mehr Daten.</p>
          ) : (
            a.leaks.map((l) => (
              <div className="leak" key={l.id}>
                <div className="t">{l.text}</div>
                <div className="cost">−{l.costBB100.toFixed(1).replace('.', ',')} BB/100</div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <Btn sm variant="ghost" onClick={() => onDrill(l.level)}>
                    Üben
                  </Btn>
                </div>
              </div>
            ))
          )}

          <h2 className="h-section">Sessions</h2>
          <div className="sessions">
            {a.sessions.slice(0, 12).map((s) => (
              <div className="row" key={s.id}>
                <div>
                  {new Date(s.startedAt).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}{' '}
                  <span className="muted">· {s.hands} Hände · {s.opps.map((o) => BOTS[o as keyof typeof BOTS]?.name ?? o).join(', ')}</span>
                </div>
                <div className={`mono ${s.net > 0 ? 'pos' : s.net < 0 ? 'neg' : ''}`}>{fmtSigned(s.net)}</div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
