import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowLeft, Eye, Gear } from '@phosphor-icons/react'
import { BOTS } from '../../bots/styles'
import type { Card } from '../../engine/cards'
import { evaluate, describe } from '../../engine/evaluator'
import { legal, posOf, potOf, STREET_DE, type HandState, type Seat as SeatT } from '../../engine/game'
import { pct } from '../../engine/odds'
import { useGame } from '../../store/game'
import { useSettings } from '../../store/settings'
import { fmt, fmtBB, fmtSigned } from '../../util/format'
import { Btn } from '../components/Bits'
import { ChipStack, Chip, PlayingCard } from '../components/Card'
import { QuizSheet } from './Quiz'

function summary(h: HandState): string | null {
  const r = h.result
  if (!r) return null
  const ws = h.seats.filter((p) => r.payouts[p.id] > 0 && r.pots.some((pt) => pt.winners.includes(p.id)))
  if (ws.length === 0) return null
  if (ws.length === 1) {
    const w = ws[0]
    const who = w.human ? 'Du gewinnst' : `${w.name} gewinnt`
    const how = r.showdown ? (r.names[w.id] ? ` mit ${r.names[w.id]}` : '') : ' ohne Showdown'
    return `${who} ${fmt(r.payouts[w.id])}${how}`
  }
  return `Geteilter Pot: ${ws.map((w) => (w.human ? 'Du' : w.name)).join(', ')}`
}

