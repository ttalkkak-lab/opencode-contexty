# Contexty - OpenCode Plugin

**바이브 엔지니어링의 새로운 패러다임**

Contexty는 OpenCode를 위한 혁신적인 플러그인으로, **"새 채팅의 딜레마"**를 해결하고 전문가와 비전문가 모두가 AI 에이전트를 효과적으로 제어할 수 있도록 설계되었습니다.

---

## 🎯 세 가지 핵심 모델

### 1. HSCMM (Human-supervised Context Managing Model)

**인간 감독 컨텍스트 관리 모델 - 전문가를 위한 고급 컨텍스트 제어**

#### 해결하는 문제: "새 채팅의 딜레마"

기존의 자동 컨텍스트 관리는 필연적으로 블랙박스가 될 수밖에 없습니다. 사용자는 AI의 "머릿속"에 무엇이 있는지 모르고, 컨텍스트가 오염되면 새 채팅을 만들어야 하는 구조적 문제가 있습니다.

**HSCMM은 사용자가 AI 에이전트의 뇌 속(컨텍스트)을 직접 관리**할 수 있게 합니다:

- **투명한 컨텍스트 가시화**: 현재 세션의 토큰 사용량, 파일 목록, 우선순위를 실시간으로 시각화
- **명시적 컨텍스트 제어**: 특정 파일을 컨텍스트에 추가하거나 제외하여 정확한 제어 가능
- **컨텍스트 스냅샷**: 성공 시점의 컨텍스트를 저장하고 복원하여 작업 연속성 보장

**결과**: 새 채팅을 만들지 않아도 되어 **더 빠르고**, 계획 주도형과 유사한 수준의 **안정성 보장**

#### 사용 예시

```bash
# AI가 지금 무엇을 보고 있는지 확인
/ctx status

# 특정 파일만 컨텍스트에 추가
/ctx add src/core.ts

# 불필요한 파일 제외
/ctx ignore tests/

# 성공 시점 저장
/ctx save working-state

# 나중에 복원
/ctx load working-state
```

---

### 2. AASM (Active Agent-supervised Model)

**능동형 에이전트 감독 모델 - 비전문가를 위한 실시간 아키텍처 린터**

#### 해결하는 문제: 생산성의 역설

기존의 바이브 코딩 에이전트는 비전문가의 요구를 무조건적으로 수행하여 오히려 코드베이스를 망가뜨리는 "생산성의 역설"을 일으켰습니다.

**AASM의 능동형 에이전트는 사용자의 제안을 무조건 따르는 것이 아닌**:

- **의도 분석**: 사용자 명령의 진짜 의도를 파악 (리팩토링/기능 추가/버그 수정 등)
- **실시간 아키텍처 린팅**: Anti-pattern을 사전에 감지하고 경고
- **역제안 시스템**: 가장 적합한 아키텍처를 역제안하고 승인을 요청

**결과**: ICCM보다 빠르고 **보다 높은 안정성 보장**

#### 사용 예시

```bash
사용자: "모든 로직을 main.ts에 넣어줘"

AASM:
⚠️  ARCHITECTURE LINT WARNING
🎯 Intent Type: refactor
📊 Architectural Impact: HIGH

⚠️  Monolithic Main detected - violates modular architecture
💡 Fix: Split into separate modules in dedicated directories

> Accept and proceed anyway? (Y/n): _
```

---

### 3. DSM (Dual-supervised Model)

**이중 감독(인간, 에이전트)형 모델 - HSCMM + AASM 복합 패러다임**

HSCMM과 AASM이 결합된 모델로, **인간과 에이전트가 함께 제어하고 감독**합니다:

- **전문가**: HSCMM으로 컨텍스트를 직접 제어하여 역량 최대화
- **비전문가**: AASM의 실시간 가이드로 안전하게 개발
- **모두**: 투명하고 예측 가능한 AI 협업 경험

**결과**: 바이브 엔지니어링에 어려움을 겪는 사람도 **역량을 최대로 끌어올릴 수 있는 복합 패러다임**

---

## 🛠️ 보조 모듈

### TLS (Terminal Logs Summarizing)

**토큰 효율성을 위한 로그 요약 시스템**

HSCMM의 컨텍스트 효율성을 높이기 위한 보조 도구:

- bash 실행 오류 시 긴 로그를 자동으로 감지하여 요약
- Ollama 로컬 LLM으로 핵심 원인만 추출
- 메인 모델의 컨텍스트 윈도우 낭비 방지

**새로운 기능: TLS Shell** 🔍

OpenCode에서 `/tls`를 입력하면 **TLS 기능이 적용된 특별한 터미널**이 열립니다:

- 일반 shell: `!` → 일반 터미널
- TLS Shell: `/tls` → 명령어 실행 시 자동 요약

**사용 예시**:

```bash
# OpenCode 채팅에서
/tls

# TLS Shell이 열리고 명령어 실행
$ npm install

# 명령어 실행 완료 시 자동으로 요약 표시
🔍 TLS - LOG SUMMARY
✅ npm install completed successfully
📦 Installed 245 packages in 3.2s
```

**예시 출력**:

