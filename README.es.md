# pi-slim-footer

<p align="center">
  <a href="README.md">English</a> |
  <a href="README.zh-CN.md">简体中文</a> |
  <a href="README.es.md"><strong>Español</strong></a> |
  <a href="README.fr.md">Français</a> |
  <a href="README.de.md">Deutsch</a> |
  <a href="README.ja.md">日本語</a> |
  <a href="README.ko.md">한국어</a> |
  <a href="README.pt.md">Português</a> |
  <a href="README.ru.md">Русский</a>
</p>

Tema **badges** (todas las insignias invertidas)

![badges theme](https://raw.githubusercontent.com/fishing-dev-sm/pi-slim-footer/main/docs/screenshots/theme-badges.png)

Tema **mixed** (insignias de estado en color + texto de datos atenuado)

![mixed theme](https://raw.githubusercontent.com/fishing-dev-sm/pi-slim-footer/main/docs/screenshots/theme-mixed.png)

> Las capturas se renderizan de forma puramente programática (`scripts/screenshots.sh`: el `src/index.ts` real emite líneas ANSI → PIL dibuja el PNG celda a celda) — sin artefactos de captura de terminal.

Una extensión de footer de una sola línea para [pi](https://pi.dev) — estrictamente una línea, insignias en color verdadero, descarte inteligente de segmentos en terminales estrechas. Sustituye a statusline-pi.

## Vista previa

```
 AUTO   deepseek/deepseek-v4-pro high   CTX ⣀⣀⣀⣀⣀⣀⣀⣀ 0.0%·1M   ⎇ main   -- tps   $0.026        ~/code/pi-fleet
```

Terminal ancha (tema badges, insignias invertidas en color verdadero): modo / modelo + nivel de pensamiento / CTX (braille + % + ventana) / git / tps / coste; directorio alineado a la derecha.

## Características

- **Línea principal estrictamente única**: nuestro contenido es dueño de la línea 0 y nunca se ajusta a ninguna anchura; los segmentos que no caben se descartan por prioridad
- **Gestión de líneas de plugins**: el contenido `setStatus` de otros plugins debe ir en líneas separadas (por defecto `-1`, justo debajo de la línea principal). `/slim-footer` asigna números de línea en un eje numérico (**positivo = encima de la línea principal, negativo = debajo**); **mismo número = comparten una línea** (separados por un espacio), números distintos ocupan líneas distintas. El menú ofrece ±1..±9 (18 ranuras); el archivo de configuración acepta cualquier entero en ±99
- **Orden de descarte** (el número mayor se descarta primero): `cost(5) → tps(4) → git(3) → CTX(2) → model(1) → modo de permiso (0, nunca se descarta)`
- **Modo de permiso como ciudadano de primera clase**: el `yolo` de permission-system se renderiza como insignia amarilla ` AUTO ` (ya no es una segunda línea de texto plano); `plan` → ` PLAN ` y `ask` → ` ASK WHEN NEED ` están reservados; los demás estados de extensiones reciben una insignia gris
- **Dos temas**, se cambian con `/slim-footer`:
  - `badges` (A): todas las insignias invertidas, estilo FACC
  - `mixed` (B): insignias de estado en color + texto de datos atenuado, baja estimulación
- **Colores emocionales**: CTX verde → amarillo → naranja → rojo → rojo oscuro (5 niveles); tps coloreado por velocidad (<10 azul / <30 turquesa / <60 verde / ≥60 naranja)
- **Paleta de baja saturación**: desaturación HSL (configurable) — cómoda para la vista en sesiones largas

## Instalación

Añade `npm:pi-slim-footer` (o una ruta local) a `packages` en `~/.pi/agent/settings.json`, y elimina `npm:statusline-pi` (ambos se hacen cargo del footer):

```json
{
  "packages": ["npm:pi-slim-footer", "...otros paquetes..."]
}
```

## Configuración

`~/.pi/agent/slim-footer.json` (todo opcional, ver [config.example.json](config.example.json)):

```json
{
  "enabled": true,
  "theme": "badges",
  "saturation": { "badgeSat": 0.3, "badgeLum": 0.72, "foreSat": 0.4 },
  "pluginLines": { "swarm-roster": 1, "noisy-ext": -2 }
}
```

## Comando

`/slim-footer` — menú:

1. Cambiar tema badges / mixed
2. **Plugin line positions…** — lista todos los plugins que registraron un estado en el footer (con vista previa del estado actual) y asigna un número de línea (coordenada numérica) a cada uno:
   ```
   Line +9 … +2 / +1   → encima de la línea principal (+1 es la más cercana)
   Line  0             → línea principal de slim-footer (no disponible para plugins)
   Line -1 / -2 … -9   → debajo de la línea principal (-1 es la más cercana, por defecto -1)
   ```
   Los plugins con el mismo número comparten una línea, separados por un espacio; los números se persisten en `pluginLines` (el archivo acepta ±99).

   > Desde v0.3.0 el eje usa semántica de recta numérica (positivo = arriba). Las configuraciones antiguas (positivo = abajo) se niegan automáticamente en la primera carga y se reescriben con la marca `axisMigrated`.

   Regla de renderizado de estados de plugins: **el texto que ya lleva estilos ANSI se transmite tal cual** (p. ej. la insignia cyan `MANAGER` de pi-agent-swarm); el texto plano recibe nuestra insignia gris.
3. Activar / desactivar (al desactivar se restaura el footer por defecto de pi)

## Fuentes de datos

| Segmento | Fuente |
|---|---|
| Insignia de modo | Entradas de `footerData.getExtensionStatuses()` cuyo valor es un modo conocido (yolo/plan/ask) |
| Líneas de plugins | El resto de entradas de `footerData.getExtensionStatuses()`, repartidas por `pluginLines` |
| Modelo / nivel de pensamiento | `ctx.model` + `pi.getThinkingLevel()` |
| CTX | `ctx.model.contextWindow` + `ctx.getContextUsage().tokens` |
| git | `footerData.getGitBranch()` (integrado en pi, sin ejecutar git) |
| tps | Estimado a partir de los eventos `message_start/update/end` (tomado de statusline-pi) |
| coste | Suma de `usage.cost.total` de los mensajes assistant en la rama de sesión |

## Pruebas (E2E)

```bash
node --experimental-strip-types e2e.mjs   # runtime simulado, cadena completa (76 aserciones)
python3 e2e_tui.py                        # TUI real de pi controlada por pty (14 aserciones) → docs/e2e/report.md
```

## Diseño

Ver [PLAN.md](PLAN.md). El lenguaje visual proviene de [famous-anime-cache-countdown](https://github.com/fishing-dev-sm/pi-famous-anime-cache-countdown).
