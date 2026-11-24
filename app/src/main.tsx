import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/bricolage-grotesque'
import '@fontsource-variable/geist'
import '@fontsource-variable/geist-mono'
import './ui/styles.css'
import App from './App'
import { registerSW } from 'virtual:pwa-register'

import { useGame } from './store/game'
import { useSettings } from './store/settings'
if (import.meta.env.DEV) Object.assign(window, { __game: useGame, __settings: useSettings })
registerSW({ immediate: true })
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
