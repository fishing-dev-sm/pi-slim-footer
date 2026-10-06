# pi-slim-footer

<p align="center">
  <a href="README.md">English</a> |
  <a href="README.zh-CN.md">简体中文</a> |
  <a href="README.es.md">Español</a> |
  <a href="README.fr.md">Français</a> |
  <a href="README.de.md">Deutsch</a> |
  <a href="README.ja.md"><strong>日本語</strong></a> |
  <a href="README.ko.md">한국어</a> |
  <a href="README.pt.md">Português</a> |
  <a href="README.ru.md">Русский</a>
</p>

**badges** テーマ（全セグメント反転バッジ）

![badges theme](https://raw.githubusercontent.com/fishing-dev-sm/pi-slim-footer/main/docs/screenshots/theme-badges.png)

**mixed** テーマ（状態はカラーバッジ + データは落ち着いた文字色）

![mixed theme](https://raw.githubusercontent.com/fishing-dev-sm/pi-slim-footer/main/docs/screenshots/theme-mixed.png)

> スクリーンショットは完全にプログラムでレンダリングしています（`scripts/screenshots.sh`：実際の `src/index.ts` が ANSI 行を出力 → PIL がセル単位で PNG を描画）。端末スクリーンショットの混入要素はありません。

[pi](https://pi.dev) 用の 1 行フッター拡張 — 厳密に 1 行、トゥルーカラーバッジ、狭い端末では賢くセグメントを間引きます。statusline-pi の代替です。

## プレビュー

```
 AUTO   deepseek/deepseek-v4-pro high   CTX ⣀⣀⣀⣀⣀⣀⣀⣀ 0.0%·1M   ⎇ main   -- tps   $0.026        ~/code/pi-fleet
```

広い端末（badges テーマ、トゥルーカラー反転バッジ）：モード / モデル+思考レベル / CTX（braille+%+ウィンドウ）/ git / tps / コスト。ディレクトリは右寄せ。

## 特徴

- **メイン行は厳密に 1 行**：独自コンテンツは 0 行目を占有し、どの幅でも折り返しません。収まらないセグメントは優先度順に破棄
- **プラグイン行管理**：他プラグインの `setStatus` 内容は必ず別行へ（デフォルト `-1`、メイン行のすぐ下）。`/slim-footer` で数直線座標の行番号を割り当て（**正 = メイン行の上、負 = 下**）。**同じ番号は 1 行に同居**（半角スペース区切り）、異なる番号は別行。メニューは ±1..±9 の 18 スロット、設定ファイルでは ±99 の任意の整数を手書き可能
- **破棄順**（数字が大きいほど先に破棄）：`cost(5) → tps(4) → git(3) → CTX(2) → model(1) → 権限モード(0、破棄しない)`
- **権限モードは第一級市民**：permission-system の `yolo` は黄色の ` AUTO ` バッジとして描画（裸テキストの 2 行目ではありません）。`plan` → ` PLAN `、`ask` → ` ASK WHEN NEED ` も予約済み。他の拡張ステータスは素朴なグレーバッジ
- **2 つのテーマ**、`/slim-footer` で切り替え：
  - `badges`（A）：全反転バッジ、FACC スタイル
  - `mixed`（B）：状態はカラーバッジ + データは落ち着いた文字色、低刺激
- **感情色**：CTX は緑→黄→橙→赤→深紅の 5 段階。tps は速度で変色（<10 青 / <30 ティール / <60 緑 / ≥60 橙）
- **低彩度パレット**：HSL 減彩（設定可能）— 長時間の利用でも目に優しい

## インストール

`~/.pi/agent/settings.json` の `packages` に `npm:pi-slim-footer`（またはローカルパス）を追加し、`npm:statusline-pi` を削除します（両者ともフッターを乗っ取るため）：

```json
{
  "packages": ["npm:pi-slim-footer", "...他のパッケージ..."]
}
```

## 設定

`~/.pi/agent/slim-footer.json`（すべて任意。[config.example.json](config.example.json) 参照）：

```json
{
  "enabled": true,
  "theme": "badges",
  "saturation": { "badgeSat": 0.3, "badgeLum": 0.72, "foreSat": 0.4 },
  "pluginLines": { "swarm-roster": 1, "noisy-ext": -2 }
}
```

## コマンド

`/slim-footer` — メニュー：

1. テーマ badges / mixed の切り替え
2. **Plugin line positions…** — フッターステータスを登録している全プラグインを一覧表示（現在のステータスのプレビュー付き）し、それぞれに行番号（数直線座標）を割り当て：
   ```
   Line +9 … +2 / +1   → メイン行の上（+1 が最も近い）
   Line  0             → slim-footer のメイン行（プラグインには開放しない）
   Line -1 / -2 … -9   → メイン行の下（-1 が最も近い、デフォルト -1）
   ```
   同じ行番号のプラグインは 1 行に同居（スペース区切り）。行番号は `pluginLines` に永続化（設定ファイルは ±99 まで受け付け）。

   > v0.3.0 以降、座標軸は数直線の意味（正 = 上）です。旧設定（正 = 下）は初回読み込み時に自動で符号反転され、`axisMigrated` フラグ付きで書き戻されます。

   プラグインステータスの描画ルール：**ANSI スタイルを既に含むテキストはそのまま透過**（例：pi-agent-swarm のシアン色 `MANAGER` バッジ）。プレーンテキストのみグレーバッジで包みます。
3. 有効化 / 無効化（無効化すると pi デフォルトのフッターに戻る）

## データソース

| セグメント | ソース |
|---|---|
| モードバッジ | `footerData.getExtensionStatuses()` のうち値が既知モード（yolo/plan/ask）のエントリ |
| プラグイン行 | `footerData.getExtensionStatuses()` の残りのエントリを `pluginLines` で振り分け |
| モデル / 思考レベル | `ctx.model` + `pi.getThinkingLevel()` |
| CTX | `ctx.model.contextWindow` + `ctx.getContextUsage().tokens` |
| git | `footerData.getGitBranch()`（pi 組み込み。git は exec しない） |
| tps | `message_start/update/end` イベントから推定（statusline-pi から借用） |
| コスト | セッションブランチ上の assistant `usage.cost.total` の累計 |

## テスト（E2E）

```bash
node --experimental-strip-types e2e.mjs   # 模擬ランタイムで全チェーン（76 アサーション）
python3 e2e_tui.py                        # pty 駆動の実 pi TUI（14 アサーション）→ docs/e2e/report.md
```

## 設計

[PLAN.md](PLAN.md) を参照。ビジュアル言語は [famous-anime-cache-countdown](https://github.com/fishing-dev-sm/pi-famous-anime-cache-countdown) に由来します。
