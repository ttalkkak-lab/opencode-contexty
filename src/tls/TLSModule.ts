import type { OpencodeClient, Event } from '@opencode-ai/sdk';

export interface BashResult {
  command: string;
  output: string;
  timestamp: number;
  sessionID: string;
  messageID: string;
}

export interface TLSSummaryResult {
  success: boolean;
  summary?: string;
  error?: string;
}

export interface TLSConfig {
  enabled?: boolean;
  modelName?: string;
  ollamaUrl?: string;
  logSizeThreshold?: number;
  debug?: boolean;
}

const DEFAULT_CONFIG: Required<TLSConfig> = {
  enabled: true,
  modelName: 'gemma3:1b',
  ollamaUrl: 'http://127.0.0.1:11434',
  logSizeThreshold: 2000,
  debug: true,
};

export class TLSModule {
  private client: OpencodeClient;
  private config: Required<TLSConfig>;
  private lastBashResult: BashResult | null = null;
  private tlsPtySessions: Set<string> = new Set();
  private ptyCommandBuffers: Map<string, { buffer: string; lastCommand: string }> = new Map();

  constructor(client: OpencodeClient, config?: TLSConfig) {
    this.client = client;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // PTY 세션을 TLS 추적 목록에 추가
  addTLSPtySession(ptyId: string): void {
    this.tlsPtySessions.add(ptyId);
    this.ptyCommandBuffers.set(ptyId, { buffer: '', lastCommand: '' });
  }

  // PTY 세션을 TLS 추적 목록에서 제거
  removeTLSPtySession(ptyId: string): void {
    this.tlsPtySessions.delete(ptyId);
    this.ptyCommandBuffers.delete(ptyId);
  }

  // 특정 PTY가 TLS 추적 중인지 확인
  isTLSPtySession(ptyId: string): boolean {
    return this.tlsPtySessions.has(ptyId);
  }

  isEnabled(): boolean {
    return this.config.enabled;
  }

  getLastBashResult(): BashResult | null {
    return this.lastBashResult;
  }

  storeBashResult(result: BashResult): void {
    this.lastBashResult = result;
  }

  extractBashResultFromEvent(event: Event): BashResult | null {
    if (event.type !== 'message.part.updated') {
      return null;
    }

    const part = event.properties.part;
    if (part.type === 'tool' && part.tool === 'bash' && part.state?.status === 'completed') {
      const state = part.state as unknown as { input: { command: string }; output: string };
      return {
        command: state.input.command,
        output: state.output,
        timestamp: Date.now(),
        sessionID: part.sessionID,
        messageID: part.messageID,
      };
    }

    return null;
  }

  async summarize(bashResult: BashResult): Promise<TLSSummaryResult> {
    if (!this.isEnabled()) {
      return { success: false, error: 'TLS is disabled' };
    }

    const payload = {
      model: this.config.modelName,
      prompt: `Summarize the following terminal command and its output in 1-2 sentences in Korean.
Command: ${bashResult.command}
Output: ${bashResult.output}`,
      stream: false,
    };

    try {
      const response = await fetch(`${this.config.ollamaUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (response.status !== 200) {
        return {
          success: false,
          error: `Ollama returned status ${response.status}`,
        };
      }

      const result = (await response.json()) as { response?: string };
      return {
        success: true,
        summary: result.response || 'No summary generated',
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async summarizeLastBash(): Promise<TLSSummaryResult> {
    if (!this.lastBashResult) {
      return { success: false, error: 'No bash result stored' };
    }
    return this.summarize(this.lastBashResult);
  }

  async showToast(result: TLSSummaryResult): Promise<void> {
    if (result.success) {
      await this.client.tui.showToast({
        body: {
          title: '🔍 TLS - LOG SUMMARY',
          message: result.summary || '',
          variant: 'info',
          duration: 60000,
        },
      });
    } else {
      await this.client.tui.showToast({
        body: {
          title: 'TLS',
          message: `Failed to summarize: ${result.error}`,
          variant: 'error',
          duration: 3000,
        },
      });
    }
  }

  // PTY 데이터를 처리하여 명령어 실행 감지
  async processPtyData(ptyId: string, data: string): Promise<void> {
    if (!this.isTLSPtySession(ptyId) || !this.isEnabled()) {
      return;
    }

    // 디버그 모드: 데이터 수신 알림
    if (this.config.debug) {
      await this.client.tui.showToast({
        body: {
          title: '🐛 TLS DEBUG',
          message: `PTY 데이터 수신 (${data.length} bytes):\n${data.substring(0, 100)}${data.length > 100 ? '...' : ''}`,
          variant: 'info',
          duration: 2000,
        },
      });
    }

    const bufferData = this.ptyCommandBuffers.get(ptyId);
    if (!bufferData) return;

    bufferData.buffer += data;

    // 프롬프트 패턴 감지 (명령어 실행 완료 시그널)
    // 일반적인 쉘 프롬프트: $ , % , > , # 등으로 끝나는 라인
    const lines = bufferData.buffer.split(/\r?\n/);

    // 마지막 라인이 프롬프트처럼 보이면 명령어 실행 완료로 간주
    const lastLine = lines[lines.length - 1] || '';
    const promptPattern = /^[^\r\n]*[\$%>#]\s*$/;

    if (promptPattern.test(lastLine) && bufferData.buffer.length > 50) {
      // 명령어와 출력 분리 시도
      const contentLines = lines.slice(0, -1); // 마지막 프롬프트 라인 제외

      if (contentLines.length > 0) {
        // 첫 번째 라인에서 명령어 추출 시도
        const firstLine = contentLines[0];
        const commandMatch = firstLine.match(/[\$%>#]\s+(.+)$/);

        if (commandMatch && commandMatch[1]) {
          const command = commandMatch[1].trim();
          const output = contentLines.slice(1).join('\n');

          // 이전 명령어와 다른 경우에만 요약
          if (command !== bufferData.lastCommand && output.length > 10) {
            bufferData.lastCommand = command;

            // 명령어 감지 알림
            await this.client.tui.showToast({
              body: {
                title: '🔍 TLS - 명령어 감지',
                message: `실행됨: ${command.length > 50 ? command.substring(0, 50) + '...' : command}`,
                variant: 'info',
                duration: 2000,
              },
            });

            const bashResult: BashResult = {
              command,
              output,
              timestamp: Date.now(),
              sessionID: ptyId,
              messageID: `pty-${ptyId}-${Date.now()}`,
            };

            this.storeBashResult(bashResult);

            // 요약 처리 중 알림
            await this.client.tui.showToast({
              body: {
                title: '🔍 TLS - 요약 생성 중',
                message: 'Ollama로 로그를 요약하고 있습니다...',
                variant: 'info',
                duration: 1500,
              },
            });

            const summary = await this.summarize(bashResult);
            await this.showToast(summary);
          }
        }
      }

      // 버퍼 리셋 (너무 커지지 않도록)
      bufferData.buffer = lastLine;
    }

    // 버퍼가 너무 커지면 오래된 데이터 제거
    if (bufferData.buffer.length > 10000) {
      const lines = bufferData.buffer.split(/\r?\n/);
      bufferData.buffer = lines.slice(-20).join('\n');
    }
  }

  // PTY 이벤트 처리 (이벤트 타입 확장 필요 시)
  async processPtyEvent(event: any): Promise<void> {
    // pty.data.updated 이벤트 감지 (SDK에서 지원하는 경우)
    if (event.type === 'pty.data.updated') {
      const ptyId = event.properties?.id;
      const data = event.properties?.data;

      if (ptyId && data && this.isTLSPtySession(ptyId)) {
        await this.processPtyData(ptyId, data);
      }
    }
    // pty.exited 이벤트 감지
    else if (event.type === 'pty.exited') {
      const ptyId = event.properties?.id;

      if (ptyId) {
        this.removeTLSPtySession(ptyId);
      }
    }
  }

  async processEvent(event: Event, autoSummarize: boolean = false): Promise<void> {
    // PTY 이벤트 처리 (확장 이벤트)
    await this.processPtyEvent(event);

    // Bash 결과 처리
    const bashResult = this.extractBashResultFromEvent(event);
    if (bashResult) {
      this.storeBashResult(bashResult);

      if (autoSummarize) {
        const summary = await this.summarize(bashResult);
        await this.showToast(summary);
      }
    }
  }
}
