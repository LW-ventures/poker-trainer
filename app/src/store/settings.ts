import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { BotId } from '../bots/styles'
import type { Tolerance } from '../coach/questions'

export type QuizMode = 'off' | 'important' | 'every'
export interface Settings {
  quizMode: QuizMode
  types: { outs: boolean; hit: boolean; potodds: boolean; preflop: boolean; beats: boolean; bluffshare: boolean }
  feedback: 'instant' | 'after'
  /** Sekunden, die das Board sichtbar bleibt, bevor eine Frage erscheint */
  quizDelay: number
  tolerance: Tolerance
  help: { outs: boolean; potodds: boolean; equity: boolean }
  opp1: BotId | 'random'
  opp2: BotId | 'random'
  opp3: BotId | 'random'
  sb: number
  bb: number
  startStack: number
  showFolded: boolean
  speed: 'fast' | 'normal' | 'slow'
  fourColor: boolean
  theme: 'auto' | 'dark' | 'light'
  unlockAll: boolean
  botHud: boolean
}

export const DEFAULTS: Settings = {
  quizMode: 'important',
  types: { outs: true, hit: true, potodds: true, preflop: true, beats: true, bluffshare: true },
  feedback: 'instant',
  quizDelay: 5,
  tolerance: 'normal',
  help: { outs: false, potodds: false, equity: false },
  opp1: 'random',
  opp2: 'random',
  opp3: 'random',
  sb: 10,
  bb: 20,
  startStack: 2000,
  showFolded: true,
  speed: 'normal',
  fourColor: false,
  theme: 'auto',
  unlockAll: false,
  botHud: true,
}

type State = Settings & { set: (p: Partial<Settings>) => void; reset: () => void }
export const useSettings = create<State>()(
  persist(
    (set) => ({
      ...DEFAULTS,
      set: (p) => set(p),
      reset: () => set({ ...DEFAULTS }),
    }),
    {
      name: 'pokerschule-settings',
      version: 4,
      migrate: (s, from) =>
        ({
          ...(s as object),
          ...(from < 3 ? { fourColor: false, opp3: 'random' } : {}),
          quizDelay: DEFAULTS.quizDelay,
        }) as State,
    },
  ),
)
export const getSettings = (): Settings => {
  const { set: _s, reset: _r, ...rest } = useSettings.getState()
  return rest
}
