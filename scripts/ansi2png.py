#!/usr/bin/env python3
"""ansi2png.py — 把带 ANSI 真色的终端行纯程序渲染成 PNG（不开终端、无截图杂质）

用法：python3 scripts/ansi2png.py <in.ansi> <out.png>
字体：JetBrainsMono NFM（主，含 braille/❯）→ FreeMono（⎇ 等符号）→ Noto Sans Mono CJK SC（中文）
"""
import re
import sys
import unicodedata

from fontTools.ttLib import TTCollection, TTFont
from PIL import Image, ImageDraw, ImageFont

MAIN_PATH = "/usr/share/fonts/TTF/JetBrainsMonoNerdFontMono-Regular.ttf"
SYMBOL_PATH = "/usr/share/fonts/gnu-free/FreeMono.otf"
CJK_PATH = "/usr/share/fonts/noto-cjk/NotoSansCJK-Regular.ttc"

SIZE = 26
BG = (26, 27, 38)  # #1a1b26（Tokyo Night 暗色）
FG = (169, 177, 201)  # #a9b1c9
PAD = 20


def load_cjk_index():
    """在 ttc 里找 Noto Sans Mono CJK SC 的 subfont 下标。"""
    for i, f in enumerate(TTCollection(CJK_PATH).fonts):
        names = {n.toUnicode() for n in f["name"].names if n.nameID in (1, 4, 16)}
        if any("Mono CJK SC" in n for n in names):
            return i
    return 0


def cmap(path, index=0):
    f = TTFont(path, fontNumber=index) if path.endswith(".ttc") else TTFont(path)
    return f.getBestCmap()


CJK_INDEX = load_cjk_index()
COVERS = [
    (ImageFont.truetype(MAIN_PATH, SIZE), cmap(MAIN_PATH)),
    (ImageFont.truetype(SYMBOL_PATH, SIZE), cmap(SYMBOL_PATH)),
    (ImageFont.truetype(CJK_PATH, SIZE, index=CJK_INDEX), cmap(CJK_PATH, CJK_INDEX)),
]

ANSI_RE = re.compile(r"\x1b\[([0-9;]*)m")


def parse_line(line):
    """ANSI 行 → [(char, fg, bg), ...]，fg/bg 为 (r,g,b) 或 None。"""
    cells = []
    fg = bg = None
    pos = 0
    for m in ANSI_RE.finditer(line):
        for ch in line[pos : m.start()]:
            cells.append((ch, fg, bg))
        params = m.group(1)
        parts = [int(p) for p in params.split(";")] if params else [0]
        i = 0
        while i < len(parts):
            p = parts[i]
            if p == 0:
                fg = bg = None
            elif p == 39:
                fg = None
            elif p == 49:
                bg = None
            elif p == 38 and i + 4 < len(parts) + 1 and parts[i + 1] == 2:
                fg = (parts[i + 2], parts[i + 3], parts[i + 4])
                i += 4
            elif p == 48 and i + 4 < len(parts) + 1 and parts[i + 1] == 2:
                bg = (parts[i + 2], parts[i + 3], parts[i + 4])
                i += 4
            i += 1
        pos = m.end()
    for ch in line[pos:]:
        cells.append((ch, fg, bg))
    return cells


def char_width(ch):
    return 2 if unicodedata.east_asian_width(ch) in ("W", "F") else 1


def font_for(ch):
    cp = ord(ch)
    for font, cm in COVERS:
        if cp in cm:
            return font
    return COVERS[0][0]


def main():
    src, out = sys.argv[1], sys.argv[2]
    rows = [parse_line(l) for l in open(src, encoding="utf-8").read().split("\n")]

    main_font = COVERS[0][0]
    cell_w = round(main_font.getlength("0"))
    asc, desc = main_font.getmetrics()
    cell_h = asc + desc + 2

    cols = max(sum(char_width(ch) for ch, _, _ in row) for row in rows)
    img = Image.new("RGB", (PAD * 2 + cols * cell_w, PAD * 2 + len(rows) * cell_h), BG)
    draw = ImageDraw.Draw(img)

    for y, row in enumerate(rows):
        x = 0
        for ch, fg, bg in row:
            w = char_width(ch)
            if bg:
                draw.rectangle(
                    [PAD + x * cell_w, PAD + y * cell_h, PAD + (x + w) * cell_w, PAD + (y + 1) * cell_h],
                    fill=bg,
                )
            if ch != " ":
                draw.text(
                    (PAD + x * cell_w, PAD + y * cell_h + 1),
                    ch,
                    font=font_for(ch),
                    fill=fg or FG,
                )
            x += w

    img.save(out)
    print(f"✅ {out}（{img.width}×{img.height}）")


if __name__ == "__main__":
    main()
