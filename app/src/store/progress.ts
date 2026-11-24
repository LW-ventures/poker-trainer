import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface Progress {
  maxLevel: number // höchste freigeschaltete Lernstufe (0..10)
  stars: Record<number, number>
  placed: boolean
  recent: number[]
  recordAnswer: (ok: boolean) => boolean // true, wenn eine Stufe freigeschaltet wurde
  drillResult: (level: number, ratio: number) => number
  place: (level: number) => void
  setLevel: (level: number) => void
  reset: () => void
}

export const useProgress = create<Progress>()(
  persist(
    (set, get) => ({
      maxLevel: 1,
      stars: {},
      placed: false,
      recent: [],
      recordAnswer: (ok) => {
        const recent = [...get().recent, ok ? 1 : 0].slice(-8)
        if (recent.length >= 8 && recent.reduce((a, b) => a + b, 0) >= 6 && get().maxLevel < 10) {
          set({ maxLevel: get().maxLevel + 1, recent: [] })
          return true
        }
        set({ recent })
        return false
      },
      drillResult: (level, ratio) => {
        const stars = ratio >= 0.95 ? 3 : ratio >= 0.8 ? 2 : ratio >= 0.6 ? 1 : 0
        const cur = get().stars[level] ?? 0
        const next: Partial<Progress> = { stars: { ...get().stars, [level]: Math.max(cur, stars) } }
        if (ratio >= 0.8 && level >= get().maxLevel) next.maxLevel = Math.min(10, level + 1)
        set(next)
        return stars
      },
      setLevel: (level) => set({ maxLevel: level }),
      place: (level) => set({ maxLevel: Math.max(get().maxLevel, level), placed: true }),
      reset: () => set({ maxLevel: 1, stars: {}, placed: false, recent: [] }),
    }),
    { name: 'pokerschule-progress', version: 1 },
  ),
)
