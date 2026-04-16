> [!NOTE]
>
> **opencode-contexty**는 [OpenCode](https://github.com/sst/opencode)에 컨텍스트 엔지니어링 레이어를 추가하는 플러그인입니다.

> [!TIP]
>
> **빠른 시작**
>
> ```bash
> bunx @ttalkkak-lab/opencode-contexty init
> ```

<!-- <CENTERED SECTION FOR GITHUB DISPLAY> -->

<div align="center">

# opencode-contexty

### OpenCode를 위한 컨텍스트 엔지니어링

**HSCMM** · **AASM** · **ACPM** · **TLS**

[![npm version](https://img.shields.io/npm/v/@ttalkkak-lab/opencode-contexty?color=369eff&labelColor=black&logo=npm&style=flat-square)](https://www.npmjs.com/package/@ttalkkak-lab/opencode-contexty)
[![License](https://img.shields.io/badge/license-Apache%202.0-white?labelColor=black&style=flat-square)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.4-blue?labelColor=black&logo=typescript&style=flat-square)](https://www.typescriptlang.org/)
[![Bun](https://img.shields.io/badge/Bun-runtime-f472b6?labelColor=black&logo=bun&style=flat-square)](https://bun.sh/)

[English](README.md) | [한국어](README.ko.md)

</div>

<!-- </CENTERED SECTION FOR GITHUB DISPLAY> -->

---

## 개요

AI 코딩 워크플로우에서 반복적으로 나타나는 세 가지 문제가 있습니다.

- **컨텍스트 단절** — 새 세션을 시작하면 이전 컨텍스트가 소실되고, 세션을 유지하면 불필요한 히스토리가 누적됩니다.
- **아키텍처 품질 저하** — 생성 속도는 빠르지만 코드 구조가 점진적으로 훼손됩니다.
- **불투명한 컨텍스트** — 모델이 현재 어떤 정보를 참조하는지 확인할 방법이 없습니다.

opencode-contexty는 이 문제를 네 가지 시스템으로 해결합니다.

| 시스템 | 설명 |
| --- | --- |
| **HSCMM** | Human-supervised Context Management — 컨텍스트를 시각화하고 직접 제어 |
| **AASM** | Active Agent-supervised Architecture — 프롬프트 단계에서 아키텍처 안티패턴 감지 |
| **ACPM** | Active Context Permission Management — 도구 및 경로별 접근 권한 관리 |
| **TLS** | Terminal Log Supervision — 터미널 출력을 AI로 요약 |

---

## 기능

### HSCMM: 컨텍스트 가시화 및 제어

도구 사용 내역을 `.contexty/tool-parts.json`에 기록하며, VSCode 확장과 연동하여 다음 기능을 제공합니다.

- **Context Explorer** — 모델이 참조 중인 컨텍스트를 파일 트리로 확인
- **수동 관리** — 파일, 폴더, 선택 영역을 직접 컨텍스트에 추가
- **인라인 제거** — 불필요한 항목을 즉시 제거
- **에디터 하이라이트** — 컨텍스트에 포함된 라인을 에디터에 시각적으로 표시
- **/ban** — 파일 또는 디렉토리 경로(글로브 패턴 지원)를 지정해 해당 컨텍스트 파트를 일괄 블랙리스트 처리

```bash
/ban @src/legacy/oldApi.ts   # 특정 파일의 모든 컨텍스트 파트 제외
/ban @src/generated/**       # 글로브 패턴으로 디렉토리 전체 제외
```

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

### AASM: 아키텍처 감독

프롬프트를 전송하는 순간, AI가 응답을 생성하는 동시에 **백그라운드에서** 아키텍처 안티패턴을 분석합니다. 분석이 완료되면 토스트 알림으로 결과를 보고하며, 이슈가 감지되면 유지 또는 되돌리기를 선택할 수 있습니다.

| 안티패턴 | 감지 예시 |
| --- | --- |
| **모놀리식 파일** | 단일 파일에 모든 로직을 집중하는 지시 |
| **갓 오브젝트** | 모든 책임을 담당하는 단일 클래스 생성 요청 |
| **전역 가변 상태** | 공유 가변 객체 사용 지시 |
| **강결합** | 컴포넌트가 다른 컴포넌트 내부를 직접 참조하는 구조 |
| **관심사 혼재** | UI 컴포넌트에 데이터 접근 로직을 포함하는 구조 |

감지 결과는 세 단계로 분류됩니다.

- **Critical** — 이슈 고지 후 유지/되돌리기 선택 요청
- **Warning** — 위험 요소를 고지하고 유지/되돌리기 선택 요청
- **Advisory** — 참고 정보만 제공

**유지/되돌리기**: 이슈가 감지되면 AI가 응답을 완료한 뒤 채팅 입력창에 `유지` 또는 `되돌리기`를 입력해 변경사항을 처리합니다.

```
유지        → 현재 변경사항을 그대로 유지
되돌리기    → 직전 AI 응답을 되돌려 이전 상태로 복구
```

**보고서**: 현재 및 과거 세션의 사용자 프롬프트를 집계하여 반복 안티패턴을 분석합니다.

```bash
/aasm review        # 최근 20개 메시지 기준 보고서 생성
/aasm review 50     # 최근 50개 메시지 기준 보고서 생성
/aasm-review        # 동일 기능 (단축 커맨드)
```

**모드 전환 및 상태 확인**:

```bash
/aasm active    # 감독 모드 활성화
/aasm passive   # 감독 모드 비활성화
/aasm status    # 현재 상태 확인
```

### ACPM: 접근 권한 관리

도구 카테고리와 경로 단위로 AI의 접근 범위를 제어합니다.

- **도구 카테고리** — `file-read`, `file-write`, `shell`, `web`, `lsp`, `mcp` 단위로 활성화/비활성화
- **경로 권한** — 경로별 `denied`, `read-only`, `read-write` 지정. 더 구체적인 경로가 우선 적용됩니다.

권한 설정은 프리셋으로 저장하여 전환 가능합니다. 세션별 독립 프리셋도 지원합니다(`.contexty/sessions/{id}/active-preset.json`). 활성 프리셋이 없을 경우 전체 허용으로 동작합니다.

```bash
acpm status          # 현재 권한 상태 확인
acpm list            # 프리셋 목록 조회
acpm switch <name>   # 프리셋 전환
acpm reload          # 디스크에서 설정 재로드
```

초기화(`bunx @ttalkkak-lab/opencode-contexty init`) 과정에서 대화형 위저드를 통해 프리셋을 생성할 수 있습니다.

### TLS: 터미널 출력 요약

명령어 실행 결과를 AI로 분석하여 `Success`, `Warning`, `Error`로 분류하고 핵심 정보를 요약합니다.

```bash
/tls npm run build
/tls git status
```

```
----------------------------------------------------
npm run build
----------------------------------------------------
상태: Error
 - src/index.ts 빌드 실패
 - 42줄: 타입 불일치 — 'string'을 'number' 파라미터에 할당할 수 없습니다.
```

---

## 설치

### CLI

```bash
bunx @ttalkkak-lab/opencode-contexty init
```

초기화 시 자동으로 수행되는 작업:

- OpenCode에 플러그인 등록
- IDE 확장 설치 (VSCode, Cursor, Windsurf 등)
- `contexty.config.json` 생성
- 설치 검증

**사전 요구사항**: [OpenCode](https://opencode.ai)가 설치되어 있어야 합니다.

### LLM을 통한 설치

아래 프롬프트를 LLM 세션에 붙여넣으면 자동으로 설치 및 설정이 진행됩니다.

```
Install and configure opencode-contexty by following the instructions here:
https://raw.githubusercontent.com/ttalkkak-lab/opencode-contexty/refs/heads/main/installation.md
```

---

더 자세한 옵션은 [설치 가이드](installation.md)를 참고하세요.

---

## VSCode 확장

Context Explorer 확장은 설치 시 자동으로 설치됩니다.

| 기능 | 설명 |
| --- | --- |
| **Context Explorer** | 컨텍스트 파일 트리 뷰 |
| **드래그 앤 드롭** | 파일/폴더를 드래그하여 컨텍스트에 추가 |
| **파일 추가** | 우클릭 컨텍스트 메뉴로 추가 |
| **선택 영역 추가** | 코드 선택 후 우클릭, 상태바, CodeLens로 추가 |
| **인라인 제거** | 트리에서 X 버튼으로 즉시 제거 |
| **에디터 하이라이트** | 컨텍스트 포함 라인을 연한 파란색으로 표시 |
| **자동 갱신** | 파일 변경 시 트리 자동 업데이트 |
| **블랙리스트** | 제거된 항목을 `.contexty/tool-parts.blacklist.json`에 저장하여 영구 제외 |
| **/ban** | 파일/경로 패턴으로 컨텍스트 파트를 일괄 블랙리스트 처리 |

플러그인과 확장을 분리한 이유는 다음과 같습니다.

- 플러그인은 데이터 수집을, 확장은 시각화를 담당합니다.
- 터미널 출력과 UI를 분리하여 각 역할을 명확히 합니다.
- IDE 통합으로 파일을 클릭하면 에디터에서 바로 열립니다.

---

## 설정

프로젝트 루트의 `contexty.config.json`으로 구성합니다.

```json
{
  "acpm": {
    "defaultPreset": "default"
  },
  "aasm": {
    "mode": "passive",
    "model": "claude-sonnet-4-20250514"
  },
  "tls": {
    "enabled": true,
    "model": "claude-sonnet-4-20250514"
  }
}
```

| 옵션 | 타입 | 기본값 | 설명 |
| --- | --- | --- | --- |
| `acpm.defaultPreset` | `string` | — | 시작 시 로드할 기본 권한 프리셋 |
| `aasm.mode` | `"active"` \| `"passive"` | `"passive"` | 감독 모드 |
| `aasm.model` | `string` | 호스트 기본값 | 린팅에 사용할 LLM 모델 |
| `tls.enabled` | `boolean` | `true` | TLS 활성화 여부 |
| `tls.model` | `string` | 호스트 기본값 | 요약에 사용할 LLM 모델 |

---

## 라이선스

Apache-2.0 © [ttalkkak-lab](https://github.com/ttalkkak-lab)

---

<div align="center">

[버그 리포트](https://github.com/ttalkkak-lab/opencode-contexty/issues) · [기능 요청](https://github.com/ttalkkak-lab/opencode-contexty/issues)

</div>
