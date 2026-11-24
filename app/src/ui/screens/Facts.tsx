import { ArrowLeft } from '@phosphor-icons/react'
import { hitChance, ruleOfThumb } from '../../engine/odds'
import { pct } from '../../engine/odds'

const DRAWS: [string, number][] = [
  ['Flush Draw + offene Straße', 15],
  ['Flush Draw + Gutshot', 12],
  ['Flush Draw', 9],
  ['Offener Straight Draw', 8],
  ['Zwei Overcards', 6],
  ['Gutshot', 4],
  ['Pocket Pair auf Drilling', 2],
]

function T({ head, rows }: { head: string[]; rows: (string | number)[][] }) {
  return (
    <table className="factgrid">
      <thead>
        <tr>
          {head.map((h, i) => (
            <th key={i} className={i > 0 ? 'n' : ''}>
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}>
            {r.map((c, j) => (
              <td key={j} className={j > 0 ? 'n' : ''}>
                {c}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export function Facts({ onBack }: { onBack: () => void }) {
  return (
    <div className="screen">
      <div className="topbar">
        <button className="icon-btn" aria-label="Zurück" onClick={onBack}>
          <ArrowLeft size={24} />
        </button>
        <h1>Spickzettel</h1>
      </div>

      <h2 className="h-section">Outs und Trefferchance</h2>
      <T
        head={['Draw', 'Outs', '1 Karte', '2 Karten', '2/4-Regel']}
        rows={DRAWS.map(([n, o]) => [n, o, pct(hitChance(o, 46, 1), 1) + ' %', pct(hitChance(o, 47, 2), 1) + ' %', ruleOfThumb(o, 2) + ' %'])}
      />
      <p className="lead" style={{ fontSize: 14, marginTop: 8 }}>
        Eine Karte gerechnet mit 46 unbekannten Karten (Turn zum River), zwei Karten mit 47 (Flop bis River). Faustregel: Outs × 4, ab 9 Outs minus (Outs − 8).
      </p>

      <h2 className="h-section">Formeln</h2>
      <div className="formula">
        <div>Pot Odds = Call ÷ (Pot + Call)</div>
        <div>EV(Call) = Chance × Pot − (1 − Chance) × Call</div>
        <div>Bluff-Anteil = Einsatz ÷ (Pot + 2 × Einsatz)</div>
        <div>MDF = Pot ÷ (Pot + Einsatz)</div>
        <div>Nötiger Zusatz = (1 − Treffer) × Call ÷ Treffer − Pot</div>
      </div>
      <T
        head={['Einsatz', 'Pot Odds', 'Bluff-Anteil', 'MDF']}
        rows={[
          ['Ein Drittel Pot', '20 %', '20 %', '75 %'],
          ['Halber Pot', '25 %', '25 %', '67 %'],
          ['Dreiviertel Pot', '30 %', '30 %', '57 %'],
          ['Ganzer Pot', '33 %', '33 %', '50 %'],
          ['Doppelter Pot', '40 %', '40 %', '33 %'],
        ]}
      />

      <h2 className="h-section">Preflop</h2>
      <T
        head={['Situation', 'Wahrscheinlichkeit']}
        rows={[
          ['Pocket Pair', '5,9 % (1 von 17)'],
          ['Genau Asse (AA)', '0,45 % (1 von 221)'],
          ['Gleichfarbige Karten', '23,5 %'],
          ['Pocket Pair trifft Drilling am Flop', '11,8 %'],
          ['Zwei Karten paaren sich am Flop', '32,4 %'],
          ['Gleichfarbig: Flush bis zum River', '6,4 %'],
        ]}
      />

      <h2 className="h-section">Typische Duelle</h2>
      <T
        head={['Duell', 'Gewinnchance']}
        rows={[
          ['AA gegen KK', '82 % : 18 %'],
          ['QQ gegen 88', '80 % : 20 %'],
          ['AK gegen AQ (dominiert)', '74 % : 26 %'],
          ['22 gegen AK (Coinflip)', '52 % : 48 %'],
          ['AA gegen zwei zufällige Hände', 'etwa 74 %'],
          ['AA gegen drei zufällige Hände', 'etwa 64 %'],
        ]}
      />

      <h2 className="h-section">Hände nach sieben Karten</h2>
      <T
        head={['Blatt', 'Häufigkeit']}
        rows={[
          ['Hohe Karte', '17,4 %'],
          ['Ein Paar', '43,8 %'],
          ['Zwei Paare', '23,5 %'],
          ['Drilling', '4,8 %'],
          ['Straße', '4,6 %'],
          ['Flush', '3,0 %'],
          ['Full House', '2,6 %'],
          ['Vierling', '0,17 %'],
        ]}
      />

      <h2 className="h-section">Kombinationen</h2>
      <T
        head={['Handtyp', 'Kombinationen']}
        rows={[
          ['Alle Starthände', '1.326'],
          ['Verschiedene Starthandtypen', '169'],
          ['Paar (z. B. KK)', '6'],
          ['Gleichfarbig (z. B. AKs)', '4'],
          ['Verschiedenfarbig (z. B. AKo)', '12'],
        ]}
      />
    </div>
  )
}
