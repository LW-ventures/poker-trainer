# Pokerschule

Hold'em lernen am echten Tisch: du gegen drei Bots mit unterschiedlichen Spielstilen, dazu Fragen zu Outs, Pot Odds und Wahrscheinlichkeiten, ein Showdown am Tisch, eine Statistik-Seite und ein Lernpfad. Läuft im Browser und lässt sich auf iPhone und iPad als App installieren. Alle Daten bleiben auf dem Gerät, es gibt nur Spielgeld.

- `app/` enthält den Quellcode (Vite, React, TypeScript). Start und Aufbau stehen in `app/README.md`.
- `docs/` ist der fertige Build, den GitHub Pages ausliefert.

## Mit Freunden spielen (online)

Eine gemeinsame Lobby ohne Konto: Name eintragen, warten, spielen. Es gibt 4 bis 8 Plätze, fehlende Spieler füllen Bots auf (2 Spieler = 2 Bots, ab 4 keine). Fragen und Bewertung vom Coach laufen wie im Einzelspiel. Den Tisch leitet eine Supabase Edge Function (`app/server/index.ts`, gebündelt mit rolldown), die Spielstand und Karten in einer geschützten Tabelle hält. Die Spiellogik liegt in `app/src/online/`.

## Neu bauen und veröffentlichen

```powershell
cd app
npm install
npm run build:pages
```

`build:pages` schreibt den Build nach `docs/`. Danach committen und pushen.
