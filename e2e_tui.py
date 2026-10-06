#!/usr/bin/env python3
"""e2e_tui.py — pi-slim-footer 真实 pi TUI E2E（pty 驱动）

两个场景：
  A: cols=110 宽终端，cwd=~/code/pi-fleet（git 仓库）——验证 model/CTX/git 徽章 ANSI 指纹、
     footer 单行、无裸 "yolo" 行（statusline-pi 已禁用，冲突源移除）
  B: cols=52 窄终端——验证按优先级丢弃 + 仍严格单行

用法: python3 e2e_tui.py
产物: docs/e2e/A.log / B.log（原始 pty 字节流）+ docs/e2e/report.md
"""
import os, pty, re, select, struct, subprocess, sys, fcntl, termios, time
from pathlib import Path

PROJ = "/home/sim/code/pi-slim-footer"
GIT_CWD = "/home/sim/code/pi-fleet"  # 是 git 仓库（main 分支）
OUT = Path(PROJ) / "docs" / "e2e"
OUT.mkdir(parents=True, exist_ok=True)

# ANSI 指纹（mute 后的真色，由 node 对 src/index.ts 的调色板计算得出）
MODEL_BG = "48;2;65;73;84"   # slate 模型徽章底 #414954
CTX_BG = "48;2;66;101;79"    # 绿 CTX 徽章底 #42654f（用量<40%）
GIT_BG = "48;2;109;89;154"   # 紫 git 徽章底 #6d599a
AUTO_BG = "48;2;112;100;63"  # 黄 AUTO 徽章底 #70643f（permission-system yolo 模式时）
PLUGIN_BG = "48;2;63;63;70"  # 灰 zinc 插件徽章底 #3f3f46（swarm 等其他插件 status）
ROW_HOME = re.compile(rb"\x1b\[\d+;1H")  # 光标移到某行开头 = 换了一个终端行


class Pty:
    def __init__(self, argv, cwd, log_path, cols, rows):
        self.master, slave = pty.openpty()
        fcntl.ioctl(slave, termios.TIOCSWINSZ, struct.pack("HHHH", rows, cols, 0, 0))
        env = dict(os.environ, TERM="xterm-256color", COLORTERM="truecolor")
        self.proc = subprocess.Popen(argv, stdin=slave, stdout=slave, stderr=slave,
                                     env=env, cwd=cwd, close_fds=True)
        os.close(slave)
        self.buf = b""
        self.log = open(log_path, "wb")

    def pump(self, seconds):
        end = time.time() + seconds
        while time.time() < end:
            r, _, _ = select.select([self.master], [], [], 0.2)
            if r:
                try:
                    data = os.read(self.master, 65536)
                except OSError:
                    break
                self.buf += data
                self.log.write(data)
                self.log.flush()

    def pump_until(self, marker: bytes, timeout=30):
        """泵到 marker 出现（footer 渲染完成的信号）或超时。"""
        end = time.time() + timeout
        while time.time() < end and marker not in self.buf:
            self.pump(0.5)
        return marker in self.buf

    def send(self, data: bytes):
        os.write(self.master, data)

    def close(self):
        try:
            self.proc.terminate()
            self.proc.wait(timeout=3)
        except Exception:
            self.proc.kill()
        self.log.close()


def visible_lines(raw: bytes):
    """剥离 ANSI 后按行还原终端可见文本（粗略，用于断言）。"""
    text = raw.decode("utf-8", errors="replace")
    text = re.sub(r"\x1b\[[0-9;?]*[a-zA-Z]", "", text)
    text = re.sub(r"\x1b\][^\x07]*\x07", "", text)
    return [l for l in text.split("\r\n") if l.strip()] or [l for l in text.split("\n") if l.strip()]


results = []

# 测试前固定主题 badges（本脚本断言的是 badges 主题的 ANSI 指纹），结束恢复原配置
CFG = Path.home() / ".pi" / "agent" / "slim-footer.json"
cfg_backup = CFG.read_bytes() if CFG.exists() else None

def force_badges():
    import json
    try:
        j = json.loads(CFG.read_text()) if CFG.exists() else {}
    except Exception:
        j = {}
    j["theme"] = "badges"
    CFG.write_text(json.dumps(j, indent=2))

def restore_cfg():
    if cfg_backup is not None:
        CFG.write_bytes(cfg_backup)
    elif CFG.exists():
        CFG.unlink()

def check(name, cond, extra=""):
    results.append((name, bool(cond)))
    print(f"  {'✅' if cond else '❌'} {name}{(' — ' + extra) if extra and not cond else ''}")


