> [!NOTE]
>
> **opencode-contexty**는 [OpenCode](https://github.com/sst/opencode)에 컨텍스트 엔지니어링 레이어를 추가하는 플러그인입니다.

> [!TIP]
>
> **빠른 시작**
>
> ```bash
> npx @ttalkkak-lab/opencode-contexty init
> ```

<!-- <CENTERED SECTION FOR GITHUB DISPLAY> -->

<div align="center">

[teaser.webm](https://github.com/user-attachments/assets/6dbeab08-1245-4a40-b6fd-6e3d9e07682d)

# opencode-contexty

### OpenCode를 위한 컨텍스트 엔지니어링

**HSCMM** · **AASM** · **ACPM** · **TLS** · **DCP**

[![npm version](https://img.shields.io/npm/v/@ttalkkak-lab/opencode-contexty?color=369eff&labelColor=black&logo=npm&style=flat-square)](https://www.npmjs.com/package/@ttalkkak-lab/opencode-contexty)
[![License](https://img.shields.io/badge/license-Apache%202.0-white?labelColor=black&style=flat-square)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.4-blue?labelColor=black&logo=typescript&style=flat-square)](https://www.typescriptlang.org/)
[![Bun](https://img.shields.io/badge/Bun-runtime-f472b6?labelColor=black&logo=bun&style=flat-square)](https://bun.sh/)

[English](README.en.md) | [한국어](README.md)

</div>

<!-- </CENTERED SECTION FOR GITHUB DISPLAY> -->

---

## 1. 개요

현대적인 AI 코딩 워크플로우에서 발생하는 가장 큰 문제는 '속도'가 아니라 '방향'입니다. 특히 대규모 프로젝트로 갈수록 AI는 전체 맥락을 잃거나, 당장의 기능 구현을 위해 기존 아키텍처를 파괴하는 경향이 있습니다.

opencode-contexty는 다음 세 가지 핵심 가치에 집중합니다.

1. **가시성**: AI가 무엇을 알고 무엇을 모르는지 개발자가 실시간으로 확인합니다.
2. **통제권**: AI의 접근 권한과 참조 범위를 개발자가 정교하게 제어합니다.
3. **지속 가능성**: 초보 개발자의 잘못된 프롬프트나 AI의 단기적 판단이 아키텍처 부채로 이어지지 않도록 실시간으로 개입합니다.

---

## 2. 핵심 기능 상세

### 2.1 AASM (Active Agent-supervised Architecture)
**초보자를 위한 실시간 프롬프트 가이드 및 아키텍처 감독**

AASM은 AI가 작업을 수행하기 전, 사용자의 **프롬프트 단계에서 개입**하는 지능형 에이전트입니다. 아키텍처 설계 경험이 부족한 개발자가 AI에게 잘못된 방향의 지시를 내릴 때 이를 실시간으로 교정합니다.

* **프롬프트 수준의 개입**: 사용자가 "모든 기능을 한 파일에 구현해줘" 혹은 "검증 로직 없이 API만 짜줘"와 같이 품질 저하를 유발하는 지시를 내리면, AASM이 즉시 개입하여 대안적인 아키텍처(관심사 분리, 모듈화 등)를 제안합니다.
* **실시간 안티패턴 분석**: 코드 생성 중 모놀리식 파일, 갓 오브젝트(God Object), 전역 상태 남용 등이 감지되면 즉시 경고를 발생시킵니다.
* **의사결정 보조**: 이슈 감지 시 `유지` 또는 `되돌리기` 커맨드를 통해 개발자가 구조적 결정을 명확히 내리도록 유도합니다.

### 2.2 HSCMM (Human-supervised Context Management)
**시각화된 컨텍스트 제어 센터**

AI가 참조하는 정보를 블랙박스에 가두지 않고, 사용자가 직접 눈으로 보고 편집할 수 있는 환경을 제공합니다.

* **Context Explorer**: VSCode 확장을 통해 현재 세션에서 AI가 '기억'하고 있는 파일과 코드 조각을 트리 형태로 시각화합니다.
* **수동 컨텍스트 인젝션**: 탐색기에서 특정 폴더나 파일을 드래그 앤 드롭하여 AI에게 즉시 학습시키거나, 필요 없는 부분을 즉각 제거할 수 있습니다.
* **블랙리스트 기능 (/ban)**: `/ban @src/legacy`와 같은 명령어로 AI가 절대 참조해서는 안 될 경로를 지정하여 불필요한 노이즈를 차단합니다.

### 2.3 ACPM (Active Context Permission Management)
**정교한 도구 및 경로별 권한 관리**

AI가 프로젝트의 중요 파일을 훼손하지 않도록 접근 범위를 물리적으로 제한합니다.

* **카테고리별 도구 제한**: `file-read`, `file-write`, `shell`, `lsp`, `web` 등 도구 사용 권한을 카테고리별로 활성화/비활성화합니다.
* **계층적 경로 권한**: 특정 디렉토리에 대해 `denied`(접근 불가), `read-only`(읽기 전용), `read-write`(읽기/쓰기 가능) 권한을 부여합니다. 더 구체적인 경로 설정이 항상 우선순위를 가집니다.
* **세션별 프리셋**: 상황에 따라 '안전 모드', '과감한 리팩토링 모드' 등의 프리셋을 신속하게 전환할 수 있습니다.

### 2.4 TLS (Terminal Log Supervision)
**지능형 터미널 출력 요약**

방대한 터미널 출력값을 AI가 분석하여 개발자가 알아야 할 핵심 정보로 압축합니다.

* **성공/실패 분류**: 빌드나 테스트 결과를 `Success`, `Warning`, `Error`로 신속히 분류합니다.
* **핵심 에러 추출**: 수백 줄의 로그 중 실제 수정이 필요한 오류 위치와 원인만을 추출하여 보고합니다.

---

## 3. 설치 및 초기화 (Installation)

### 3.1 CLI 설치
OpenCode가 설치된 환경에서 아래 명령어를 실행하여 설치 마법사를 시작합니다.

```bash
bunx @ttalkkak-lab/opencode-contexty init
```

이 과정에서 다음 작업이 수행됩니다:
1. OpenCode 플러그인 레지스트리 등록
2. VSCode / Cursor 전용 확장 프로그램 설치
3. 기본 설정 파일(`contexty.config.json`) 및 권한 프리셋 생성

### 3.2 LLM 세션을 통한 설치
이미 실행 중인 AI 세션이 있다면 다음 프롬프트를 사용하여 즉시 설정을 시작할 수 있습니다.

```text
아래 가이드를 참고하여 내 프로젝트에 opencode-contexty를 설치하고 설정해줘:
[https://raw.githubusercontent.com/ttalkkak-lab/opencode-contexty/refs/heads/main/installation.md](https://raw.githubusercontent.com/ttalkkak-lab/opencode-contexty/refs/heads/main/installation.md)
```

---

## 4. 구성 설정 (Configuration)

`contexty.config.json` 파일을 통해 시스템의 민감도를 조절할 수 있습니다.

```json
{
  "$schema": "[https://unpkg.com/@ttalkkak-lab/opencode-contexty/schema.json](https://unpkg.com/@ttalkkak-lab/opencode-contexty/schema.json)",
  "aasm": {
    "mode": "active",
    "model": "openai/gpt-5.3-codex-spark"
  },
  "dcp": {
    "enabled": true,
    "debug": true,
    "pruneNotification": "detailed",
    "pruneNotificationType": "chat",
    "commands": {
      "enabled": true,
      "protectedTools": []
    },
    "manualMode": {
      "enabled": false,
      "automaticStrategies": []
    },
    "turnProtection": {
      "enabled": true,
      "turns": 3
    },
    "experimental": {
      "allowSubAgents": false,
      "customPrompts": false
    },
    "protectedFilePatterns": [],
    "compress": {
      "mode": "range",
      "permission": "allow",
      "showCompression": true,
      "summaryBuffer": 3,
      "maxContextLimit": 180000,
      "minContextLimit": 50000,
      "nudgeFrequency": 3
    },
    "strategies": {
      "deduplication": {
        "enabled": true,
        "protectedTools": []
      },
      "purgeErrors": {
        "enabled": true,
        "turns": 4,
        "protectedTools": []
      }
    }
  }
}
```

* **aasm.mode**: `active`로 설정 시 프롬프트 단계에서 적극적으로 개입합니다.
* **aasm.threshold**: 경고를 표시할 최소 위험 수위를 설정합니다 (`Critical`, `Warning`, `Advisory`).

---

## 5. 로드맵 (Roadmap)

* **DCP (Dynamic Context Pruning)**: 긴 대화 내역 중 핵심 가치가 낮은 데이터를 자동으로 압축하여 토큰 효율을 최적화하는 기능입니다. (Beta)
* **Cross-IDE Support**: Windsurf 및 JetBrains 계열 에디터 지원을 확대하고 있습니다.

---

## 6. 라이선스 및 기여 (License & Contribution)

이 프로젝트는 **AGPL-3.0 License** 하에 배포됩니다.
버그 제보나 기능 제안은 GitHub Issues를 통해 언제든 환영합니다.

© 2026 [ttalkkak-lab](https://github.com/ttalkkak-lab). All rights reserved.