# pi-slim-footer

<p align="center">
  <a href="README.md">English</a> |
  <a href="README.zh-CN.md">简体中文</a> |
  <a href="README.es.md">Español</a> |
  <a href="README.fr.md">Français</a> |
  <a href="README.de.md">Deutsch</a> |
  <a href="README.ja.md">日本語</a> |
  <a href="README.ko.md">한국어</a> |
  <a href="README.pt.md"><strong>Português</strong></a> |
  <a href="README.ru.md">Русский</a>
</p>

Tema **badges** (todos os selos invertidos)

![badges theme](https://raw.githubusercontent.com/fishing-dev-sm/pi-slim-footer/main/docs/screenshots/theme-badges.png)

Tema **mixed** (selos de estado coloridos + texto de dados discreto)

![mixed theme](https://raw.githubusercontent.com/fishing-dev-sm/pi-slim-footer/main/docs/screenshots/theme-mixed.png)

> As capturas são renderizadas de forma puramente programática (`scripts/screenshots.sh`: o `src/index.ts` real emite linhas ANSI → PIL desenha o PNG célula a célula) — sem artefatos de captura de terminal.

Uma extensão de rodapé de uma única linha para o [pi](https://pi.dev) — estritamente uma linha, selos em cores reais, descarte inteligente de segmentos em terminais estreitos. Substitui o statusline-pi.

## Prévia

```
 AUTO   deepseek/deepseek-v4-pro high   CTX ⣀⣀⣀⣀⣀⣀⣀⣀ 0.0%·1M   ⎇ main   -- tps   $0.026        ~/code/pi-fleet
```

Terminal largo (tema badges, selos invertidos em cores reais): modo / modelo + nível de raciocínio / CTX (braille + % + janela) / git / tps / custo; diretório alinhado à direita.

## Recursos

- **Linha principal estritamente única**: nosso conteúdo é dono da linha 0 e nunca quebra em nenhuma largura; segmentos que não cabem são descartados por prioridade
- **Gerenciamento de linhas de plugins**: o conteúdo `setStatus` de outros plugins deve ir para linhas separadas (padrão `-1`, logo abaixo da linha principal). O `/slim-footer` atribui números de linha em um eixo numérico (**positivo = acima da linha principal, negativo = abaixo**); **mesmo número = compartilham uma linha** (separados por um espaço), números diferentes = linhas separadas. O menu oferece ±1..±9 (18 posições); o arquivo de configuração aceita qualquer inteiro em ±99
- **Ordem de descarte** (número maior descarta primeiro): `cost(5) → tps(4) → git(3) → CTX(2) → model(1) → modo de permissão (0, nunca descartado)`
- **Modo de permissão como cidadão de primeira classe**: o `yolo` do permission-system vira um selo amarelo ` AUTO ` (não mais uma segunda linha de texto puro); `plan` → ` PLAN ` e `ask` → ` ASK WHEN NEED ` estão reservados; demais estados de extensões recebem um selo cinza
- **Dois temas**, alternados via `/slim-footer`:
  - `badges` (A): todos os selos invertidos, estilo FACC
  - `mixed` (B): selos de estado coloridos + texto de dados discreto, baixa estimulação
- **Cores emocionais**: CTX verde → amarelo → laranja → vermelho → vermelho escuro (5 níveis); tps colorido por velocidade (<10 azul / <30 ciano / <60 verde / ≥60 laranja)
- **Paleta de baixa saturação**: dessaturação HSL (configurável) — confortável para os olhos em sessões longas

## Instalação

Adicione `npm:pi-slim-footer` (ou um caminho local) a `packages` em `~/.pi/agent/settings.json`, e remova `npm:statusline-pi` (ambos assumem o rodapé):

```json
{
  "packages": ["npm:pi-slim-footer", "...outros pacotes..."]
}
```

## Configuração

`~/.pi/agent/slim-footer.json` (tudo opcional, veja [config.example.json](config.example.json)):

```json
{
  "enabled": true,
  "theme": "badges",
  "saturation": { "badgeSat": 0.3, "badgeLum": 0.72, "foreSat": 0.4 },
  "pluginLines": { "swarm-roster": 1, "noisy-ext": -2 }
}
```

## Comando

`/slim-footer` — menu:

1. Alternar tema badges / mixed
2. **Plugin line positions…** — lista todos os plugins que registraram um status no rodapé (com prévia do status atual) e atribui um número de linha (coordenada numérica) a cada um:
   ```
   Line +9 … +2 / +1   → acima da linha principal (+1 é a mais próxima)
   Line  0             → linha principal do slim-footer (indisponível para plugins)
   Line -1 / -2 … -9   → abaixo da linha principal (-1 é a mais próxima, padrão -1)
   ```
   Plugins com o mesmo número compartilham uma linha, separados por espaço; os números persistem em `pluginLines` (o arquivo aceita ±99).

   > Desde a v0.3.0 o eixo usa semântica de reta numérica (positivo = acima). Configurações antigas (positivo = abaixo) são negadas automaticamente na primeira carga e reescritas com a marca `axisMigrated`.

   Regra de renderização de status de plugins: **texto que já carrega estilos ANSI é transmitido como está** (ex.: o selo ciano `MANAGER` do pi-agent-swarm); texto puro recebe nosso selo cinza.
3. Ativar / desativar (desativar restaura o rodapé padrão do pi)

## Fontes de dados

| Segmento | Fonte |
|---|---|
| Selo de modo | Entradas de `footerData.getExtensionStatuses()` cujo valor é um modo conhecido (yolo/plan/ask) |
| Linhas de plugins | Demais entradas de `footerData.getExtensionStatuses()`, distribuídas por `pluginLines` |
| Modelo / nível de raciocínio | `ctx.model` + `pi.getThinkingLevel()` |
| CTX | `ctx.model.contextWindow` + `ctx.getContextUsage().tokens` |
| git | `footerData.getGitBranch()` (embutido no pi, sem executar git) |
| tps | Estimado a partir dos eventos `message_start/update/end` (emprestado do statusline-pi) |
| custo | Soma de `usage.cost.total` das mensagens assistant ao longo do ramo de sessão |

## Testes (E2E)

```bash
node --experimental-strip-types e2e.mjs   # runtime simulado, cadeia completa (76 asserções)
python3 e2e_tui.py                        # TUI real do pi controlada por pty (14 asserções) → docs/e2e/report.md
```

## Design

Veja [PLAN.md](PLAN.md). A linguagem visual vem do [famous-anime-cache-countdown](https://github.com/fishing-dev-sm/pi-famous-anime-cache-countdown).
