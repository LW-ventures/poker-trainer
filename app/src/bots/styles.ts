export type BotId = 'rocky' | 'carla' | 'max' | 'rex'

export interface BotStyle {
  id: BotId
  name: string
  title: string
  blurb: string
  lesson: string
  // Preflop
  openPlay: number // Anteil der Starthände, die er am Button spielt
  raiseTop: number // Anteil, den er davon raist
  limp: number // Wahrscheinlichkeit zu limpen statt zu raisen (Randbereich)
  contFrac: number // Anteil der Hände, mit denen er gegen einen Raise weiterspielt
  threeBet: number // Perzentil, ab dem er re-raist
  bluff3: number // Häufigkeit von 3-Bet-Bluffs
  // Postflop
  vBet: number
  cbet: number
  bluff: number
  semi: number
  slow: number
  callLoose: number
  raiseBluff: number
  medBet: number
  sizeValue: [number, number, number]
  sizeBluff: [number, number, number]
  hud: { vpip: number; pfr: number; af: number }
}

export const BOTS: Record<BotId, BotStyle> = {
  rocky: {
    id: 'rocky',
    name: 'Rocky',
    title: 'Der Fels',
    blurb: 'Spielt wenig Hände und setzt nur mit starken Karten.',
    lesson: 'Wenn er raist, ist er meist vorn. Er blufft fast nie und setzt mit Monstern gern groß.',
    openPlay: 0.26,
    raiseTop: 0.2,
    limp: 0,
    contFrac: 0.14,
    threeBet: 0.96,
    bluff3: 0,
    vBet: 0.75,
    cbet: 0.35,
    bluff: 0.04,
    semi: 0.25,
    slow: 0.25,
    callLoose: -0.05,
    raiseBluff: 0,
    medBet: 0.15,
    sizeValue: [0.05, 0.25, 0.7],
    sizeBluff: [0.5, 0.4, 0.1],
    hud: { vpip: 17, pfr: 12, af: 1.4 },
  },
  carla: {
    id: 'carla',
    name: 'Carla',
    title: 'Die Calling Station',
    blurb: 'Callt fast alles und gibt selten auf.',
    lesson: 'Nicht bluffen, sie folded nicht. Mit guten Händen auf Value setzen.',
    openPlay: 0.58,
    raiseTop: 0.15,
    limp: 0.6,
    contFrac: 0.45,
    threeBet: 0.97,
    bluff3: 0,
    vBet: 0.45,
    cbet: 0.15,
    bluff: 0.03,
    semi: 0.15,
    slow: 0.3,
    callLoose: 0.12,
    raiseBluff: 0,
    medBet: 0.08,
    sizeValue: [0.5, 0.4, 0.1],
    sizeBluff: [0.8, 0.2, 0],
    hud: { vpip: 46, pfr: 17, af: 0.7 },
  },
  max: {
    id: 'max',
    name: 'Max',
    title: 'Der Maniac',
    blurb: 'Setzt und raist ständig, auch mit schwachen Händen.',
    lesson: 'Viele seiner Bets sind Bluffs. Gute Hände nicht wegwerfen, öfter callen.',
    openPlay: 0.72,
    raiseTop: 0.55,
    limp: 0.05,
    contFrac: 0.55,
    threeBet: 0.85,
    bluff3: 0.25,
    vBet: 0.9,
    cbet: 0.85,
    bluff: 0.4,
    semi: 0.75,
    slow: 0.05,
    callLoose: 0.05,
    raiseBluff: 0.25,
    medBet: 0.6,
    sizeValue: [0.1, 0.4, 0.5],
    sizeBluff: [0.1, 0.4, 0.5],
    hud: { vpip: 56, pfr: 42, af: 2.7 },
  },
  rex: {
    id: 'rex',
    name: 'Rex',
    title: 'Der Reg',
    blurb: 'Solide und ausgewogen. Spielt wie ein guter echter Gegner.',
    lesson: 'Blufft nach Theorie, mit denselben Größen wie bei Value. Schwer zu lesen.',
    openPlay: 0.46,
    raiseTop: 0.38,
    limp: 0.08,
    contFrac: 0.3,
    threeBet: 0.92,
    bluff3: 0.1,
    vBet: 0.8,
    cbet: 0.62,
    bluff: 0.22,
    semi: 0.6,
    slow: 0.12,
    callLoose: 0,
    raiseBluff: 0.1,
    medBet: 0.35,
    sizeValue: [0.25, 0.5, 0.25],
    sizeBluff: [0.25, 0.5, 0.25],
    hud: { vpip: 31, pfr: 21, af: 1.5 },
  },
}

export const BOT_LIST = Object.values(BOTS)
