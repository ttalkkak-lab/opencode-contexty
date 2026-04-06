import type {
  AcpmMetrics,
  FileMetrics,
  MetricsSnapshot,
  ToolMetrics,
  TokenMetrics,
} from './types';

interface MessagePart {
  type: string;
  [key: string]: any;
}

interface MessageInfo {
  id: string;
  role: string;
}

interface Message {
  info: MessageInfo;
  parts: MessagePart[];
  tokens?: {
    input?: number;
    output?: number;
    reasoning?: number;
    cache?: {
      read?: number;
      write?: number;
    };
  };
}

function toNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function estimateTokens(content: unknown): number {
  return typeof content === 'string' && content.length > 0 ? Math.ceil(content.length / 4) : 0;
}

function isErrorStatus(status: unknown): boolean {
  return status === 'error' || status === 'failed' || status === 'failure' || status === 'errored';
}

export class MetricsCollector {
  constructor(private readonly directory: string) {}

  collect(messages: Message[], sessionId = 'unknown'): MetricsSnapshot {
    void this.directory;

    const tokens: TokenMetrics = {
      input: 0,
      output: 0,
      reasoning: 0,
      cacheRead: 0,
      cacheWrite: 0,
    };

    const files = new Map<string, FileMetrics>();
    const tools = new Map<string, ToolMetrics>();

    for (const message of messages) {
      if (message.info.role === 'assistant') {
        tokens.input += toNumber(message.tokens?.input);
        tokens.output += toNumber(message.tokens?.output);
        tokens.reasoning += toNumber(message.tokens?.reasoning);
        tokens.cacheRead += toNumber(message.tokens?.cache?.read);
        tokens.cacheWrite += toNumber(message.tokens?.cache?.write);
      }

      for (const part of message.parts) {
        if (part.type === 'file') {
          const path = part.source?.path ?? part.url;
          if (typeof path !== 'string' || path.length === 0) {
            continue;
          }

          const tokenEstimate = estimateTokens(part.content);
          const existing = files.get(path);
          if (existing) {
            existing.tokenEstimate += tokenEstimate;
          } else {
            files.set(path, {
              path,
              tokenEstimate,
              role: message.info.role,
            });
          }
        }

        if (part.type === 'tool') {
          const name = part.tool;
          if (typeof name !== 'string' || name.length === 0) {
            continue;
          }

          const status = part.state?.status;
          if (status !== 'completed' && !isErrorStatus(status)) {
            continue;
          }

          const existing = tools.get(name);
          if (existing) {
            existing.count += 1;
            if (status === 'completed') {
              existing.successCount += 1;
            } else {
              existing.failCount += 1;
            }
          } else {
            tools.set(name, {
              name,
              count: 1,
              successCount: status === 'completed' ? 1 : 0,
              failCount: status === 'completed' ? 0 : 1,
            });
          }
        }
      }
    }

    return {
      version: 1,
      sessionID: sessionId,
      timestamp: new Date().toISOString(),
      tokens,
      files: [...files.values()],
      tools: [...tools.values()],
      acpm: this.createEmptyAcpmMetrics(),
    };
  }

  private createEmptyAcpmMetrics(): AcpmMetrics {
    return {
      activePreset: null,
      allowCount: 0,
      denyCount: 0,
      sanitizeCount: 0,
      deniedByCategory: {},
      folderAccessDistribution: {
        denied: 0,
        'read-only': 0,
        'read-write': 0,
      },
      toolCategoryStatus: [],
    };
  }
}