export function Table({ onExit, onSettings, onResolution }: { onExit: () => void; onSettings: () => void; onResolution: () => void }) {
  const g = useGame()
  const st = useSettings()
  const h = g.hand
  const [raiseOpen, setRaiseOpen] = useState(false)
  useEffect(() => {
    if (g.phase !== 'hero') setRaiseOpen(false)
  }, [g.phase])
  useEffect(() => {
    if (!g.session) onExit()
  }, [g.session, onExit])
  if (!h || !g.session) return null
  const hero = h.seats[0]
  const pot = potOf(h)
  const turn = h.over ? -1 : h.toAct
  const res = h.result
  const revealed = g.revealed && !!res
  const winners = new Set<number>(revealed && res ? res.pots.flatMap((p) => p.winners).filter((i) => res.payouts[i] > 0) : [])
  const lead = res?.pots[0]?.winners[0]
  const winBest: Card[] | null = revealed && res?.showdown && lead !== undefined ? res.best[lead] : null
  const boardCards = h.board.slice(0, g.boardShown)
  const heroName = revealed && res?.names[0] ? res.names[0] : boardCards.length >= 3 && !hero.folded ? describe(evaluate([...hero.hole, ...boardCards])) : ''
  const heroNet = revealed && res ? res.net[0] : 0
  const heroHit = (c: Card) => !!winBest && winners.has(0) && winBest.includes(c)
  const line = revealed ? summary(h) : null
  const net = g.session.net

  return (
    <div className={`table-screen ${st.fourColor ? '' : 'two-color'}`}>
      <header className="tbar">
        <button className="icon-btn" aria-label="Zurück" onClick={onExit}>
          <ArrowLeft size={24} />
        </button>
        <div className="mid">
          Diese Session · Hand {g.handNo}
          <b className={net > 0 ? 'pos' : net < 0 ? 'neg' : ''}>
            {fmtSigned(net)} <span className="muted" style={{ fontSize: 13, fontWeight: 400 }}>({fmtBB(net, st.bb)} BB)</span>
          </b>
        </div>
        <button className="icon-btn" aria-label="Einstellungen" onClick={onSettings}>
          <Gear size={24} />
        </button>
      </header>

      <main className="felt">
        <div className="opps">
          {h.seats.slice(1).map((seat) => (
            <SeatView key={seat.id} seat={seat} h={h} turn={turn === seat.id} bubble={g.bubbles[seat.id]} revealed={revealed} showFolded={st.showFolded} winner={winners.has(seat.id)} winBest={winBest} />
          ))}
        </div>

        <div className="centre">
          <div className="potline">
            <ChipStack n={pot > 600 ? 3 : pot > 100 ? 2 : 1} />
            <span>{fmt(pot)}</span>
            <small>Pot</small>
          </div>
          <div className="board" aria-label="Gemeinschaftskarten">
            {[0, 1, 2, 3, 4].map((i) =>
              boardCards[i] !== undefined ? (
                <PlayingCard key={boardCards[i]} card={boardCards[i]} size="md" deal delay={i < 3 ? i * 0.12 : 0} dim={!!winBest && !winBest.includes(boardCards[i])} />
              ) : (
                <PlayingCard key={'s' + i} slot size="md" />
              ),
            )}
          </div>
          {line ? (
            <div className="result-line" key={line}>
              {line}
            </div>
          ) : (
            <div className="street-tag">{h.over ? 'SHOWDOWN' : STREET_DE[h.street].toUpperCase()}</div>
          )}
        </div>

        <div className="hero">
          <div className="cards">
            <PlayingCard card={hero.hole[0]} size="lg" tilt={-4} deal delay={0.05} dim={hero.folded} hit={heroHit(hero.hole[0])} />
            <PlayingCard card={hero.hole[1]} size="lg" tilt={4} deal delay={0.17} dim={hero.folded} hit={heroHit(hero.hole[1])} />
          </div>
          <div className="meta">
            <span className="nm">
              Du <span className="pos-tag">{posOf(h, 0)}</span>
              {h.button === 0 && <span className="dealer">D</span>}
            </span>
            <span className="stk">{fmt(hero.stack)}</span>
            {hero.bet > 0 && !revealed && (
              <span className="betline">
                <Chip size={16} /> {fmt(hero.bet)}
              </span>
            )}
            {revealed && heroNet !== 0 && (
              <span className={`mono ${heroNet > 0 ? 'pos' : 'neg'}`} style={{ fontSize: 17, fontWeight: 600 }}>
                {fmtSigned(heroNet)}
              </span>
            )}
            <span className="hn">{hero.folded ? 'gefoldet' : heroName}</span>
          </div>
        </div>
        <AnimatePresence>
          {g.bubbles[0] && !revealed && (
            <motion.div key={g.bubbles[0].text} className={`bubble edge cutA ${g.bubbles[0].kind}`} style={{ position: 'absolute', left: 16, bottom: 130 }} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              {g.bubbles[0].text}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <footer className="dock">
        <HelpStrip />
        {g.phase === 'hero' && !raiseOpen && <ActionBar onRaise={() => setRaiseOpen(true)} />}
        {g.phase === 'hero' && raiseOpen && <RaisePanel h={h} onClose={() => setRaiseOpen(false)} />}
        {(g.phase === 'think' || g.phase === 'quiz') && (
          <div className="thinking">
            {g.phase === 'quiz' ? (
              'Beantworte die Frage, dann entscheidest du.'
            ) : (
              <span>
                {h.over ? 'Showdown' : turn === 0 ? (g.quiz && !g.quiz.answered ? 'Schau dir das Board an, gleich kommt eine Frage' : 'Du bist dran') : turn >= 0 ? `${h.seats[turn].name} denkt` : 'Einen Moment'}{' '}
                <span className="dots">
                  <span />
                  <span />
                  <span />
                </span>
              </span>
            )}
          </div>
        )}
        {g.phase === 'over' && (
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn variant="ghost" style={{ flex: 1 }} disabled={!g.resolution} onClick={onResolution}>
              <Eye size={20} /> Auflösung
            </Btn>
            <Btn variant="primary" style={{ flex: 1.3 }} disabled={!g.resolution} onClick={() => g.dealHand()}>
              Nächste Hand
            </Btn>
          </div>
        )}
        {g.phase === 'broke' && (
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn
              variant="ghost"
              style={{ flex: 1 }}
              onClick={() => {
                g.leave()
                onExit()
              }}
            >
              Beenden
            </Btn>
            <Btn variant="primary" style={{ flex: 1.3 }} onClick={() => g.rebuy()}>
              Nachkaufen ({fmt(st.startStack)})
            </Btn>
          </div>
        )}
      </footer>

      {g.phase === 'quiz' && <QuizSheet />}
      {g.phase !== 'quiz' && <CoachIdle />}
      <AnimatePresence>
        {g.newLevel && (
          <motion.div className="toast edge cutA" initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            Lernstufe {g.newLevel} freigeschaltet
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function SeatView({
  seat,
  h,
  turn,
  bubble,
  revealed,
  showFolded,
  winner,
  winBest,
}: {
  seat: SeatT
  h: HandState
  turn: boolean
  bubble?: { text: string; kind: string }
  revealed: boolean
  showFolded: boolean
  winner: boolean
  winBest: Card[] | null
}) {
  const hud = useSettings((s) => s.botHud)
  const style = seat.style ? BOTS[seat.style as keyof typeof BOTS] : null
  const pos = posOf(h, seat.id)
  const res = h.result
  const reveal = revealed && !!res && (res.showdown ? !seat.folded || showFolded : showFolded)
  const hname = reveal && res ? (seat.folded ? 'gefoldet' : (res.names[seat.id] ?? 'ohne Showdown')) : null
  const net = revealed && res ? res.net[seat.id] : 0
  const shown = net !== 0 ? { text: fmtSigned(net), kind: net > 0 ? 'win' : 'lose' } : revealed ? undefined : bubble
  const hit = (c: Card) => winner && !!winBest && winBest.includes(c)
  return (
    <div className={`seat ${turn ? 'turn' : ''} ${seat.folded && !reveal ? 'folded' : ''} ${winner ? 'win' : ''}`}>
      {h.button === seat.id && <span className="dealer seat-d">D</span>}
      <div className={`cards ${reveal ? 'open' : ''}`}>
        {reveal ? (
          <>
            <PlayingCard key="a" card={seat.hole[0]} size="md" flip tilt={-4} delay={seat.id * 0.12} hit={hit(seat.hole[0])} dim={seat.folded} />
            <PlayingCard key="b" card={seat.hole[1]} size="md" flip tilt={4} delay={seat.id * 0.12 + 0.08} hit={hit(seat.hole[1])} dim={seat.folded} />
          </>
        ) : (
          <>
            <PlayingCard back size="sm" deal tilt={-5} delay={0.2 + seat.id * 0.05} />
            <PlayingCard back size="sm" deal tilt={5} delay={0.28 + seat.id * 0.05} />
          </>
        )}
      </div>
      {hname && <div className={`hname ${seat.folded ? 'muted' : ''}`}>{hname}</div>}
      <div className="plate edge cutA">
        <span className="avatar">{seat.name[0]}</span>
        <div>
          <div className="nm">{seat.name}</div>
          <div className="sub">
            {pos} · {style?.title.replace('Der ', '').replace('Die ', '')}
          </div>
          <div className="stk">{fmt(seat.stack)}</div>
        </div>
      </div>
      {hud && style && !reveal && (
        <div className="hud" title="Spielstil dieses Gegners">
          <span>VPIP {style.hud.vpip}</span>
          <span>PFR {style.hud.pfr}</span>
        </div>
      )}
      <div className="betline">
        {seat.bet > 0 && !revealed && (
          <>
            <Chip size={16} /> {fmt(seat.bet)}
          </>
        )}
      </div>
      <div className="say">
        <AnimatePresence>
          {shown && (
            <motion.div key={shown.text} className={`bubble edge cutA ${shown.kind}`} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              {shown.text}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

function HelpStrip() {
  const help = useSettings((s) => s.help)
  const spot = useGame((s) => s.spot)
  const phase = useGame((s) => s.phase)
  if (!spot || (phase !== 'hero' && phase !== 'quiz')) return null
  if (!help.outs && !help.potodds && !help.equity) return null
  return (
    <div className="helpstrip">
      {help.outs && spot.info && (
        <span>
          Outs <b>{spot.info.outs.length}</b>
        </span>
      )}
      {help.potodds && spot.toCall > 0 && (
        <span>
          Pot Odds <b>{pct(spot.need)} %</b>
        </span>
      )}
      {help.equity && spot.eq !== null && (
        <span>
          Gewinnchance <b>{pct(spot.eq)} %</b>
        </span>
      )}
    </div>
  )
}

function ActionBar({ onRaise }: { onRaise: () => void }) {
  const h = useGame((s) => s.hand)!
  const heroAct = useGame((s) => s.heroAct)
  const bb = useSettings((s) => s.bb)
  const lg = useMemo(() => legal(h, 0, bb), [h, bb])
  return (
    <div className="actions">
      <Btn variant="ghost" disabled={lg.canCheck} onClick={() => heroAct({ type: 'fold' })}>
        Fold
      </Btn>
      <Btn onClick={() => heroAct(lg.canCheck ? { type: 'check' } : { type: 'call' })}>
        {lg.canCheck ? 'Check' : 'Call'}
        {!lg.canCheck && <small>{fmt(lg.toCall)}</small>}
      </Btn>
      <Btn variant="primary" disabled={!lg.canRaise} onClick={onRaise}>
        {h.currentBet === 0 ? 'Bet' : 'Raise'}
      </Btn>
    </div>
  )
}

function RaisePanel({ h, onClose }: { h: HandState; onClose: () => void }) {
  const heroAct = useGame((s) => s.heroAct)
  const bb = useSettings((s) => s.bb)
  const lg = legal(h, 0, bb)
  const pot = potOf(h)
  const unit = Math.max(1, Math.round(bb / 4))
  const clamp = (v: number) => Math.min(lg.maxRaiseTo, Math.max(lg.minRaiseTo, Math.round(v / unit) * unit))
  const base = h.currentBet
  const pre = h.street === 'preflop'
  const presets = pre
    ? [
        { l: 'Min', to: lg.minRaiseTo },
        { l: h.preRaises === 0 ? '2,5×' : '2,2×', to: h.preRaises === 0 ? bb * 2.5 : base * 2.2 },
        { l: '3×', to: h.preRaises === 0 ? bb * 3 : base * 3 },
        { l: '4×', to: h.preRaises === 0 ? bb * 4 : base * 4 },
        { l: 'All-in', to: lg.maxRaiseTo },
      ]
    : [
        { l: '⅓', to: base + (pot + lg.toCall) / 3 },
        { l: '½', to: base + (pot + lg.toCall) / 2 },
        { l: '⅔', to: base + ((pot + lg.toCall) * 2) / 3 },
        { l: 'Pot', to: base + pot + lg.toCall },
        { l: 'All-in', to: lg.maxRaiseTo },
      ]
  const [to, setTo] = useState(() => clamp(presets[1].to))
  return (
    <div className="raise-panel">
      <div className="presets">
        {presets.map((p) => (
          <button key={p.l} className={`btn edge cutA ghost ${clamp(p.to) === to ? 'on' : ''}`} onClick={() => setTo(clamp(p.to))}>
            {p.l}
          </button>
        ))}
      </div>
      <div className="raise-row">
        <span className="val">{fmt(to)}</span>
        <input type="range" min={lg.minRaiseTo} max={lg.maxRaiseTo} step={unit} value={to} onChange={(e) => setTo(clamp(Number(e.target.value)))} aria-label="Einsatzhöhe" />
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <Btn variant="ghost" style={{ flex: 1 }} onClick={onClose}>
          Zurück
        </Btn>
        <Btn variant="primary" style={{ flex: 2 }} onClick={() => heroAct({ type: 'raise', to })}>
          {to >= lg.maxRaiseTo ? 'All-in' : h.currentBet === 0 ? 'Bet' : 'Raise auf'} {fmt(to)}
        </Btn>
      </div>
    </div>
  )
}

function CoachIdle() {
  const bots = useGame((s) => s.bots)
  const decs = useGame((s) => s.decisions)
  const last = [...decs].reverse().find((d) => d.grade?.grade)
  return (
    <aside className="coach" style={{ pointerEvents: 'none' }}>
      <div className="coach-empty" style={{ pointerEvents: 'auto' }}>
        <b className="disp" style={{ fontSize: 18, color: 'var(--text)' }}>
          Coach
        </b>
        {last?.grade ? <p>Letzte Entscheidung: {last.grade.text}</p> : <p>Hier erscheinen deine Fragen, sobald ein wichtiger Spot kommt.</p>}
        <div className="rule" style={{ margin: '8px 0' }} />
        {bots.map((b) => (
          <div key={b} style={{ marginBottom: 8 }}>
            <b style={{ color: 'var(--text)' }}>
              {BOTS[b].name}, {BOTS[b].title}
            </b>
            <div>{BOTS[b].lesson}</div>
          </div>
        ))}
      </div>
    </aside>
  )
}
