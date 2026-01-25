# TLS Shell 기능 개발 문서

## 개요

OpenCode 플러그인에 **TLS (Terminal Logs Summarizing) Shell** 기능을 추가했습니다. 이 기능은 `!!` 트리거로 TLS 기능이 자동 적용되는 특별한 터미널을 제공합니다.

## 주요 기능

### 1. 이중 터미널 시스템

- **일반 Shell**: `!` → 일반 터미널
- **TLS Shell**: `!tls` → TLS 자동 요약 터미널

### 2. 자동 명령어 감지 및 요약

TLS Shell에서 실행된 모든 명령어는:

1. 자동으로 감지됨
2. 출력 결과가 수집됨
3. Ollama LLM으로 요약됨
4. 토스트 메시지로 표시됨

### 3. 토큰 효율성

- 긴 로그를 핵심 내용만으로 요약
- 메인 LLM의 컨텍스트 윈도우 절약
- 로컬 Ollama 사용으로 비용 없음

## 구현 세부사항

### 파일 구조

```
src/
├── hooks/
│   └── chat-message.tls.ts    # TLS Shell 트리거 및 PTY 생성
├── tls/
│   ├── TLSModule.ts            # 핵심 로직 (PTY 추적, 명령어 감지, 요약)
│   └── index.ts                # 이벤트 훅 export
```

### 핵심 컴포넌트

#### 1. TLS Shell 트리거 ([chat-message.tls.ts](src/hooks/chat-message.tls.ts))

```typescript
const TLS_TRIGGER_PREFIX = '!tls';
const TLS_SHELL_TITLE = '🔍🤖 TLS SHELL (Auto-Summary Mode) 🔍🤖';
```

**동작 방식**:

- 사용자가 `!tls`로 시작하는 메시지 입력
- PTY(Pseudo-Terminal) 생성
- TLSModule에 PTY 세션 등록
- 터미널 연결 및 토스트 표시

#### 2. PTY 세션 관리 ([TLSModule.ts](src/tls/TLSModule.ts))

```typescript
private tlsPtySessions: Set<string> = new Set();
private ptyCommandBuffers: Map<string, { buffer: string; lastCommand: string }>;
```

**주요 메서드**:

- `addTLSPtySession(ptyId)`: TLS 추적 활성화
- `removeTLSPtySession(ptyId)`: 추적 해제
- `isTLSPtySession(ptyId)`: 추적 여부 확인

#### 3. 명령어 감지 로직

```typescript
async processPtyData(ptyId: string, data: string): Promise<void>
```

**알고리즘**:

1. PTY 출력 데이터를 버퍼에 누적
2. 프롬프트 패턴 감지 (`$`, `%`, `>`, `#` 등)
3. 프롬프트 발견 시 이전 내용을 명령어+출력으로 분리
4. 첫 번째 라인에서 명령어 추출
5. 나머지를 출력으로 처리
6. 이전 명령어와 중복되지 않으면 요약 실행

**프롬프트 패턴**:

```typescript
const promptPattern = /^[^\r\n]*[$%>#]\s*$/;
```

#### 4. 이벤트 기반 처리

```typescript
async processPtyEvent(event: any): Promise<void>
```

OpenCode SDK의 이벤트 시스템과 통합:

- `pty.data.updated`: PTY 출력 데이터 수신
- `pty.exited`: PTY 종료 시 세션 정리

### 설정

#### contexty.config.json

```json
{
  "tls": {
    "enabled": true,
    "modelName": "gemma2:2b",
    "ollamaUrl": "http://127.0.0.1:11434",
    "logSizeThreshold": 2000
  }
}
```

## 사용 예시

### 기본 사용

```bash
# OpenCode 채팅에서
!tls

# TLS Shell 열림
🔍 TLS Shell이 열렸습니다. 명령어를 입력하면 자동으로 요약이 표시됩니다.

# 명령어 실행
$ npm install
...긴 출력...

# 자동 요약 표시
🔍 TLS - LOG SUMMARY
✅ npm install completed successfully
📦 Installed 245 packages in 3.2s
```

### 명령어와 함께 실행

```bash
# OpenCode 채팅에서
!tls git status

# 명령어가 먼저 실행되고 TLS Shell이 유지됨
🔍 TLS 모드로 실행: git status
명령어 실행 시 자동으로 요약이 표시됩니다.
```

### 에러 감지 예시

```bash
$ npm run build

# 빌드 에러 발생 시
🔍 TLS - LOG SUMMARY
❌ Error Type: TypeScript Compilation Error
🔎 Root Cause: Type mismatch in TLSModule.ts:230
💡 Fix: Update Event type or use type assertion
```

## 기술적 도전과 해결

### 1. PTY 출력 파싱

**도전**: PTY는 raw terminal data를 제공하므로 ANSI 이스케이프 시퀀스, 캐리지 리턴 등이 포함됨

**해결**:

- 프롬프트 패턴으로 명령어 경계 감지
- 버퍼 기반 누적으로 완전한 출력 수집
- 중복 방지를 위한 lastCommand 추적

### 2. 이벤트 타입 호환성

**도전**: OpenCode SDK의 Event 타입에 PTY 이벤트가 명시적으로 포함되지 않음

**해결**:

```typescript
async processPtyEvent(event: any): Promise<void>
```

확장 이벤트를 `any`로 처리하여 유연성 확보

### 3. 메모리 관리

**도전**: 장시간 실행 시 버퍼가 무한정 커질 수 있음

**해결**:

```typescript
if (bufferData.buffer.length > 10000) {
  const lines = bufferData.buffer.split(/\r?\n/);
  bufferData.buffer = lines.slice(-20).join('\n');
}
```

버퍼 크기 제한 및 자동 정리

## 향후 개선 방향

### 1. 프롬프트 감지 개선

- 다양한 Shell 프롬프트 지원 (fish, powershell 등)
- 커스텀 프롬프트 패턴 설정 기능

### 2. 선택적 요약

- 특정 명령어만 요약 (예: 에러가 있을 때만)
- 요약 조건 설정 (최소 출력 길이 등)

### 3. 요약 품질 개선

- 더 정교한 프롬프트 엔지니어링
- 명령어 타입별 맞춤 요약 (build, test, install 등)

### 4. 통계 및 로깅

- 명령어 실행 통계
- 요약 히스토리 저장
- 세션별 리포트 생성

## 테스트 방법

### 1. 기본 테스트

```bash
# Ollama 실행 확인
ollama list

# 플러그인 빌드
bun run build

# OpenCode에서 테스트
!!
$ echo "Hello TLS"
$ ls -la
$ git status
```

### 2. 에러 케이스 테스트

```bash
!!
$ nonexistentcommand
$ npm install nonexistentpackage
```

### 3. 긴 출력 테스트

```bash
!!
$ npm install
$ docker build .
$ npm run test
```

## 관련 파일

- [src/hooks/chat-message.tls.ts](src/hooks/chat-message.tls.ts)
- [src/tls/TLSModule.ts](src/tls/TLSModule.ts)
- [src/tls/index.ts](src/tls/index.ts)
- [src/index.ts](src/index.ts)
- [README.md](README.md)

## 의존성

- `@opencode-ai/plugin`: OpenCode SDK
- Ollama: 로컬 LLM (gemma2:2b 권장)

## 라이선스

이 프로젝트의 라이선스를 따릅니다.
