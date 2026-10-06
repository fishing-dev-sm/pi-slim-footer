# pi-slim-footer

<p align="center">
  <a href="README.md">English</a> |
  <a href="README.zh-CN.md">简体中文</a> |
  <a href="README.es.md">Español</a> |
  <a href="README.fr.md">Français</a> |
  <a href="README.de.md"><strong>Deutsch</strong></a> |
  <a href="README.ja.md">日本語</a> |
  <a href="README.ko.md">한국어</a> |
  <a href="README.pt.md">Português</a> |
  <a href="README.ru.md">Русский</a>
</p>

**badges**-Theme (alle Badges invertiert)

![badges theme](https://raw.githubusercontent.com/fishing-dev-sm/pi-slim-footer/main/docs/screenshots/theme-badges.png)

**mixed**-Theme (farbige Status-Badges + gedämpfter Datentext)

![mixed theme](https://raw.githubusercontent.com/fishing-dev-sm/pi-slim-footer/main/docs/screenshots/theme-mixed.png)

> Die Screenshots werden rein programmatisch gerendert (`scripts/screenshots.sh`: das echte `src/index.ts` gibt ANSI-Zeilen aus → PIL zeichnet das PNG Zelle für Zelle) — ohne Artefakte echter Terminal-Screenshots.

Eine Einzeilen-Footer-Erweiterung für [pi](https://pi.dev) — strikt eine Zeile, Echtfarb-Badges, intelligentes Verwerfen von Segmenten auf schmalen Terminals. Ersetzt statusline-pi.

## Vorschau

```
 AUTO   deepseek/deepseek-v4-pro high   CTX ⣀⣀⣀⣀⣀⣣⣀⣀ 0.0%·1M   ⎇ main   -- tps   $0.026        ~/code/pi-fleet
```

Breites Terminal (badges-Theme, invertierte Echtfarb-Badges): Modus / Modell + Denkstufe / CTX (Braille + % + Fenster) / git / tps / Kosten; Verzeichnis rechtsbündig.

## Funktionen

- **Hauptzeile strikt einzeilig**: Unsere Inhalte besitzen Zeile 0 und brechen bei keiner Breite um; Segmente, die nicht passen, werden nach Priorität verworfen
- **Plugin-Zeilenverwaltung**: `setStatus`-Inhalte anderer Plugins müssen auf separaten Zeilen stehen (Standard `-1`, direkt unter der Hauptzeile). `/slim-footer` vergibt Zeilennummern auf einer Zahlengeraden (**positiv = über der Hauptzeile, negativ = darunter**); **gleiche Nummer = gemeinsame Zeile** (durch ein Leerzeichen getrennt), unterschiedliche Nummern = eigene Zeilen. Das Menü bietet ±1..±9 (18 Slots); die Konfigurationsdatei akzeptiert beliebige Ganzzahlen in ±99
- **Verwerfungsreihenfolge** (höhere Nummer zuerst): `cost(5) → tps(4) → git(3) → CTX(2) → model(1) → Berechtigungsmodus (0, nie verworfen)`
- **Berechtigungsmodus als First-Class-Bürger**: Das `yolo` von permission-system wird als gelbes ` AUTO `-Badge gerendert (keine nackte Textzeile mehr); `plan` → ` PLAN ` und `ask` → ` ASK WHEN NEED ` sind reserviert; andere Extension-Status erhalten ein graues Badge
- **Zwei Themes**, umschaltbar über `/slim-footer`:
  - `badges` (A): alle Badges invertiert, FACC-Stil
  - `mixed` (B): farbige Status-Badges + gedämpfter Datentext, reizarm
- **Stimmungsfarben**: CTX grün → gelb → orange → rot → dunkelrot (5 Stufen); tps nach Geschwindigkeit gefärbt (<10 blau / <30 türkis / <60 grün / ≥60 orange)
- **Niedrig gesättigte Palette**: HSL-Entsättigung (konfigurierbar) — schont die Augen bei langen Sitzungen

## Installation

`npm:pi-slim-footer` (oder einen lokalen Pfad) zu `packages` in `~/.pi/agent/settings.json` hinzufügen und `npm:statusline-pi` entfernen (beide übernehmen den Footer):

```json
{
  "packages": ["npm:pi-slim-footer", "...andere Pakete..."]
}
```

## Konfiguration

`~/.pi/agent/slim-footer.json` (alles optional, siehe [config.example.json](config.example.json)):

```json
{
  "enabled": true,
  "theme": "badges",
  "saturation": { "badgeSat": 0.3, "badgeLum": 0.72, "foreSat": 0.4 },
  "pluginLines": { "swarm-roster": 1, "noisy-ext": -2 }
}
```

## Befehl

`/slim-footer` — Menü:

1. Theme badges / mixed umschalten
2. **Plugin line positions…** — listet alle Plugins, die einen Footer-Status registriert haben (mit Vorschau des aktuellen Status), und weist jedem eine Zeilennummer (Koordinate auf der Zahlengeraden) zu:
   ```
   Line +9 … +2 / +1   → über der Hauptzeile (+1 am nächsten)
   Line  0             → slim-footer-Hauptzeile (nicht für Plugins)
   Line -1 / -2 … -9   → unter der Hauptzeile (-1 am nächsten, Standard -1)
   ```
   Plugins mit gleicher Nummer teilen eine Zeile, durch Leerzeichen getrennt; Nummern werden in `pluginLines` persistiert (die Datei akzeptiert ±99).

   > Seit v0.3.0 nutzt die Achse Zahlengeraden-Semantik (positiv = oben). Alte Konfigurationen (positiv = unten) werden beim ersten Laden automatisch negiert und mit dem Flag `axisMigrated` zurückgeschrieben.

   Renderregel für Plugin-Status: **Text, der bereits ANSI-Stile trägt, wird unverändert durchgereicht** (z. B. das türkise `MANAGER`-Badge von pi-agent-swarm); nur reiner Text erhält unser graues Badge.
3. Aktivieren / Deaktivieren (Deaktivieren stellt pis Standard-Footer wieder her)

## Datenquellen

| Segment | Quelle |
|---|---|
| Modus-Badge | Einträge in `footerData.getExtensionStatuses()`, deren Wert ein bekannter Modus ist (yolo/plan/ask) |
| Plugin-Zeilen | Alle übrigen Einträge aus `footerData.getExtensionStatuses()`, aufgeteilt nach `pluginLines` |
| Modell / Denkstufe | `ctx.model` + `pi.getThinkingLevel()` |
| CTX | `ctx.model.contextWindow` + `ctx.getContextUsage().tokens` |
| git | `footerData.getGitBranch()` (in pi eingebaut, kein git-Exec) |
| tps | Geschätzt aus `message_start/update/end`-Events (von statusline-pi übernommen) |
| Kosten | Summe der `usage.cost.total` der Assistant-Nachrichten entlang des Session-Zweigs |

## Tests (E2E)

```bash
node --experimental-strip-types e2e.mjs   # simulierte Runtime, volle Kette (76 Assertionen)
python3 e2e_tui.py                        # echte pi-TUI über pty gesteuert (14 Assertionen) → docs/e2e/report.md
```

## Design

Siehe [PLAN.md](PLAN.md). Die visuelle Sprache stammt von [famous-anime-cache-countdown](https://github.com/fishing-dev-sm/pi-famous-anime-cache-countdown).
