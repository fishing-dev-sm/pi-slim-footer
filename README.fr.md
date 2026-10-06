# pi-slim-footer

<p align="center">
  <a href="README.md">English</a> |
  <a href="README.zh-CN.md">简体中文</a> |
  <a href="README.es.md">Español</a> |
  <a href="README.fr.md"><strong>Français</strong></a> |
  <a href="README.de.md">Deutsch</a> |
  <a href="README.ja.md">日本語</a> |
  <a href="README.ko.md">한국어</a> |
  <a href="README.pt.md">Português</a> |
  <a href="README.ru.md">Русский</a>
</p>

Thème **badges** (tous les badges inversés)

![badges theme](https://raw.githubusercontent.com/fishing-dev-sm/pi-slim-footer/main/docs/screenshots/theme-badges.png)

Thème **mixed** (badges d'état colorés + texte de données atténué)

![mixed theme](https://raw.githubusercontent.com/fishing-dev-sm/pi-slim-footer/main/docs/screenshots/theme-mixed.png)

> Les captures sont rendues de manière purement programmatique (`scripts/screenshots.sh` : le vrai `src/index.ts` émet des lignes ANSI → PIL dessine le PNG cellule par cellule) — sans artefacts de capture de terminal.

Une extension de footer sur une seule ligne pour [pi](https://pi.dev) — strictement une ligne, badges en vraies couleurs, abandon intelligent des segments sur terminaux étroits. Remplace statusline-pi.

## Aperçu

```
 AUTO   deepseek/deepseek-v4-pro high   CTX ⣀⣀⣀⣀⣀⣀⣀⣀ 0.0%·1M   ⎇ main   -- tps   $0.026        ~/code/pi-fleet
```

Terminal large (thème badges, badges inversés en vraies couleurs) : mode / modèle + niveau de réflexion / CTX (braille + % + fenêtre) / git / tps / coût ; répertoire aligné à droite.

## Fonctionnalités

- **Ligne principale strictement unique** : notre contenu possède la ligne 0 et ne passe jamais à la ligne, quelle que soit la largeur ; les segments qui ne rentrent pas sont abandonnés par priorité
- **Gestion des lignes de plugins** : le contenu `setStatus` des autres plugins doit aller sur des lignes séparées (par défaut `-1`, juste sous la ligne principale). `/slim-footer` attribue des numéros de ligne sur un axe numérique (**positif = au-dessus de la ligne principale, négatif = en dessous**) ; **même numéro = partage d'une ligne** (séparés par un espace), numéros différents = lignes séparées. Le menu propose ±1..±9 (18 emplacements) ; le fichier de configuration accepte tout entier dans ±99
- **Ordre d'abandon** (le plus grand numéro est abandonné en premier) : `cost(5) → tps(4) → git(3) → CTX(2) → model(1) → mode de permission (0, jamais abandonné)`
- **Mode de permission citoyen de première classe** : le `yolo` de permission-system s'affiche comme badge jaune ` AUTO ` (fini la deuxième ligne en texte brut) ; `plan` → ` PLAN ` et `ask` → ` ASK WHEN NEED ` sont réservés ; les autres états d'extensions reçoivent un badge gris
- **Deux thèmes**, commutables via `/slim-footer` :
  - `badges` (A) : tous les badges inversés, style FACC
  - `mixed` (B) : badges d'état colorés + texte de données atténué, faible stimulation
- **Couleurs d'humeur** : CTX vert → jaune → orange → rouge → rouge foncé (5 niveaux) ; tps coloré selon la vitesse (<10 bleu / <30 turquoise / <60 vert / ≥60 orange)
- **Palette à faible saturation** : désaturation HSL (configurable) — ménage les yeux sur les longues sessions

## Installation

Ajoutez `npm:pi-slim-footer` (ou un chemin local) à `packages` dans `~/.pi/agent/settings.json`, et retirez `npm:statusline-pi` (les deux prennent le contrôle du footer) :

```json
{
  "packages": ["npm:pi-slim-footer", "...autres paquets..."]
}
```

## Configuration

`~/.pi/agent/slim-footer.json` (tout est optionnel, voir [config.example.json](config.example.json)) :

```json
{
  "enabled": true,
  "theme": "badges",
  "saturation": { "badgeSat": 0.3, "badgeLum": 0.72, "foreSat": 0.4 },
  "pluginLines": { "swarm-roster": 1, "noisy-ext": -2 }
}
```

## Commande

`/slim-footer` — menu :

1. Changer de thème badges / mixed
2. **Plugin line positions…** — liste tous les plugins ayant enregistré un état de footer (avec aperçu de l'état courant) et attribue un numéro de ligne (coordonnée numérique) à chacun :
   ```
   Line +9 … +2 / +1   → au-dessus de la ligne principale (+1 au plus près)
   Line  0             → ligne principale de slim-footer (non accessible aux plugins)
   Line -1 / -2 … -9   → en dessous de la ligne principale (-1 au plus près, défaut -1)
   ```
   Les plugins de même numéro partagent une ligne, séparés par un espace ; les numéros persistent dans `pluginLines` (le fichier accepte ±99).

   > Depuis v0.3.0, l'axe suit la sémantique de la droite numérique (positif = haut). Les anciennes configurations (positif = bas) sont automatiquement inversées au premier chargement et réécrites avec le marqueur `axisMigrated`.

   Règle de rendu des états de plugins : **le texte déjà porteur de styles ANSI est transmis tel quel** (ex. le badge cyan `MANAGER` de pi-agent-swarm) ; le texte brut reçoit notre badge gris.
3. Activer / désactiver (la désactivation restaure le footer par défaut de pi)

## Sources de données

| Segment | Source |
|---|---|
| Badge de mode | Entrées de `footerData.getExtensionStatuses()` dont la valeur est un mode connu (yolo/plan/ask) |
| Lignes de plugins | Toutes les autres entrées de `footerData.getExtensionStatuses()`, réparties par `pluginLines` |
| Modèle / niveau de réflexion | `ctx.model` + `pi.getThinkingLevel()` |
| CTX | `ctx.model.contextWindow` + `ctx.getContextUsage().tokens` |
| git | `footerData.getGitBranch()` (intégré à pi, sans exécuter git) |
| tps | Estimé depuis les événements `message_start/update/end` (emprunté à statusline-pi) |
| coût | Somme des `usage.cost.total` des messages assistant sur la branche de session |

## Tests (E2E)

```bash
node --experimental-strip-types e2e.mjs   # runtime simulé, chaîne complète (76 assertions)
python3 e2e_tui.py                        # vraie TUI pi pilotée par pty (14 assertions) → docs/e2e/report.md
```

## Conception

Voir [PLAN.md](PLAN.md). Le langage visuel provient de [famous-anime-cache-countdown](https://github.com/fishing-dev-sm/pi-famous-anime-cache-countdown).