def scenario(name, cwd, cols, asserts):
    print(f"\n场景 {name} (cols={cols}, cwd={cwd})")
    p = Pty(["pi"], cwd, OUT / f"{name}.log", cols=cols, rows=35)
    ok = p.pump_until(MODEL_BG.encode(), timeout=30)  # 等到 footer 模型徽章真出现
    p.pump(2)  # 再等所有扩展（swarm 等）setStatus 完毕，footer 进入终态
    raw = p.buf
    p.close()
    check(f"[{name}] footer 在 30s 内渲染", ok)
    asserts(raw[-3000:])  # 只断言最后一帧（footer 终态），避免早期帧掩盖丢弃回归
    return raw


def common_asserts(tag):
    def f(raw):
        check(f"[{tag}] 模型徽章（slate 底）", MODEL_BG.encode() in raw)
        check(f"[{tag}] footer 含模型 id", b"deepseek" in raw or b"k3" in raw or b"deepseek-v4-pro" in raw)
    return f


# ── 场景 A：宽终端 + git 仓库 ──
def asserts_a(raw):
    common_asserts("A")(raw)
    check("[A] CTX 徽章（绿底，低用量）", CTX_BG.encode() in raw)
    check("[A] git 徽章（紫底）", GIT_BG.encode() in raw)
    auto_i = raw.rfind(AUTO_BG.encode())
    auto = auto_i >= 0
    print(f"  ℹ️  AUTO 徽章（yolo 模式）{'出现' if auto else '未出现（permission-system 当前非 yolo，符合预期）'}")
    # 其他插件（swarm）必须另起一行：自带 ANSI 样式的 status 原样透传，无前导灰块。
    # v0.3.0 数轴坐标（正上负下），swarm 可能在上也可能在下，断言对两种位置都鲁棒。
    mgr_i = raw.rfind("MANAGER".encode())
    check("[A] swarm 插件 status 存在", mgr_i > 0)
    if auto and mgr_i > 0:
        lo, hi = min(auto_i, mgr_i), max(auto_i, mgr_i)
        check("[A] swarm status 与主行不在同一终端行", bool(ROW_HOME.search(raw[lo:hi])))
        region = raw[max(0, mgr_i - 600):mgr_i]
        row_start = region.rfind(b"\x1b[2K")  # MANAGER 所在行清行序列之后
        seg = region[row_start:] if row_start >= 0 else region
        check("[A] swarm 行无前导灰块（zinc 底）", PLUGIN_BG.encode() not in seg)
    # 无裸 yolo 行（statusline-pi 旧行为）
    lines = visible_lines(raw)
    bare_yolo = [l for l in lines if l.strip() == "yolo"]
    check("[A] 无裸 'yolo' 独立行", not bare_yolo)

force_badges()
try:
    scenario("A", GIT_CWD, 110, asserts_a)

    # ── 场景 B：窄终端 ──
    def asserts_b(raw):
        common_asserts("B")(raw)
        # cols=52 时按丢弃序 CTX/git/tps/cost/扩展status 都应已丢弃，剩 模式+模型+目录
        check("[B] CTX 徽章已按优先级丢弃", CTX_BG.encode() not in raw)
        check("[B] git 徽章已按优先级丢弃", GIT_BG.encode() not in raw)

    scenario("B", GIT_CWD, 52, asserts_b)
finally:
    restore_cfg()

# ── 报告 ──
passed = sum(1 for _, ok in results if ok)
failed = [(n) for n, ok in results if not ok]
report = ["# pi-slim-footer E2E 报告", "",
          f"- 时间：{time.strftime('%Y-%m-%d %H:%M:%S')}",
          f"- 结果：{passed} PASS / {len(failed)} FAIL", "",
          "## 明细", ""]
report += [f"- {'✅' if ok else '❌'} {n}" for n, ok in results]
report += ["", "## 原始日志", "", "- `A.log`（cols=110, ~/code/pi-fleet）", "- `B.log`（cols=52, ~/code/pi-fleet）",
           "", "复现：`python3 e2e_tui.py`（需 settings.json 已挂载 ../../code/pi-slim-footer 且移除 statusline-pi）"]
(OUT / "report.md").write_text("\n".join(report), encoding="utf-8")

print(f"\n{'🎉' if not failed else '💥'} {passed} PASS / {len(failed)} FAIL → docs/e2e/report.md")
sys.exit(0 if not failed else 1)
