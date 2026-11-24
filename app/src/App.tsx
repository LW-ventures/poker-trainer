import { useEffect, useState } from 'react'
import { MotionConfig } from 'motion/react'
import { useGame } from './store/game'
import { useSettings } from './store/settings'
import { Drill, type DrillSpec } from './ui/screens/Drill'
import { Facts } from './ui/screens/Facts'
import { Home, type ScreenName } from './ui/screens/Home'
import { Learn } from './ui/screens/Learn'
import { Resolution } from './ui/screens/Resolution'
import { Settings } from './ui/screens/Settings'
import { Stats } from './ui/screens/Stats'
import { Table } from './ui/screens/Table'
import { PlayingCard } from './ui/components/Card'

function CardGallery() {
  const sizes = ['lg', 'md', 'sm'] as const
  return (
    <div style={{ padding: 16 }}>
      {sizes.map((sz) => (
        <div key={sz} style={{ display: 'grid', gridTemplateColumns: 'repeat(13, max-content)', gap: 6, marginBottom: 16, overflowX: 'auto' }}>
          {[0, 1, 2, 3].flatMap((s) => Array.from({ length: 13 }, (_, i) => <PlayingCard key={s + '-' + i} card={(12 - i) * 4 + s} size={sz} />))}
        </div>
      ))}
    </div>
  )
}

export default function App() {
  const [screen, setScreen] = useState<ScreenName>(() => {
    const h = location.hash.slice(1)
    return ['stats', 'learn', 'drill', 'settings', 'facts'].includes(h) ? (h as ScreenName) : 'home'
  })
  const [prev, setPrev] = useState<ScreenName>('home')
  const [drill, setDrill] = useState<DrillSpec>({ kind: 'mixed' })
  const theme = useSettings((s) => s.theme)
  const fourColor = useSettings((s) => s.fourColor)
  const resolutionOpen = useGame((s) => s.resolutionOpen)
  const hasRes = useGame((s) => !!s.resolution)
  const openRes = useGame((s) => s.openResolution)
  const closeRes = useGame((s) => s.closeResolution)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    document.body.classList.toggle('two-color', !fourColor)
    const meta = document.querySelector('meta[name="theme-color"]')
    meta?.setAttribute('content', theme === 'light' ? '#e7ece9' : '#0a0d0c')
  }, [theme, fourColor])

  const go = (s: ScreenName) => {
    setPrev(screen)
    if (s === 'drill' && screen !== 'learn') setDrill({ kind: 'mixed' })
    setScreen(s)
  }
  const back = () => setScreen(prev === screen ? 'home' : prev)

  if (import.meta.env.DEV && location.hash === '#cards') return <CardGallery />
  return (
    <MotionConfig reducedMotion="user">
      {screen === 'home' && <Home go={go} />}
      {screen === 'table' && <Table onExit={() => setScreen('home')} onSettings={() => go('settings')} onResolution={openRes} />}
      {screen === 'table' && resolutionOpen && hasRes && <Resolution onClose={closeRes} />}
      {screen === 'stats' && (
        <Stats
          onBack={() => setScreen('home')}
          onDrill={(l) => {
            setDrill({ kind: 'level', level: l })
            setPrev('stats')
            setScreen('drill')
          }}
        />
      )}
      {screen === 'learn' && (
        <Learn
          onBack={() => setScreen('home')}
          onDrill={(l) => {
            setDrill({ kind: 'level', level: l })
            setPrev('learn')
            setScreen('drill')
          }}
          onPlacement={() => {
            setDrill({ kind: 'placement' })
            setPrev('learn')
            setScreen('drill')
          }}
          onReview={() => {
            setDrill({ kind: 'review' })
            setPrev('learn')
            setScreen('drill')
          }}
          onFacts={() => {
            setPrev('learn')
            setScreen('facts')
          }}
        />
      )}
      {screen === 'drill' && <Drill key={JSON.stringify(drill)} spec={drill} onBack={() => setScreen(prev === 'drill' ? 'home' : prev)} />}
      {screen === 'facts' && <Facts onBack={() => setScreen(prev === 'facts' ? 'home' : prev)} />}
      {screen === 'settings' && <Settings onBack={back} />}
    </MotionConfig>
  )
}
