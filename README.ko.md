> [!NOTE]
>
> **opencode-contexty**는 [OpenCode](https://github.com/sst/opencode)에 "바이브 엔지니어링"을 더하는 플러그인입니다.
>
> 컨텍스트 윈도우와 싸우지 말고, 코드와 호흡하세요.

> [!TIP]
>
> **빠른 시작**: 명령어 한 줄이면 끝. AASM이 지켜주고, HSCMM이 제어권을 쥐어줍니다.
>
> ```bash
> bunx @ttalkkak-lab/opencode-contexty init
> ```

<!-- <CENTERED SECTION FOR GITHUB DISPLAY> -->

<div align="center">

# opencode-contexty

### OpenCode를 위한 바이브 엔지니어링

**HSCMM** (Human-supervised Context Management) + **AASM** (Active Agent-supervised Architecture) + **ACPM** (Active Context Permission Management) + **TLS** (Terminal Log Supervision)

[![npm version](https://img.shields.io/npm/v/@ttalkkak-lab/opencode-contexty?color=369eff&labelColor=black&logo=npm&style=flat-square)](https://www.npmjs.com/package/@ttalkkak-lab/opencode-contexty)
[![License](https://img.shields.io/badge/license-Apache%202.0-white?labelColor=black&style=flat-square)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.4-blue?labelColor=black&logo=typescript&style=flat-square)](https://www.typescriptlang.org/)
[![Bun](https://img.shields.io/badge/Bun-runtime-f472b6?labelColor=black&logo=bun&style=flat-square)](https://bun.sh/)

[English](README.md) | [한국어](README.ko.md)

</div>

<!-- </CENTERED SECTION FOR GITHUB DISPLAY> -->

---

## 문제점

이런 거 겪어보셨죠:

- **"새 채팅 딜레마"**: 새로 시작하면 컨텍스트 다 날아가고, 계속하면 쓸데없는 히스토리만 쌓임.
- **"생산성 역설"**: AI가 코드는 빠르게 짜는데, 망가진 아키텍처 고치려면 차라리 내가 짜는 게 빠름.
- **"블랙박스 답답함"**: AI가 뭘 보고 있는지 알 수가 없음.

**이건 불편함이 아니라, AI 개발의 치명적인 문제입니다.**

## 해결책: 바이브 엔지니어링

컨텍스트를 _느낄_ 수 있다면? AI 옆에 시니어 개발자가 붙어서 매 프롬프트를 체크한다면?

그게 **바이브 엔지니어링**입니다:

1. **HSCMM** — AI가 뭘 보는지 직접 확인하고 제어하세요.
2. **AASM** — 코드가 아니라 *의도*를 검사하는 능동형 에이전트.
3. **ACPM** — AI가 접근할 수 있는 도구와 폴더를 제어하는 권한 관리 시스템.
4. **TLS** — 터미널 출력을 알아서 요약해주는 똑똑한 래퍼.

---

## 목차

- [문제점](#문제점)
- [해결책: 바이브 엔지니어링](#해결책-바이브-엔지니어링)
- [기능](#기능)
  - [HSCMM: 눈에 보이는 컨텍스트](#hscmm-눈에-보이는-컨텍스트)
  - [AASM: 당신의 아키텍처 파수꾼](#aasm-당신의-아키텍처-파수꾼)
  - [ACPM: 능동형 컨텍스트 권한 관리](#acpm-능동형-컨텍스트-권한-관리)
  - [TLS: 터미널 로그 요약봇](#tls-터미널-로그-요약봇)
- [설치](#설치)
- [설정](#설정)
- [철학](#철학)

---

## 기능

### HSCMM: 눈에 보이는 컨텍스트

> "AI가 지금 뭘 보고 있지?"
>
> HSCMM이면 항상 알 수 있습니다.

HSCMM은 도구 사용 내역을 `.contexty/tool-parts.json`에 전부 기록합니다. **VSCode 확장**이랑 같이 쓰면:

- 👁️ **시각적 컨텍스트 탐색기** — Context Explorer로 AI가 보는 게 정확히 뭔지 확인
- 🎯 **직접 컨텍스트 관리** — 파일, 폴더, 텍스트 선택 영역을 클릭만으로 추가
- ✂️ **컨텍스트에서 빼기** — 필요없는 거 인라인 버튼으로 바로 제거
- 🔦 **컨텍스트 하이라이트** — 컨텍스트에 들어간 코드 라인이 에디터에서 표시됨

**더 이상 추측 안 해도 됩니다. "AI가 까먹었네" 소리도 이제 그만. 다 보이고, 다 제어됩니다.**

```
┌─────────────────────────────────────────┐
│  Context Explorer                       │
│  ├─ 📁 src/                             │
│  │   ├─ 📄 index.ts                     │
│  │   │   └─ L1-50: import { ... }   ✕   │
│  │   └─ 📄 aasm/LLMLinter.ts            │
│  │       └─ Full file             ✕     │
│  └─ 📁 tests/                           │
│      └─ 📄 example.test.ts              │
└─────────────────────────────────────────┘
```

플러그인이 로그 모으면, 확장이 _보여주고_ *관리*할 수 있게 해줍니다.

### AASM: 당신의 아키텍처 파수꾼

> "다 main.ts에 때려박아" — **차단됨.**

AASM은 AI가 코드 짜기 _전에_ 프롬프트부터 검사합니다. 뭘 잡아낼까요:

| 안티패턴          | AASM이 잡아내는 것                             |
| ----------------- | ---------------------------------------------- |
| **모놀리식 파일** | "로직 전부 index.ts에 넣어"                    |
| **갓 오브젝트**   | "모든 걸 처리하는 Manager 클래스 만들어"       |
| **전역 상태**     | "공유 가변 객체 쓰자"                          |
| **강결합**        | "ComponentA가 ComponentB 내부를 직접 호출하게" |
| **관심사 혼재**   | "React 컴포넌트에 DB 쿼리 넣어"                |

**심각도 3단계:**

- 🚫 **Critical**: 차단. 다시 쓰거나 AASM 끄거나.
- ⚠️ **Warning**: 일단 진행하되 위험 요소 알려줌.
- 💡 **Advisory**: 참고만. 차단 안 함.

```bash
# 감독 모드 켜기
/agent-active

# 끄기 (내가 뭐 하는지 알 때만)
/agent-passive

# 현재 상태 보기
/agent-status
```

### ACPM: 능동형 컨텍스트 권한 관리

> "AI가 `rm -rf /` 실행하려고 해?" — **거부됨.**

ACPM은 AI가 무언가 건드리기 _전에_ 접근을 제어합니다. 두 가지 레벨로 관리해요:

- **도구 카테고리** — `file-read`, `file-write`, `shell`, `web`, `lsp`, `mcp`, 각각 개별적으로 켜고 끌 수 있음
- **폴더 권한** — 폴더 경로별로 `denied`, `read-only`, `read-write` 설정, 가장 긴 경로가 우선 적용됨

프리셋은 `.contexty/permissions.json`에 저장됩니다. 권한 세트를 저장하고, 프리셋 간에 전환하고, 각기 다른 워크플로우를 분리해서 관리할 수 있어요. 활성 프리셋이 없으면 ACPM은 전체 허용(allow-all)로 동작해서 안전하게 진행됩니다.

각 OpenCode 세션마다 `.contexty/sessions/{id}/active-preset.json`에 자체 활성 프리셋을 가질 수도 있어서, 작업별로 권한 선택을 분리할 수 있습니다.

```bash
# 현재 권한 상태 확인
acpm status

# 전체 프리셋 목록
acpm list

# 프리셋 전환
acpm switch <이름>

# 디스크에서 프리셋 다시 불러오기
acpm reload
```

CLI 설정 위저드가 `bunx @ttalkkak-lab/opencode-contexty init` 중에 ACPM 설정을 안내하니까, 파일을 직접 뒤지지 않고도 프리셋을 만들 수 있어요.

훅이 도구 실행 전후를 모두 검사하고, 권한 프롬프트를 가로채고, 안전하지 않은 동작을 토스트로 차단하고, 실행 후 출력을 정리하고, 시스템 프롬프트에 현재 규칙을 주입합니다.

### TLS: 터미널 로그 요약봇

> "빌드 깨졌는데 뭐가 문제야?" — **요약해드림.**

TLS는 터미널 명령어 결과를 AI로 요약해줍니다. Success, Warning, Error로 분류해서 보여주니까, 로그 수천 줄 뒤질 필요 없이 문제가 뭔지 바로 알 수 있어요.

```bash
# tls 붙여서 실행
/tls npm run build
/tls git status
```

**출력 예시:**

```
----------------------------------------------------
npm run build
----------------------------------------------------
... (장황한 출력 생략/요약) ...
----------------------------------------------------
요약:
 상태: Error
 - src/index.ts 빌드 실패
 - 42줄: 타입 안 맞음. 'string'을 'number' 파라미터에 넣으려 함.
```

---

## 설치

### 사람이 직접 설치

명령어 한 줄이면 끝:

```bash
bunx @ttalkkak-lab/opencode-contexty init
```

알아서 다 해줍니다:

- OpenCode에 플러그인 등록
- IDE 확장 설치 (VSCode, Cursor, Windsurf 등)
- `contexty.config.json` 설정
- 설치 확인

**필수**: [OpenCode](https://opencode.ai) 먼저 깔려있어야 해요.

### LLM한테 시키기

LLM 세션에 이거 붙여넣으세요:

```
Install and configure opencode-contexty by following the instructions here:
https://raw.githubusercontent.com/ttalkkak-lab/opencode-contexty/refs/heads/main/installation.md
```

LLM이 알아서 다 설치합니다.

---

더 자세한 옵션이 궁금하면 [설치 가이드](installation.md) 보세요.

---

## VSCode 확장

**Context Explorer** 확장은 설치할 때 자동으로 같이 깔립니다. 컨텍스트를 눈으로 보고 관리할 수 있어요.

### 기능

| 기능                 | 설명                                                                 |
| -------------------- | -------------------------------------------------------------------- |
| **Context Explorer** | 컨텍스트에 들어간 파일들을 트리로 보여주는 사이드바                  |
| **드래그 앤 드롭**   | 파일이나 폴더를 Context Explorer로 끌어다 놓으면 컨텍스트에 추가됨   |
| **파일 추가**        | 파일/폴더 우클릭해서 컨텍스트에 추가                                 |
| **선택 영역 추가**   | 코드 선택하고 우클릭, 상태바 버튼, CodeLens로 추가                   |
| **제거**             | 트리 뷰에서 X 버튼 누르면 바로 제거                                  |
| **하이라이트**       | 컨텍스트 들어간 코드가 에디터에서 연한 파란색으로 표시됨             |
| **자동 갱신**        | 파일 바뀌면 트리 뷰도 자동으로 업데이트                              |
| **블랙리스트**       | 뺀 거는 `.contexty/tool-parts.blacklist.json`에 저장돼서 계속 제외됨 |

### 왜 따로 확장으로?

OpenCode 플러그인은 데이터를 수집하고, VSCode 확장은 보여줍니다. 이렇게 나눈 이유:

1. **터미널 깔끔** — OpenCode 창이 지저분해지지 않아요
2. **풍부한 UI** — 터미널에선 안 되는 트리, 아이콘, 인라인 버튼
3. **계속 보임** — Context Explorer가 작업하는 동안 계속 띄워놓을 수 있음
4. **IDE 통합** — 컨텍스트 파일 클릭하면 에디터에서 바로 열림

---

## 설정

프로젝트 루트에 `contexty.config.json` 만들면 돼요:

```json
{
  "acpm": {
    "defaultPreset": "default"
  },
  "aasm": {
    "enabled": true,
    "mode": "active",
    "enableLinting": true,
    "confidenceThreshold": 0.7,
    "model": "claude-sonnet-4-20250514"
  },
  "tls": {
    "enabled": true,
    "model": "claude-sonnet-4-20250514"
  }
}
```

| 옵션                       | 타입                      | 기본값        | 설명                     |
| -------------------------- | ------------------------- | ------------- | ------------------------ |
| `acpm.defaultPreset`       | string                    | (없음)        | 시작할 때 로드할 기본 권한 프리셋 이름 |
| `aasm.enabled`             | boolean                   | `true`        | AASM 전체 켜기/끄기      |
| `aasm.mode`                | `"active"` \| `"passive"` | `"active"`    | 감독 모드                |
| `aasm.enableLinting`       | boolean                   | `true`        | LLM 린팅 쓸지 말지       |
| `aasm.confidenceThreshold` | number                    | `0.7`         | 얼마나 확신해야 제안할지 |
| `aasm.model`               | string                    | (호스트 기본) | 린팅에 쓸 LLM 모델       |
| `tls.enabled`              | boolean                   | `true`        | TLS 전체 켜기/끄기       |
| `tls.model`                | string                    | (호스트 기본) | 요약에 쓸 LLM 모델       |

---

## 철학

### 왜 "바이브 엔지니어링"?

전통 엔지니어링은 규칙, 타입, 테스트죠. **바이브 엔지니어링**은 여기에 직관을 더합니다.

플로우에 빠져있을 때, 코드가 맞는지 _느껴지잖아요_. 아키텍처가 망가질 때 _감이 오고_. 근데 AI는 그런 감이 없어요—**도구를 줘야 생깁니다.**

AASM이 그 도구예요. 세미콜론 체크하는 린터 아니고요. 코드 짜기 전에 *의도*부터 검토하는 **시니어 개발자**입니다.

### 딸깍 철학

이 프로젝트는 **ttalkkak-lab** (딸깍 연구소)에서 만들었습니다.

"딸깍"은 한국어로 클릭 소리. 뭔가 딱 맞아떨어질 때 나는 그 소리요. 우리가 만드는 건: 그냥 _딸깍_ 하고 맞는 도구.

설정 싸움 없어요. 문서 뒤질 필요 없어요. 깔면 되고. 그게 딸깍.

---

## 라이선스

Apache-2.0 © [ttalkkak-lab](https://github.com/ttalkkak-lab)

---

<div align="center">

**컨텍스트에 안 빠지고, 코드랑 호흡하세요.**

[버그 리포트](https://github.com/ttalkkak-lab/opencode-contexty/issues) · [기능 요청](https://github.com/ttalkkak-lab/opencode-contexty/issues)

</div>
