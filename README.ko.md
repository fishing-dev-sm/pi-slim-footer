# pi-slim-footer

<p align="center">
  <a href="README.md">English</a> |
  <a href="README.zh-CN.md">简体中文</a> |
  <a href="README.es.md">Español</a> |
  <a href="README.fr.md">Français</a> |
  <a href="README.de.md">Deutsch</a> |
  <a href="README.ja.md">日本語</a> |
  <a href="README.ko.md"><strong>한국어</strong></a> |
  <a href="README.pt.md">Português</a> |
  <a href="README.ru.md">Русский</a>
</p>

**badges** 테마 (모든 세그먼트 반전 배지)

![badges theme](https://raw.githubusercontent.com/fishing-dev-sm/pi-slim-footer/main/docs/screenshots/theme-badges.png)

**mixed** 테마 (상태는 컬러 배지 + 데이터는 차분한 텍스트)

![mixed theme](https://raw.githubusercontent.com/fishing-dev-sm/pi-slim-footer/main/docs/screenshots/theme-mixed.png)

> 스크린샷은 순수하게 프로그램으로 렌더링됩니다 (`scripts/screenshots.sh`: 실제 `src/index.ts`가 ANSI 라인을 출력 → PIL이 셀 단위로 PNG를 그림) — 터미널 캡처 잡요소가 없습니다.

[pi](https://pi.dev)용 한 줄 푸터 확장 — 엄격하게 한 줄, 트루컬러 배지, 좁은 터미널에서는 세그먼트를 스마트하게 버립니다. statusline-pi 대체제입니다.

## 미리보기

```
 AUTO   deepseek/deepseek-v4-pro high   CTX ⣀⣀⣀⣀⣀⣀⣀⣀ 0.0%·1M   ⎇ main   -- tps   $0.026        ~/code/pi-fleet
```

넓은 터미널 (badges 테마, 트루컬러 반전 배지): 모드 / 모델+사고 수준 / CTX (braille+%+윈도우) / git / tps / 비용. 디렉터리는 오른쪽 정렬.

## 기능

- **메인 라인은 엄격하게 한 줄**: 자체 콘텐츠가 0번 줄을 독점하며 어떤 너비에서도 줄바꿈되지 않습니다. 안 맞는 세그먼트는 우선순위 순으로 버림
- **플러그인 라인 관리**: 다른 플러그인의 `setStatus` 콘텐츠는 반드시 별도 줄로 (기본값 `-1`, 메인 라인 바로 아래). `/slim-footer`에서 수직선 좌표로 줄 번호를 배정 (**양수 = 메인 라인 위, 음수 = 아래**). **같은 번호는 한 줄을 공유** (공백 하나로 구분), 다른 번호는 각각 별도 줄. 메뉴는 ±1..±9 총 18개 슬롯 제공, 설정 파일에서는 ±99 임의 정수 가능
- **버림 순서** (숫자가 클수록 먼저 버림): `cost(5) → tps(4) → git(3) → CTX(2) → model(1) → 권한 모드(0, 절대 버리지 않음)`
- **권한 모드 일급 시민**: permission-system의 `yolo`가 노란색 ` AUTO ` 배지로 렌더링 (더 이상 생텍스트 두 번째 줄 아님). `plan` → ` PLAN `, `ask` → ` ASK WHEN NEED ` 예약됨. 다른 확장 상태는 회색 배지
- **두 가지 테마**, `/slim-footer`로 전환:
  - `badges` (A): 전체 반전 배지, FACC 스타일
  - `mixed` (B): 상태 컬러 배지 + 차분한 데이터 텍스트, 저자극
- **감정 색상**: CTX 초록→노랑→주황→빨강→진빨강 5단계. tps는 속도에 따라 변색 (<10 파랑 / <30 청록 / <60 초록 / ≥60 주황)
- **저채도 팔레트**: HSL 감채 (설정 가능) — 장시간 사용에도 눈이 편안

## 설치

`~/.pi/agent/settings.json`의 `packages`에 `npm:pi-slim-footer` (또는 로컬 경로) 를 추가하고 `npm:statusline-pi`를 제거하세요 (둘 다 푸터를 장악합니다):

```json
{
  "packages": ["npm:pi-slim-footer", "...다른 패키지..."]
}
```

## 설정

`~/.pi/agent/slim-footer.json` (모두 선택 사항, [config.example.json](config.example.json) 참고):

```json
{
  "enabled": true,
  "theme": "badges",
  "saturation": { "badgeSat": 0.3, "badgeLum": 0.72, "foreSat": 0.4 },
  "pluginLines": { "swarm-roster": 1, "noisy-ext": -2 }
}
```

## 명령

`/slim-footer` — 메뉴:

1. 테마 badges / mixed 전환
2. **Plugin line positions…** — 푸터 상태를 등록한 모든 플러그인을 나열하고 (현재 상태 미리보기 포함) 각각에 줄 번호 (수직선 좌표) 를 배정:
   ```
   Line +9 … +2 / +1   → 메인 라인 위 (+1이 가장 가까움)
   Line  0             → slim-footer 메인 라인 (플러그인에 개방하지 않음)
   Line -1 / -2 … -9   → 메인 라인 아래 (-1이 가장 가까움, 기본값 -1)
   ```
   같은 줄 번호의 플러그인은 한 줄을 공유하며 공백으로 구분. 줄 번호는 `pluginLines`에 영속화 (설정 파일은 ±99 허용).

   > v0.3.0부터 좌표축은 수직선 의미 (양수 = 위) 입니다. 구버전 설정 (양수 = 아래) 은 첫 로드 시 자동으로 부호 반전되어 `axisMigrated` 플래그와 함께 다시 저장됩니다.

   플러그인 상태 렌더링 규칙: **이미 ANSI 스타일을 포함한 텍스트는 그대로 통과** (예: pi-agent-swarm의 시안색 `MANAGER` 배지). 순수 텍스트만 회색 배지로 감쌉니다.
3. 활성화 / 비활성화 (비활성화 시 pi 기본 푸터로 복원)

## 데이터 소스

| 세그먼트 | 소스 |
|---|---|
| 모드 배지 | `footerData.getExtensionStatuses()` 중 값이 알려진 모드 (yolo/plan/ask) 인 항목 |
| 플러그인 줄 | `footerData.getExtensionStatuses()`의 나머지 항목을 `pluginLines`로 분배 |
| 모델 / 사고 수준 | `ctx.model` + `pi.getThinkingLevel()` |
| CTX | `ctx.model.contextWindow` + `ctx.getContextUsage().tokens` |
| git | `footerData.getGitBranch()` (pi 내장, git 실행 안 함) |
| tps | `message_start/update/end` 이벤트로 추정 (statusline-pi에서 차용) |
| 비용 | 세션 브랜치의 assistant `usage.cost.total` 누적 |

## 테스트 (E2E)

```bash
node --experimental-strip-types e2e.mjs   # 모의 런타임 전체 체인 (76개 어설션)
python3 e2e_tui.py                        # pty 구동 실제 pi TUI (14개 어설션) → docs/e2e/report.md
```

## 설계

[PLAN.md](PLAN.md) 참고. 비주얼 언어는 [famous-anime-cache-countdown](https://github.com/fishing-dev-sm/pi-famous-anime-cache-countdown)에서 유래했습니다.
