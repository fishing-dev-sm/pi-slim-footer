#!/usr/bin/env bash
# scripts/screenshots.sh — 重新生成 README 截图（纯程序渲染：node 出 ANSI 行 → PIL 画 PNG，无截图杂质）
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p docs/screenshots
for t in badges mixed; do
	node --experimental-strip-types scripts/render_lines.mjs "$t" "/tmp/slim-footer-$t.ansi"
	python3 scripts/ansi2png.py "/tmp/slim-footer-$t.ansi" "docs/screenshots/theme-$t.png"
done
