# Pokerschule

Hold'em lernen am echten Tisch: du gegen drei Bots (vier Spieler am Tisch), mit Fragen zu Outs, Pot Odds und Wahrscheinlichkeiten. Läuft im Browser, installierbar als App auf iPhone und iPad (PWA). Alle Daten bleiben auf dem Gerät.

## Starten

```powershell
npm install
npm run dev      # Entwicklung, http://localhost:5173
npm test         # 25 Tests (Engine, Bots, Coach)
npm run build    # Produktions-Build nach dist/
```

## Aufbau

| Ordner | Inhalt |
|---|---|
| `src/engine` | Karten, 7-Karten-Bewertung, Odds, Equity (exakt und Monte-Carlo), Outs-Erkennung, Spielablauf mit Side Pots |
| `src/bots` | Vier Stile (Rocky, Carla, Max, Rex), Entscheidungslogik mit Bluffs, Range-Schätzung aus den Aktionen |
| `src/coach` | Fragen, Bewertung, EV-Analyse der Entscheidungen, Auswahl der Spots |
| `src/learn` | Lernstufen 0 bis 10 und Drill-Generatoren |
| `src/stats` | Auswertung für die Statistik-Seite, Leak-Finder |
| `src/store` | Spielstand (Zustand), Einstellungen, Lernfortschritt, Datenbank (IndexedDB über Dexie) |
| `src/ui` | Designsystem (`styles.css`) und alle Screens |

## Formensprache

Flächen mit abgeschrägten Ecken (oben rechts, unten links), Bedienelemente mit der Gegenrichtung (oben links, unten rechts), Chips und Avatare als Kreise, Spielkarten mit echtem Kartenradius, Eingaben nur als Unterstrich. Eine Akzentfarbe: Gold. Schriften: Bricolage Grotesque, Geist, Geist Mono (selbst gehostet).

## Icons neu erzeugen

```powershell
./scripts/make-icons.ps1
```
