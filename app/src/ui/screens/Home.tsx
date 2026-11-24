import { useEffect, useState } from 'react'
import { ChartLineUp, Gear, GraduationCap, Table as TableIcon, Target } from '@phosphor-icons/react'
import { parseCards } from '../../engine/cards'
import { loadStats, type Agg } from '../../stats/aggregate'
import { useGame } from '../../store/game'
import { useProgress } from '../../store/progress'
import { fmtBB, fmtSigned } from '../../util/format'
import { Btn } from '../components/Bits'
import { PlayingCard } from '../components/Card'
import { Spark } from '../components/Charts'
import { useSettings } from '../../store/settings'

export type ScreenName = 'home' | 'table' | 'stats' | 'learn' | 'drill' | 'settings' | 'facts'

const FAN = parseCards('As Ah Kd')

export function Home({ go }: { go: (s: ScreenName) => void }) {
  const [agg, setAgg] = useState<Agg | null>(null)
  const session = useGame((s) => s.session)
  const startSession = useGame((s) => s.startSession)
  const leave = useGame((s) => s.leave)
  const level = useProgress((s) => s.maxLevel)
  const bb = useSettings((s) => s.bb)
  const four = useSettings((s) => s.fourColor)
  useEffect(() => {
    void loadStats('all', 'all').then(setAgg)
  }, [session])

  const net = agg?.net ?? 0
  const leak = agg?.leaks[0]

  return (
    <div className={`screen ${four ? '' : 'two-color'}`}>
      <div className="topbar">
        <h1 className="disp" style={{ fontSize: 22 }}>
          Pokerschule
        </h1>
        <button className="icon-btn" aria-label="Einstellungen" onClick={() => go('settings')}>
          <Gear size={24} />
        </button>
      </div>

      <div className="home-cols">
      <div className="home-left">
      <section className="home-hero">
        <div className="fan" aria-hidden>
          {FAN.map((c, i) => (
            <div key={c} style={{ position: 'absolute', left: 10 + i * 32, top: 10 + Math.abs(i - 1) * 8, transform: `rotate(${(i - 1) * 12}deg)`, transformOrigin: '50% 100%' }}>
              <PlayingCard card={c} size="md" />
            </div>
          ))}
        </div>
        <p className="muted" style={{ fontSize: 14 }}>
          Gesamtbilanz
        </p>
        <div className={`big-num ${net > 0 ? 'pos' : net < 0 ? 'neg' : ''}`}>{fmtSigned(net)}</div>
        <p className="mono muted" style={{ marginTop: 8, fontSize: 14 }}>
          {agg && agg.hands > 0 ? (
            <>
              {fmtBB(agg.netBB * bb, bb)} BB in {agg.hands} Händen · {agg.bbPer100 >= 0 ? '+' : '−'}
              {Math.abs(agg.bbPer100).toFixed(1).replace('.', ',')} BB/100
            </>
          ) : (
            'Noch keine Hände gespielt'
          )}
        </p>
        {agg && agg.cum.length > 3 && (
          <div style={{ marginTop: 10 }}>
            <Spark values={agg.cum.slice(-60)} />
          </div>
        )}
      </section>

      <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
        <Btn variant="primary" block onClick={() => { if (!session) startSession(); go('table') }} style={{ minHeight: 60, fontSize: 19 }}>
          {session ? 'Weiterspielen' : 'Neue Session'}
        </Btn>
        {session && (
          <Btn variant="ghost" onClick={() => leave()}>
            Beenden
          </Btn>
        )}
      </div>
      </div>

      <div className="home-right">
      <div className="home-grid">
        <button className="tile wide edge cutB" onClick={() => go('learn')}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div className="t">Lernpfad</div>
              <div className="d">Outs, Pot Odds, Ranges. Aktuell Stufe {level} von 10.</div>
            </div>
            <GraduationCap size={30} />
          </div>
          <div className="segbar" aria-hidden>
            {Array.from({ length: 10 }, (_, i) => (
              <i key={i} className={i < level ? 'on' : ''} />
            ))}
          </div>
        </button>
        <button className="tile edge cutB" onClick={() => go('drill')}>
          <Target size={28} />
          <div>
            <div className="t">Drill</div>
            <div className="d">Schnelle Aufgaben</div>
          </div>
        </button>
        <button className="tile edge cutB" onClick={() => go('stats')}>
          <ChartLineUp size={28} />
          <div>
            <div className="t">Statistik</div>
            <div className="d">Bilanz und Leaks</div>
          </div>
        </button>
        <button className="tile wide edge cutB" onClick={() => go('facts')} style={{ minHeight: 76 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <div>
              <div className="t">Spickzettel</div>
              <div className="d">Outs, Formeln, Wahrscheinlichkeiten auf einen Blick</div>
            </div>
            <TableIcon size={28} />
          </div>
        </button>
      </div>

      {leak && (
        <p className="lead" style={{ marginTop: 22, fontSize: 14.5 }}>
          <b className="acc">Dein größter Leak:</b> {leak.text}
        </p>
      )}
      </div>
      </div>
    </div>
  )
}
