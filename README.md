# pi-slim-footer

<p align="center">
  <a href="README.md"><strong>English</strong></a> |
  <a href="README.zh-CN.md">简体中文</a> |
  <a href="README.es.md">Español</a> |
  <a href="README.fr.md">Français</a> |
  <a href="README.de.md">Deutsch</a> |
  <a href="README.ja.md">日本語</a> |
  <a href="README.ko.md">한국어</a> |
  <a href="README.pt.md">Português</a> |
  <a href="README.ru.md">Русский</a>
</p>

**badges** theme (all inverted badges)

![badges theme](https://raw.githubusercontent.com/fishing-dev-sm/pi-slim-footer/main/docs/screenshots/theme-badges.png)

**mixed** theme (colored status badges + muted data text)

![mixed theme](https://raw.githubusercontent.com/fishing-dev-sm/pi-slim-footer/main/docs/screenshots/theme-mixed.png)

> Screenshots are rendered purely programmatically (`scripts/screenshots.sh`: real `src/index.ts` emits ANSI lines → PIL draws the PNG cell by cell) — no terminal-screenshot artifacts.

A one-line footer extension for [pi](https://pi.dev) — strictly one line, true-color badges, smart segment dropping on narrow terminals. Replaces statusline-pi.

## Preview

```
 AUTO   deepseek/deepseek-v4-pro high   CTX ⣀⣀⣀⣀⣀⣀⣀⣀ 0.0%·1M   ⎇ main   -- tps   $0.026        ~/code/pi-fleet
```

Wide terminal (badges theme, true-color inverted badges): mode / model + thinking level / CTX (braille + % + window) / git / tps / cost; directory right-aligned.

## Features

- **Main line strictly single-line**: our own content owns line 0 and never wraps at any width; segments that don't fit are dropped by priority
- **Plugin line management**: other plugins' `setStatus` content must go on separate lines (default `-1`, right below the main line). `/slim-footer` assigns line numbers on a number-line axis (**positive = above the main line, negative = below**); **same number = share one line** (space-separated), different numbers get separate lines. The menu offers ±1..±9 (18 slots); the config file accepts any integer in ±99
- **Drop order** (higher number drops first): `cost(5) → tps(4) → git(3) → CTX(2) → model(1) → permission mode (0, never dropped)`
- **Permission mode as a first-class citizen**: permission-system's `yolo` renders as a yellow ` AUTO ` badge (no longer a bare-text second line); `plan` → ` PLAN ` and `ask` → ` ASK WHEN NEED ` are reserved; other extension statuses get a plain gray badge
- **Two themes**, switch via `/slim-footer`:
  - `badges` (A): all inverted badges, FACC style
  - `mixed` (B): colored status badges + muted data text, low-stimulation
- **Mood colors**: CTX green → yellow → orange → red → dark red (5 levels); tps colored by speed (<10 blue / <30 teal / <60 green / ≥60 orange)
- **Low-saturation palette**: HSL desaturation (configurable) — easy on the eyes during long sessions

## Installation

Add `npm:pi-slim-footer` (or a local path) to `packages` in `~/.pi/agent/settings.json`, and remove `npm:statusline-pi` (both take over the footer):

```json
{
  "packages": ["npm:pi-slim-footer", "...other packages..."]
}
```

## Configuration

`~/.pi/agent/slim-footer.json` (all optional, see [config.example.json](config.example.json)):

```json
{
  "enabled": true,
  "theme": "badges",
  "saturation": { "badgeSat": 0.3, "badgeLum": 0.72, "foreSat": 0.4 },
  "pluginLines": { "swarm-roster": 1, "noisy-ext": -2 }
}
```

## Command

`/slim-footer` — menu:

1. Switch theme badges / mixed
2. **Plugin line positions…** — lists all plugins that registered a footer status (with a preview of the current status) and assigns a line number (number-line coordinate) to each:
   ```
   Line +9 … +2 / +1   → above the main line (+1 is closest to it)
   Line  0             → slim-footer main line (not available to plugins)
   Line -1 / -2 … -9   → below the main line (-1 is closest, default -1)
   ```
   Plugins with the same line number share one line, space-separated; line numbers persist to `pluginLines` (the config file accepts ±99).

   > Since v0.3.0 the axis uses number-line semantics (positive = up). Old configs (positive = down) are auto-negated on first load and written back with an `axisMigrated` flag.

   Plugin status rendering rule: **text that already carries ANSI styles is passed through verbatim** (e.g. pi-agent-swarm's cyan `MANAGER` badge); plain text gets our gray badge.
3. Enable / disable (disabling restores pi's default footer)

## Data sources

| Segment | Source |
|---|---|
| Mode badge | Entries in `footerData.getExtensionStatuses()` whose value is a known mode (yolo/plan/ask) |
| Plugin lines | All other entries from `footerData.getExtensionStatuses()`, split by `pluginLines` |
| Model / thinking level | `ctx.model` + `pi.getThinkingLevel()` |
| CTX | `ctx.model.contextWindow` + `ctx.getContextUsage().tokens` |
| git | `footerData.getGitBranch()` (built into pi, no git exec) |
| tps | Estimated from `message_start/update/end` events (borrowed from statusline-pi) |
| cost | Sum of assistant `usage.cost.total` along the session branch |

## Tests (E2E)

```bash
node --experimental-strip-types e2e.mjs   # simulated runtime, full chain (76 assertions)
python3 e2e_tui.py                        # real pi TUI driven over a pty (14 assertions) → docs/e2e/report.md
```

## Design

See [PLAN.md](PLAN.md). Visual language originates from [famous-anime-cache-countdown](https://github.com/fishing-dev-sm/pi-famous-anime-cache-countdown).
