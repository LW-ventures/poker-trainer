export interface Level {
  n: number
  title: string
  short: string
  body: string[]
  formulas: string[]
  example: string[]
  unlocks: string
}

export const LEVELS: Level[] = [
  {
    n: 0,
    title: 'Auffrischung: Handrankings',
    short: 'Welche Hand schlägt welche?',
    body: [
      'Von schwach nach stark: Hohe Karte, Paar, Zwei Paare, Drilling, Straße, Flush, Full House, Vierling, Straight Flush.',
      'Bei gleicher Kategorie entscheiden die höchsten Karten. Der Kicker ist die höchste Karte, die nicht zum Paar oder Drilling gehört.',
      'Aus sieben verfügbaren Karten (zwei eigene, fünf Board) zählen immer die besten fünf.',
    ],
    formulas: ['Ein Paar 43,8 %, Zwei Paare 23,5 %, Drilling 4,8 %, Straße 4,6 %, Flush 3,0 %, Full House 2,6 % (nach 7 Karten)'],
    example: ['Board K♠ 9♦ 4♣ 4♥ 2♠: A♦ K♦ hat zwei Paare (Könige und Vieren), Q♣ Q♦ ebenfalls, aber die Damen sind schlechter als die Könige.'],
    unlocks: 'Freischaltung: von Beginn an',
  },
  {
    n: 1,
    title: 'Outs zählen',
    short: 'Flush, offene Straße, Gutshot',
    body: [
      'Ein Out ist eine unbekannte Karte, die dein Blatt zum Sieger machen kann. Du zählst nur Karten, die du nicht siehst.',
      'Flush Draw: vier Karten einer Farbe. Von den 13 Karten dieser Farbe siehst du vier, also bleiben 9 Outs.',
      'Offener Straight Draw: vier Karten in Folge, zwei Ränge machen die Straße. 2 Ränge × 4 Karten = 8 Outs.',
      'Gutshot: eine Lücke in der Mitte. Nur ein Rang hilft, also 4 Outs.',
      'Zwei Overcards (beide Karten höher als das Board): 3 + 3 = 6 Outs auf ein Top-Paar.',
    ],
    formulas: ['Flush Draw = 9 Outs', 'Offene Straße = 8 Outs', 'Gutshot = 4 Outs', 'Zwei Overcards = 6 Outs', 'Pocket Pair auf Drilling = 2 Outs'],
    example: ['A♥ 7♥ auf K♥ 9♥ 2♣: 13 Herz − 4 sichtbare Herz = 9 Outs für den Flush.'],
    unlocks: 'Freischaltung: von Beginn an. Im Spiel kommt die Frage „Wie viele Outs?“.',
  },
  {
    n: 2,
    title: 'Kombi-Draws',
    short: 'Nichts doppelt zählen',
    body: [
      'Hast du Flush Draw und Straight Draw gleichzeitig, zählst du jede Karte nur einmal. Eine Karte, die beides macht, ist ein einzelnes Out.',
      'Beispiel: 9♥ 8♥ auf 7♥ 6♥ K♣. Flush: 9 Herz. Straße: 5 und 10 in drei weiteren Farben, also 6 zusätzliche Karten (5♥ und 10♥ sind schon im Flush).',
      'Zusammen 9 + 6 = 15 Outs. Das ist fast ein Münzwurf bis zum River.',
    ],
    formulas: ['15 Outs = 54,1 % bis zum River', '12 Outs (Flush + Gutshot) = 45,0 %'],
    example: ['Zähle erst die Flush-Karten, dann nur die Straßen-Karten, die noch nicht dabei sind.'],
    unlocks: 'Freischaltung: nach Stufe 1',
  },
  {
    n: 3,
    title: 'Faustregel 2 und 4',
    short: 'Schnell rechnen, exakt prüfen',
    body: [
      'Mit einer Karte, die noch kommt (Turn zum River): Outs × 2 ergibt die Trefferchance in Prozent.',
      'Mit zwei Karten (Flop bis River): Outs × 4. Ab 9 Outs wird das zu hoch, dann ziehst du (Outs − 8) wieder ab.',
      'Exakt rechnest du: 1 − (Karten ohne Out) ÷ (unbekannte Karten) für jede kommende Karte.',
    ],
    formulas: ['1 Karte: Outs × 2', '2 Karten: Outs × 4  (ab 9 Outs: Outs × 4 − (Outs − 8))', 'Exakt: 1 − C(47 − Outs, 2) ÷ C(47, 2)'],
    example: ['9 Outs am Flop: Faustregel 9 × 4 − 1 = 35 %, exakt 35,0 %. Am Turn: 9 × 2 = 18 %, exakt 19,6 % (9 ÷ 46).'],
    unlocks: 'Freischaltung: nach Stufe 2. Im Spiel kommt die Frage „Trefferchance“.',
  },
  {
    n: 4,
    title: 'Pot Odds',
    short: 'Was kostet der Call?',
    body: [
      'Pot Odds sagen dir, wie oft du gewinnen musst, damit ein Call auf Dauer Gewinn bringt.',
      'Du teilst den Call durch den Pot, der nach deinem Call im Topf liegt.',
      'Setzt der Gegner 20 in einen Pot von 40 (jetzt 60), und du musst 20 zahlen: 20 ÷ (60 + 20) = 25 %.',
    ],
    formulas: ['Pot Odds = Call ÷ (Pot + Call)', 'Pot enthält den Einsatz des Gegners'],
    example: ['Halber Pot: 25 %. Dreiviertel Pot: 30 %. Ganzer Pot: 33 %. Doppelter Pot: 40 %.'],
    unlocks: 'Freischaltung: nach Stufe 3. Im Spiel kommt die Frage „Pot Odds“.',
  },
  {
    n: 5,
    title: 'Call oder Fold',
    short: 'Trefferchance gegen Pot Odds',
    body: [
      'Vergleiche deine Gewinnchance mit den Pot Odds. Ist deine Chance größer, ist der Call profitabel.',
      'Bei einem Draw ohne ausgespielte Hand zählt nur die Trefferchance mit den Outs.',
      'Der Erwartungswert (EV) eines Calls ist: Gewinnchance × Pot − (1 − Gewinnchance) × Call.',
    ],
    formulas: ['EV(Call) = Gewinnchance × Pot − (1 − Gewinnchance) × Call', 'EV(Fold) = 0'],
    example: ['Flush Draw (19 % auf einer Karte) gegen 25 % Pot Odds: allein zu wenig. Mit Implied Odds kann der Call trotzdem passen.'],
    unlocks: 'Freischaltung: nach Stufe 4. Deine Aktionen werden jetzt nach EV bewertet.',
  },
  {
    n: 6,
    title: 'Saubere und schmutzige Outs',
    short: 'Hilft dir die Karte wirklich?',
    body: [
      'Ein sauberer Out macht dich zum Sieger. Ein schmutziger Out verbessert dich, gibt dem Gegner aber vielleicht ein noch besseres Blatt.',
      'Beispiel: Du jagst die Straße, die Karte bringt aber vier Herz aufs Board. Wer ein Herz hält, hat den Flush.',
      'Overcards sind unsicher: Triffst du ein Paar, kann der Gegner schon ein besseres haben.',
    ],
    formulas: ['Saubere Outs zählen voll. Unsichere Outs zählst du nur zur Hälfte oder gar nicht.'],
    example: ['Mit 8 Straßen-Outs, von denen 2 den Flush auf dem Board vollmachen, rechnest du mit 6 sauberen Outs.'],
    unlocks: 'Freischaltung: nach Stufe 5.',
  },
  {
    n: 7,
    title: 'Implied Odds',
    short: 'Was du später noch gewinnst',
    body: [
      'Implied Odds berücksichtigen Geld, das du bei einem Treffer auf späteren Straßen noch gewinnst.',
      'Sie lohnen sich bei versteckten Händen (Flush, Set) und tiefen Stacks. Bei offensichtlichen Draws zahlt der Gegner oft nichts mehr.',
      'Reverse Implied Odds: Du triffst, verlierst aber trotzdem gegen ein besseres Blatt und zahlst noch mehr.',
    ],
    formulas: ['Nötiger Zusatzgewinn = (1 − Treffer) × Call ÷ Treffer − Pot'],
    example: ['Treffer 19 %, Call 20, Pot 40: Zusatz = 0,81 × 20 ÷ 0,19 − 40 = 45. Du musst bei Treffer im Schnitt noch 45 gewinnen.'],
    unlocks: 'Freischaltung: nach Stufe 6.',
  },
  {
    n: 8,
    title: 'Kombinationen und Blocker',
    short: 'Wer schlägt mich?',
    body: [
      'Es gibt 1.326 Starthand-Kombinationen. Ein Paar hat 6, gleichfarbige Karten 4, verschiedenfarbige 12.',
      'Blocker: Hältst du eine Karte, kann der Gegner sie nicht haben. Hältst du ein Ass, hat er nur noch 3 Asse statt 4.',
      'So zählst du, wie viele Hände dich schlagen. Aus vielen Kombinationen wird eine Wahrscheinlichkeit.',
    ],
    formulas: ['Paar: 6 · gleichfarbig: 4 · verschiedenfarbig: 12', 'Mit einem Ass in der Hand: AA nur noch 3 Kombinationen, AK dann 12 − 3 = 9'],
    example: ['Du hältst A♠ K♦ auf K♣ 9♥ 5♥: KK nur 1 Kombination (zwei Könige sind weg), 99 und 55 je 3, K9 und K5 je 6, 95 9 Kombinationen.'],
    unlocks: 'Freischaltung: nach Stufe 7. Im Spiel kommt die Frage „Wer schlägt mich?“.',
  },
  {
    n: 9,
    title: 'Ranges lesen',
    short: 'Was hat der Gegner wirklich?',
    body: [
      'Eine Range ist die Menge aller Hände, mit denen ein Gegner so gespielt haben könnte. Du schätzt nicht eine Hand, sondern viele.',
      'Je mehr Aktionen er macht, desto enger wird seine Range. Die App zeigt dir nach der Hand die geschätzte Range als Matrix.',
      'Gegen die Range rechnest du deine Gewinnchance. Sie ist fast immer niedriger als gegen eine zufällige Hand.',
    ],
    formulas: ['Gewinnchance gegen Range ≠ gegen zufällige Hand', 'Top 10 % aller Starthände = 133 Kombinationen'],
    example: ['Rocky raist: seine Range ist etwa AA bis 99, AK, AQ, KQs. Max raist: fast alles.'],
    unlocks: 'Freischaltung: nach Stufe 8. Nach der Hand siehst du die Range-Matrix.',
  },
  {
    n: 10,
    title: 'Bluffs und MDF',
    short: 'Wie oft muss er bluffen?',
    body: [
      'Ein Gegner, der nur mit starken Händen setzt, ist leicht zu schlagen. Er muss auch bluffen.',
      'Der Anteil Bluffs in seiner Setz-Range hängt von der Größe ab. Gegen einen Pot-großen Einsatz sind es 33 %, gegen einen halben Pot 25 %.',
      'MDF (Minimum Defense Frequency): Dagegen musst du mindestens so oft weiterspielen, sonst bluffen Gegner profitabel.',
    ],
    formulas: ['Bluff-Anteil = Einsatz ÷ (Pot + 2 × Einsatz)', 'MDF = Pot ÷ (Pot + Einsatz)'],
    example: ['Gegner setzt 60 in 100: Bluff-Anteil 60 ÷ 220 = 27 %. MDF = 100 ÷ 160 = 62 %.'],
    unlocks: 'Freischaltung: nach Stufe 9. Im Spiel kommt die Frage „Wie oft muss er bluffen?“.',
  },
]
