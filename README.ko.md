
> [!NOTE]
>
> **opencode-contexty**는 [OpenCode](https://github.com/sst/opencode)를 위한 플러그인으로 AI 기반 개발에 "바이브 엔지니어링"을 제공합니다.
>
> 컨텍스트 윈도우와 싸우지 마세요. 코드를 느껴보세요.

> [!TIP]
>
> **빠른 시작**: 한 줄 명령어로 설치 완료. AASM이 당신을 지켜주고, HSCMM이 제어권을 줍니다.
>
> ```bash
> bunx @ttalkkak-lab/opencode-contexty init
> ```

<!-- <CENTERED SECTION FOR GITHUB DISPLAY> -->

<div align="center">

# opencode-contexty

### OpenCode를 위한 바이브 엔지니어링

**HSCMM** (Human-supervised Context Management) + **AASM** (Active Agent-supervised Architecture) + **TLS** (Terminal Log Supervision)

[![npm version](https://img.shields.io/npm/v/@ttalkkak-lab/opencode-contexty?color=369eff&labelColor=black&logo=npm&style=flat-square)](https://www.npmjs.com/package/@ttalkkak-lab/opencode-contexty)
[![License](https://img.shields.io/badge/license-MIT-white?labelColor=black&style=flat-square)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.4-blue?labelColor=black&logo=typescript&style=flat-square)](https://www.typescriptlang.org/)
[![Bun](https://img.shields.io/badge/Bun-runtime-f472b6?labelColor=black&logo=bun&style=flat-square)](https://bun.sh/)

[English](README.md) | [한국어](README.ko.md)

</div>

<!-- </CENTERED SECTION FOR GITHUB DISPLAY> -->

---

## 문제점

당신도 이런 경험이 있을 겁니다:

- **"새 채팅 딜레마"**: 새로 시작하면 모든 컨텍스트를 잃고, 계속하면 관련 없는 히스토리에 빠집니다.
- **"생산성 역설"**: AI는 빠르게 코드를 작성하지만, 아키텍처 재앙을 고치는 데는 직접 작성하는 것보다 더 오래 걸립니다.
- **"블랙박스 좌절"**: AI의 컨텍스트에 실제로 뭐가 들어있나요? 아무도 모릅니다.

**이것들은 기능 요청이 아닙니다. AI 기반 개발의 존재적 위협입니다.**

## 해결책: 바이브 엔지니어링

컨텍스트를 _느낄_ 수 있다면? AI에게 모든 프롬프트를 감시하는 시니어 아키텍트가 있다면?

그것이 **바이브 엔지니어링**입니다:

1. **HSCMM** — AI가 보는 것을 명시적이고 투명하게 제어합니다.
2. **AASM** — 코드가 아닌 _의도_를 린트하는 능동형 에이전트.
3. **TLS** — 터미널 출력을 요약하는 지능형 래퍼.

---

## 목차

- [문제점](#문제점)
- [해결책: 바이브 엔지니어링](#해결책-바이브-엔지니어링)
- [기능](#기능)
  - [AASM: 아키텍처 가디언](#aasm-아키텍처-가디언)
  - [HSCMM: 보이는 컨텍스트](#hscmm-보이는-컨텍스트)
  - [TLS: 터미널 로그 감독](#tls-터미널-로그-감독)
- [설치](#설치)
- [사용법](#사용법)
- [설정](#설정)
- [작동 원리](#작동-원리)
- [철학](#철학)

---

## 기능

### AASM: 아키텍처 가디언

> "모든 걸 main.ts에 넣어" — **차단됨.**

AASM은 AI가 동작하기 _전에_ 프롬프트를 분석합니다. 감지 항목:

| 안티패턴 | AASM이 잡아내는 것 |
| -------------------- | ------------------------------------------------------ |
| **모놀리식 파일** | "모든 로직을 index.ts에 추가해" |
| **갓 오브젝트** | "모든 걸 처리하는 Manager 클래스 만들어" |
| **전역 상태** | "공유 가변 객체 사용해" |
| **강한 결합** | "ComponentA가 ComponentB 내부를 직접 호출하게 해" |
| **관심사 혼재** | "React 컴포넌트에 데이터베이스 쿼리 넣어" |

**세 가지 심각도 수준:**

- 🚫 **Critical**: 요청 차단. 다시 작성하거나 AASM을 비활성화해야 합니다.
- ⚠️ **Warning**: AI가 주의하며 진행하고 위험을 설명합니다.
- 💡 **Advisory**: 정보 제공만, 차단 없음.

```bash
# 능동형 감독 활성화
/agent active

# 비활성화 (무엇을 하는지 알 때)
/agent passive

# 현재 모드 확인
/agent status
```

### HSCMM: 보이는 컨텍스트

> "AI의 컨텍스트에 지금 뭐가 있나요?"
>
> HSCMM과 함께라면: 항상 알 수 있습니다.

HSCMM은 모든 도구 상호작용을 `.contexty/tool-parts.json`에 저장합니다. **VSCode 확장**과 결합하면:

- 👁️ **시각적 컨텍스트 인스펙터** — Context Explorer를 통해 AI 컨텍스트 윈도우에 정확히 무엇이 있는지 확인
- 🎯 **수동 컨텍스트 제어** — 클릭 한 번으로 파일, 폴더, 텍스트 선택을 컨텍스트에 추가
- ✂️ **컨텍스트에서 제거** — 인라인 제거 버튼으로 원하지 않는 부분 제외
- 🔦 **컨텍스트 하이라이팅** — 컨텍스트에 포함된 라인이 에디터에서 직접 하이라이트됨

**더 이상 추측하지 마세요. "AI가 모든 걸 잊어버렸어" 같은 말도 없습니다. 보이고, 제어할 수 있습니다.**

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

플러그인은 자동으로 도구 로그를 캡처합니다. 확장은 _보고_ _관리_할 수 있게 해줍니다.

### TLS: 터미널 로그 감독

> "빌드 실패했나? 왜?" — **요약됨.**

TLS는 터미널 명령어를 래핑하고 AI를 사용해 출력을 요약합니다. 결과를 Success, Warning, Error로 분류하므로, 수천 줄의 로그를 파싱해서 문제를 찾을 필요가 없습니다.

```bash
# 'tls'로 명령어 래핑
tls npm run build
tls git status
```

**출력 예시:**
```
----------------------------------------------------
npm run build
----------------------------------------------------
... (상세 출력 숨김/요약됨) ...
----------------------------------------------------
요약:
 상태: Error
 - src/index.ts에서 빌드 실패
 - 42번 줄 타입 불일치: 'string' 타입 인자를 'number' 타입 매개변수에 할당할 수 없습니다.
```

---

## 설치

### 사람을 위한 설치

한 줄 명령어로 opencode-contexty 설치:

```bash
bunx @ttalkkak-lab/opencode-contexty init
```

CLI가 처리하는 것:
- OpenCode 설정에 플러그인 설치 및 등록
- IDE 확장 설정 (VSCode, Cursor, Windsurf 등)
- 선호도에 따라 `contexty.config.json` 생성
- 설치 검증

**요구사항**: [OpenCode](https://opencode.ai)가 먼저 설치되어 있어야 합니다.

### LLM 에이전트를 위한 설치

LLM 에이전트 세션에 이것을 붙여넣으세요:

```
Install and configure opencode-contexty by following the instructions here:
https://raw.githubusercontent.com/ttalkkak-lab/opencode-contexty/refs/heads/main/installation.md
```

LLM 에이전트가 전체 설정 프로세스를 자동으로 처리합니다.

---

자세한 설치 옵션과 설정은 [설치 가이드](installation.md)를 참조하세요.

---

## VSCode 확장

**Context Explorer** 확장은 설치 시 자동으로 설치되며, 컨텍스트 항목을 관리하는 시각적 인터페이스를 제공합니다.

### 기능

| 기능 | 설명 |
| ------------------------ | ------------------------------------------------------------------------------------------------- |
| **Context Explorer** | 컨텍스트 파트가 있는 모든 파일을 보여주는 탐색기 사이드바의 계층 트리 뷰 |
| **드래그 앤 드롭** | 파일이나 폴더를 Context Explorer로 드래그하여 컨텍스트에 추가 |
| **컨텍스트에 파일 추가** | 파일/폴더 우클릭으로 컨텍스트에 추가 |
| **선택 영역 추가** | 텍스트 선택 후 우클릭, 상태 표시줄 버튼, CodeLens 오버레이로 추가 |
| **컨텍스트에서 제거** | 트리 뷰의 파트와 파일에 있는 인라인 제거 버튼 |
| **컨텍스트 하이라이팅** | 컨텍스트에 포함된 라인이 에디터에서 연한 파란색 배경으로 하이라이트됨 |
| **자동 새로고침** | 파일 변경 시 트리 뷰 자동 업데이트 |
| **블랙리스트 지원** | 제거된 파트가 `.contexty/tool-parts.blacklist.json`에 영구 제외로 저장됨 |

### 왜 별도의 확장인가?

OpenCode 플러그인은 데이터를 캡처합니다. VSCode 확장은 표시합니다. 이러한 분리의 의미:

1. **터미널 깔끔함** — OpenCode가 깔끔하게 유지됩니다
2. **풍부한 UI** — 터미널에서 할 수 없는 트리, 아이콘, 인라인 액션
3. **지속적인 뷰** — Context Explorer가 작업하는 동안 계속 열려 있습니다
4. **IDE 통합** — 컨텍스트의 파일 클릭 → 에디터에서 열림

---

## 사용법

설치 후, **그냥 작동합니다**.

### AASM 명령어

| 명령어 | 설명 |
| ---------------- | ----------------------------------------- |
| `/agent active` | 아키텍처 감독 활성화 (기본값) |
| `/agent passive` | 감독 비활성화 |
| `/agent status` | 현재 모드와 설정 표시 |

### HSCMM: 자동 컨텍스트 캡처

HSCMM은 백그라운드에서 조용히 실행됩니다:

1. **모든 도구 호출**이 `.contexty/tool-parts.json`에 로깅됩니다
2. **VSCode 확장**이 이 파일을 읽어 시각적으로 표시합니다
3. **명령어가 아닌 확장 UI를 통해 컨텍스트를 관리**합니다

명령어가 필요 없습니다. 플러그인이 캡처하고, 확장이 표시하며, 당신이 제어합니다.

### AASM이 차단할 때 일어나는 일

아키텍처적으로 위험한 요청을 할 때:

1. **토스트 알림**이 나타나 위반 사항을 설명합니다
2. **요청이 시스템 지시로 대체**됩니다
3. **AI가 진행할 수 없는 이유를 설명**합니다
4. **당신이 결정**: 요청을 다시 작성하거나 AASM을 비활성화합니다

예시:

```
당신: "모든 코드를 하나의 큰 main.ts 파일에 넣어"

🚫 AASM - 요청 차단됨
❌ 모놀리식 main 파일 감지됨
💡 책임에 따라 모듈로 분리하세요

비활성화하려면: "에이전트를 수동 모드로 설정"
```

---

## 설정

프로젝트 루트에 `contexty.config.json` 생성:

```json
{
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

| 옵션 | 타입 | 기본값 | 설명 |
| -------------------------- | ------------------------- | -------------- | ---------------------------------- |
| `aasm.enabled` | boolean | `true` | AASM을 전역적으로 활성화 |
| `aasm.mode` | `"active"` \| `"passive"` | `"active"` | 감독 모드 |
| `aasm.enableLinting` | boolean | `true` | LLM 기반 린팅 활성화 |
| `aasm.confidenceThreshold` | number | `0.7` | 제안의 최소 신뢰도 |
| `aasm.model` | string | (호스트 기본값) | 린팅용 LLM 모델 |
| `tls.enabled` | boolean | `true` | TLS를 전역적으로 활성화 |
| `tls.model` | string | (호스트 기본값) | 요약용 LLM 모델 |

---

## 작동 원리

### 아키텍처

```
사용자 프롬프트
    │
    ▼
┌─────────────────────────────────────┐
│  chat.message 훅 (AASM)             │
│  ├─ 의도 분석 (로컬)                │
│  └─ LLM 린트 (서브세션)             │
│      ├─ Critical → 차단             │
│      ├─ Warning → 경고              │
│      └─ Advisory → 통과             │
└─────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────┐
│  messages.transform 훅 (HSCMM)      │
│  ├─ 도구 로그 저장                  │
│  └─ 컨텍스트 주입                   │
└─────────────────────────────────────┘
    │
    ▼
LLM 응답
```

### 주요 컴포넌트

| 컴포넌트 | 위치 | 역할 |
| -------------------------- | ------------------------------ | ------------------------------ |
| `AASMModule` | `src/aasm/index.ts` | 메인 감독 오케스트레이터 |
| `IntentAnalyzer` | `src/aasm/index.ts` | 로컬 의도 분류 |
| `LLMLinter` | `src/aasm/LLMLinter.ts` | LLM 기반 아키텍처 린팅 |
| `SubsessionHelper` | `src/aasm/SubsessionHelper.ts` | LLM 서브세션 관리 |
| `createHSCMMTransformHook` | `src/hscmm/transformer.ts` | 컨텍스트 변환 |
| `TLSModule` | `src/tls/index.ts` | 터미널 로그 감독 |
| `createTLSCommandHook` | `src/hooks/command-execute-before.tls.ts` | 'tls' 명령어 인터셉트 |

---

## 철학

### 왜 "바이브 엔지니어링"인가?

전통적인 엔지니어링은 규칙, 타입, 테스트에 관한 것입니다. **바이브 엔지니어링**은 직관을 추가합니다.

깊은 몰입 상태에 있을 때, 코드가 옳은지 _느껴집니다_. 아키텍처가 흐트러질 때 _감지됩니다_. 하지만 AI는 그런 직관이 없습니다—**직관을 개발할 도구를 제공하지 않는 한.**

AASM이 바로 그 도구입니다. 세미콜론을 체크하는 린터가 아닙니다. _의도_를 기술 부채가 되기 전에 검토하는 **시니어 아키텍트**입니다.

### 딸깍 철학

이 프로젝트는 **ttalkkak-lab** (딸깍 연구소)에서 시작되었습니다.

"딸깍"은 한국어의 의성어로 클릭 소리—무언가가 완벽하게 제자리에 들어맞는 만족스러운 찰칵 소리입니다. 우리가 만들고 있는 것: 그냥 _딸깍_하고 맞는 도구.

설정과 싸우지 않습니다. 문서를 뒤지지 않습니다. 설치하면 작동합니다. 그게 딸깍입니다.

---

## 라이선스

MIT © [ttalkkak-lab](https://github.com/ttalkkak-lab)

---

<div align="center">

**컨텍스트에 빠지지 말고, 코드와 함께 바이브하세요.**

[버그 리포트](https://github.com/ttalkkak-lab/opencode-contexty/issues) · [기능 요청](https://github.com/ttalkkak-lab/opencode-contexty/issues)

</div>