```
🔍 TLS - LOG SUMMARY
❌ Error Type: ModuleNotFoundError
🔎 Root Cause: Missing dependency 'ollama'
💡 Fix: Run 'bun install ollama'
```

---

## 🚀 Quick Start

### Installation

#### Method 1: Local Development (현재)

```bash
cd /Users/obtuse/gitRepos/opncode-extension
bun install
bun run build

# Add to opencode.json
{
  "plugin": ["./dist/index.js"]
}
```

#### Method 2: npm (향후 배포 시)

```bash
npm install -g opencode-contexty
```

### OpenCode에서 사용하기

플러그인이 로드되면 **슬래시 커맨드로 직접 제어**할 수 있습니다:

#### 직접 제어 (슬래시 커맨드 - AI 개입 없음)

```bash
# HSCMM - 컨텍스트 직접 관리
/ctx status                    # 현재 컨텍스트 상태 확인
/ctx add package.json          # 파일 추가
/ctx pin src/core.ts           # 파일 고정
/ctx ignore node_modules/      # 패턴 무시
/ctx save stable-v1            # 스냅샷 저장
/ctx load stable-v1            # 스냅샷 복원

# AASM - 감독 모드 제어
/agent active                  # 능동형 감독 활성화
/agent passive                 # 감독 비활성화
/agent status                  # 현재 모드 확인
```

#### 자동 작동 (AI가 필요시 사용)

```bash
# TLS - bash 에러 시 자동 요약
$ npm run build
> error: module not found...
[긴 에러 로그]

→ TLS가 자동으로 요약하여 AI에게 전달
```

#### AASM 능동형 감독 예시

```
사용자: "모든 로직을 main.ts에 넣어줘"

→ AASM이 자동으로 감지하여 경고 주입:

⚠️  AASM - ARCHITECTURE LINT WARNING
🎯 Intent Type: refactor
📊 Architectural Impact: HIGH

⚠️  Monolithic Main detected - violates modular architecture
   💡 Fix: Split into separate modules in dedicated directories

💡 Suggestions:
   - Consider creating an architecture design document before implementing

→ AI는 이 경고를 보고 사용자에게 설명 + 대안 제시
```

### Ollama 설정 (TLS 사용 시)

```bash
# Install Ollama
curl -fsSL https://ollama.com/install.sh | sh

# Pull model
ollama pull gemma2:2b

# Verify
ollama list
```

### TLS Shell 사용법

#### 기본 사용

```bash
# OpenCode 채팅에서 /tls 입력
/tls

# TLS Shell이 열리면 일반 터미널처럼 사용
$ ls -la
$ git status
$ npm test

# 각 명령어 실행 완료 시 자동으로 요약이 표시됩니다
```

#### 명령어와 함께 실행

```bash
# 특정 명령어를 즉시 실행하면서 TLS Shell 열기
/tls npm install

# 명령어 실행 후 TLS Shell이 유지됩니다
```

#### 일반 터미널 vs TLS Shell

```bash
# 일반 터미널 (요약 없음)
!
→ 일반 터미널 열림

# TLS Shell (자동 요약)
/tls
→ 🔍 TLS Shell 열림
→ 명령어 실행 시 자동으로 요약 표시
→ 긴 로그도 핵심만 추출
```

---

## 📖 주요 사용 패턴

### 패턴 1: 전문가의 정밀 컨텍스트 제어 (HSCMM)

```
상황: 대규모 레거시 코드베이스에서 특정 모듈만 집중 수정

1. /ctx status
   → 현재 컨텍스트 상태 즉시 확인 (AI 개입 없음)

2. /ctx ignore tests/
   → 불필요한 토큰 절약

3. /ctx add src/core.ts
   → 필요한 파일만 집중

4. /ctx save working-auth
   → 성공 시점 스냅샷 저장

5. (나중에 문제 발생 시)
   /ctx load working-auth
   → 안전한 시점으로 즉시 롤백

결과: 새 채팅 만들 필요 없이 계속 작업 가능
     AI 개입 없이 직접 제어하므로 정확하고 빠름
```

### 패턴 2: 비전문가의 안전한 개발 (AASM)

```
상황: 초보 개발자가 기능 추가

사용자: "인증 로직을 main.ts에 다 추가해줘"

→ AASM이 자동으로 의도를 분석하고 경고 주입:

⚠️  AASM - ARCHITECTURE LINT WARNING
🎯 Intent Type: refactor
📊 Architectural Impact: HIGH

⚠️  Monolithic Main detected - violates modular architecture
   💡 Fix: Split into separate modules in dedicated directories

→ AI는 이 경고를 보고:

AI: "경고: main.ts에 모든 로직을 추가하는 것은 모놀리식 구조로
     아키텍처를 해칠 수 있습니다.

     대신 다음과 같이 분리하는 것을 권장합니다:
     - auth/login.ts
     - auth/token.ts
     - auth/middleware.ts

     그래도 진행하시겠습니까?"

결과: 아키텍처가 망가지는 것을 AI와 함께 사전 방지
     비전문가도 안전하게 개발 가능
```

