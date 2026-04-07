> [!NOTE]
>
> **opencode-contexty**는 [OpenCode](https://github.com/sst/opencode)에 "컨텍스트 엔지니어링"을 더하는 플러그인.
>
> 컨텍스트 윈도우 싸우지 말고, 코드랑 호흡해.

> [!TIP]
>
> **빠른 시작**: 한 줄이면 끝.
>
> ```bash
> bunx @ttalkkak-lab/opencode-contexty init
> ```

<!-- <CENTERED SECTION FOR GITHUB DISPLAY> -->

<div align="center">

# opencode-contexty

### OpenCode를 위한 컨텍스트 엔지니어링

**HSCMM** (Human-supervised Context Management) + **AASM** (Active Agent-supervised Architecture) + **ACPM** (Active Context Permission Management) + **TLS** (Terminal Log Supervision)

[![npm version](https://img.shields.io/npm/v/@ttalkkak-lab/opencode-contexty?color=369eff&labelColor=black&logo=npm&style=flat-square)](https://www.npmjs.com/package/@ttalkkak-lab/opencode-contexty)
[![License](https://img.shields.io/badge/license-Apache%202.0-white?labelColor=black&style=flat-square)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.4-blue?labelColor=black&logo=typescript&style=flat-square)](https://www.typescriptlang.org/)
[![Bun](https://img.shields.io/badge/Bun-runtime-f472b6?labelColor=black&logo=bun&style=flat-square)](https://bun.sh/)

[English](README.md) | [한국어](README.ko.md)

</div>

<!-- </CENTERED SECTION FOR GITHUB DISPLAY> -->

---

## 왜 만들었나

이런 경험, 있죠.

- **새 채팅 딜레마** — 새로 시작하면 컨텍스트 날아가고, 계속하면 쓸데없는 히스토리만 쌓임.
- **생산성 역설** — AI가 코드는 빠르게 짜는데, 망가진 아키텍처 고치느라 내가 직접 들어가는 게 더 빠름.
- **블랙박스** — AI가 지금 뭘 보고 있는지 모름.

이건 불편함이 아니라 AI 개발의 치명적인 문제.

## 컨텍스트 엔지니어링

컨텍스트를 느낄 수 있다면? AI 옆에 시니어가 매 프롬프트를 검수한다면?

그게 컨텍스트 엔지니어링.

1. **HSCMM** — AI가 보는 컨텍스트를 직접 확인하고 제어.
2. **AASM** — 코드가 아니라 의도를 검사하는 에이전트.
3. **ACPM** — AI가 건드릴 수 있는 도구와 폴더를 제한.
4. **TLS** — 터미널 출력을 알아서 요약.

---

## 기능

### HSCMM: 컨텍스트가 보인다

HSCMM은 도구 사용 내역을 `.contexty/tool-parts.json`에 기록한다. VSCode 확장이랑 같이 쓰면:

- **Context Explorer** — AI가 보는 게 정확히 뭔지 트리로 확인
- **직접 관리** — 파일, 폴더, 선택 영역 클릭으로 추가
- **인라인 제거** — 필요 없는 건 X 버튼으로 바로 빼기
- **하이라이트** — 컨텍스트에 들어간 라인이 에디터에 표시됨

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

추측 끝. "AI가 까먹었네"도 그만. 다 보이고, 다 제어된다.

### AASM: 아키텍처 파수꾼

> "다 main.ts에 때려박아" — 차단됨.

AASM은 AI가 코드 짜기 전에 프롬프트부터 검사한다.

| 안티패턴          | AASM이 잡아내는 것                             |
| ----------------- | ---------------------------------------------- |
| **모놀리식 파일** | "로직 전부 index.ts에 넣어"                    |
| **갓 오브젝트**   | "모든 걸 처리하는 Manager 클래스 만들어"       |
| **전역 상태**     | "공유 가변 객체 쓰자"                          |
| **강결합**        | "ComponentA가 ComponentB 내부를 직접 호출하게" |
| **관심사 혼재**   | "React 컴포넌트에 DB 쿼리 넣어"                |

3단계 심각도:

- **Critical** — 차단. 다시 쓰거나 AASM 끄거나.
- **Warning** — 진행하되 위험 요소 알려줌.
- **Advisory** — 참고만. 차단 안 함.

```bash
# 감독 모드 켜기
/agent-active

# 끄기
/agent-passive

# 상태 확인
/agent-status
```

### ACPM: 권한 관리

> "AI가 `rm -rf /` 실행하려고 해?" — 거부됨.

ACPM은 AI가 무언가 건드리기 전에 접근을 제어한다. 두 레벨로 관리:

- **도구 카테고리** — `file-read`, `file-write`, `shell`, `web`, `lsp`, `mcp` 개별 on/off
- **폴더 권한** — 경로별 `denied`, `read-only`, `read-write`. 가장 긴 경로가 우선.

프리셋은 `.contexty/permissions.json`에 저장. 권한 세트를 만들고, 프리셋끼리 전환하고, 워크플로우별로 분리 관리 가능. 활성 프리셋이 없으면 전체 허용으로 동작.

세션별로 `.contexty/sessions/{id}/active-preset.json`에 각자의 프리셋을 가질 수도 있어서, 작업 단위로 권한을 분리할 수 있다.

```bash
# 현재 권한 상태
acpm status

# 프리셋 목록
acpm list

# 프리셋 전환
acpm switch <이름>

# 디스크에서 다시 불러오기
acpm reload
```

`bunx @ttalkkak-lab/opencode-contexty init` 중에 ACPM 설정 위저드가 나와서, 파일 직접 만지지 않고도 프리셋 생성 가능.

내부적으로 훅이 도구 실행 전후를 검사하고, 권한 프롬프트를 가로채고, 위험한 동작은 토스트로 차단하며, 실행 후 출력을 정리하고, 시스템 프롬프트에 현재 규칙을 주입한다.

### TLS: 터미널 로그 요약

> "빌드 깨졌는데 뭐가 문제야?" — 요약해줌.

TLS는 터미널 명령어 결과를 AI로 요약. Success, Warning, Error로 분류해서 로그 수천 줄 안 뒤져도 문제 파악 가능.

```bash
/tls npm run build
/tls git status
```

```
----------------------------------------------------
npm run build
----------------------------------------------------
요약:
 상태: Error
 - src/index.ts 빌드 실패
 - 42줄: 타입 불일치. 'string'을 'number' 파라미터에 대입.
```

---

## 설치

### 직접

```bash
bunx @ttalkkak-lab/opencode-contexty init
```

자동으로:

- OpenCode에 플러그인 등록
- IDE 확장 설치 (VSCode, Cursor, Windsurf 등)
- `contexty.config.json` 생성
- 설치 검증

**필수**: [OpenCode](https://opencode.ai) 먼저 설치되어 있어야 함.

### LLM한테 시키기

LLM 세션에 붙여넣기:

```
Install and configure opencode-contexty by following the instructions here:
https://raw.githubusercontent.com/ttalkkak-lab/opencode-contexty/refs/heads/main/installation.md
```

나머지는 LLM이 알아서.

---

더 자세한 옵션은 [설치 가이드](installation.md) 참고.

---

## VSCode 확장

**Context Explorer** 확장은 설치 시 자동 설치. 컨텍스트를 시각적으로 관리.

| 기능                 | 설명                                                                     |
| -------------------- | ------------------------------------------------------------------------ |
| **Context Explorer** | 컨텍스트 파일 트리 뷰                                                    |
| **드래그 앤 드롭**   | 파일/폴더를 끌어다 놓으면 컨텍스트에 추가                                |
| **파일 추가**        | 우클릭으로 컨텍스트에 추가                                               |
| **선택 영역 추가**   | 코드 선택 후 우클릭 / 상태바 / CodeLens로 추가                           |
| **제거**             | 트리에서 X 버튼으로 즉시 제거                                            |
| **하이라이트**       | 컨텍스트 포함 라인 연한 파란색 표시                                      |
| **자동 갱신**        | 파일 변경 시 트리 자동 업데이트                                          |
| **블랙리스트**       | 제거된 항목은 `.contexty/tool-parts.blacklist.json`에 저장으로 영구 제외 |

### 왜 따로 확장?

플러그인은 데이터를 수집하고, 확장은 보여준다.

1. **터미널 깔끔** — OpenCode 창 안 더러워짐
2. **풍부한 UI** — 트리, 아이콘, 인라인 버튼
3. **상시 표시** — 작업 중에 계속 띄워놓기 가능
4. **IDE 통합** — 클릭하면 에디터에서 바로 열림

---

## 설정

프로젝트 루트에 `contexty.config.json`:

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

| 옵션                       | 타입                      | 기본값        | 설명                            |
| -------------------------- | ------------------------- | ------------- | ------------------------------- |
| `acpm.defaultPreset`       | string                    | (없음)        | 시작 시 로드할 기본 권한 프리셋 |
| `aasm.enabled`             | boolean                   | `true`        | AASM 전체 on/off                |
| `aasm.mode`                | `"active"` \| `"passive"` | `"active"`    | 감독 모드                       |
| `aasm.enableLinting`       | boolean                   | `true`        | LLM 린팅 on/off                 |
| `aasm.confidenceThreshold` | number                    | `0.7`         | 제안 최소 신뢰도                |
| `aasm.model`               | string                    | (호스트 기본) | 린팅용 LLM 모델                 |
| `tls.enabled`              | boolean                   | `true`        | TLS 전체 on/off                 |
| `tls.model`                | string                    | (호스트 기본) | 요약용 LLM 모델                 |

---

## 딸깍

이 프로젝트는 **ttalkkak-lab** (딸깍 연구소)에서 만든다.

딸깍은 한번에 딱 맞을 때 나는 소리. 우리가 만드는 건 그냥 딸깍 하고 맞는 도구.

설정 싸움 없이. 문서 뒤지지 않고. 깔면 된다. 그게 딸깍.

---

## 라이선스

Apache-2.0 © [ttalkkak-lab](https://github.com/ttalkkak-lab)

---

<div align="center">

**컨텍스트에 안 빠지고, 코드랑 호흡하세요.**

[버그 리포트](https://github.com/ttalkkak-lab/opencode-contexty/issues) · [기능 요청](https://github.com/ttalkkak-lab/opencode-contexty/issues)

</div>