### 패턴 3: 이중 감독으로 안정성 극대화 (DSM)

```
상황: 복잡한 리팩토링 작업

1. HSCMM으로 작업 범위 명확히 설정 (직접 제어)
   /ctx add src/api/
   /ctx ignore tests/
   /ctx save before-refactor

2. AASM 능동 모드 활성화
   /agent active

3. AI에게 작업 요청
   사용자: "API 구조를 RESTful하게 리팩토링해줘"

   → AASM 자동 분석:
   ⚠️  ARCHITECTURE LINT WARNING
   🎯 Intent Type: refactor
   📊 Architectural Impact: HIGH

   → AI가 경고를 보고 신중하게 접근

4. 작업 진행 중 에러 발생
   $ npm run build
   → TLS가 자동으로 로그 요약

5. 성공 후 스냅샷 저장
   /ctx save refactor-api-v1

결과:
- 인간(HSCMM 직접 제어) + 에이전트(AASM 자동 감독)
- 이중 감독으로 안전하고 빠른 리팩토링
- 문제 발생 시 즉시 롤백 가능
```

---

## 🔧 Configuration

`contexty.config.json` 생성 (선택사항):

```json
{
  "hscmm": {
    "maxTokens": 100000,
    "autoCleanupThreshold": 0.8,
    "ignorePatterns": ["node_modules/**", "dist/**", "*.log"]
  },
  "tls": {
    "enabled": true,
    "modelName": "gemma2:2b",
    "ollamaUrl": "http://localhost:11434",
    "logSizeThreshold": 2000
  },
  "aasm": {
    "mode": "active",
    "enableLinting": true,
    "confidenceThreshold": 0.7,
    "model": "claude-3-5-sonnet" // (선택사항) 특정 모델 강제 지정
  }
}
```

---

## 🎯 언제 어떤 모델을 사용하나?

| 상황                                | 추천 모델      | 이유                                        |
| ----------------------------------- | -------------- | ------------------------------------------- |
| 대규모 코드베이스, 특정 영역만 수정 | **HSCMM**      | 컨텍스트를 정밀하게 제어하여 토큰 낭비 방지 |
| 초보 개발자, 아키텍처 경험 부족     | **AASM**       | 실시간 가이드로 실수 방지                   |
| 복잡한 리팩토링, 높은 안정성 필요   | **DSM**        | 이중 감독으로 안전성 극대화                 |
| 긴 에러 로그 처리                   | **TLS** (자동) | 토큰 효율성을 위해 자동으로 요약            |

---

## 📊 성능 비교

| 지표                | 기존 방식 (ICCM)    | HSCMM      | AASM       | DSM        |
| ------------------- | ------------------- | ---------- | ---------- | ---------- |
| **속도**            | 느림 (새 채팅 반복) | ⚡ 빠름    | ⚡ 빠름    | ⚡ 빠름    |
| **안정성**          | 중간                | 높음       | 높음       | 매우 높음  |
| **학습 곡선**       | 낮음                | 중간       | 낮음       | 중간       |
| **전문가 적합도**   | ⭐⭐                | ⭐⭐⭐⭐⭐ | ⭐⭐⭐     | ⭐⭐⭐⭐⭐ |
| **비전문가 적합도** | ⭐⭐⭐              | ⭐⭐       | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |

---

## 🗺️ Roadmap

- **Phase 1 (Jan 2026)**: ✅ HSCMM 프로토타입 완성
- **Phase 2 (Feb 2026)**: ✅ TLS + AASM 구현 완료
- **Phase 3 (Mar 2026)**: 🎯 DSM 통합 및 테스트
- **Phase 4 (Apr 2026)**: 📦 npm 배포 및 데모

---

## 🛠️ Development

```bash
# Install dependencies
bun install

# Build
bun run build

# Development with watch mode
bun run dev

# Run tests
bun test
```

---

## 📋 Requirements

- **OpenCode** >= 1.0.0
- **Node.js** >= 18.0.0
- **Bun** >= 1.0.0 (권장)
- **Ollama** (선택 - TLS 사용 시)

---

## 📄 License

MIT

---

## 👥 Team

**Korea Ddalkkak Lab (대한민국 딸깍 연구소)**

- Team Leader: Junho Lee

---

## 📚 참고 자료

- `OPENCODE_PLUGIN_DEVELOPMENT.md` - OpenCode 플러그인 개발 가이드
- `PROJECT_SUMMARY.md` - 프로젝트 상세 문서
- `CONTRIBUTING.md` - 기여 가이드라인
- `CHANGELOG.md` - 버전 히스토리

---

## 💡 핵심 인사이트

**"새 채팅의 딜레마를 해결하는 것이 Contexty의 핵심입니다."**

기존 AI 코딩 도구들은 컨텍스트가 오염되면 새 채팅을 만들어야 하는 구조적 한계가 있습니다. 이는:

- 작업 연속성 단절
- 이전 컨텍스트 손실
- 반복적인 설명 필요
- 생산성 저하

Contexty는 **투명한 컨텍스트 관리(HSCMM)**와 **능동형 가이드(AASM)**로 이 문제를 근본적으로 해결합니다.
