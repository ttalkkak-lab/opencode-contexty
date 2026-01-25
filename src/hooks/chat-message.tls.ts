import type { OpencodeClient, UserMessage, Part } from '@opencode-ai/sdk';
import type { TLSModule } from '../tls';

const TLS_TRIGGER_PREFIX = '/tls';

export function createTLSChatHook(tlsModule: TLSModule, client: OpencodeClient) {
  return async (
    input: {
      sessionID: string;
      agent?: string;
      model?: { providerID: string; modelID: string };
      messageID?: string;
      variant?: string;
    },
    output: { message: UserMessage; parts: Part[] }
  ) => {
    const textParts = output.parts.filter(
      (p): p is Part & { type: 'text'; text: string } =>
        p.type === 'text' && typeof (p as any).text === 'string'
    );

    if (textParts.length === 0) return;

    const firstTextPart = textParts[0];
    const userMessage = (firstTextPart as any).text?.trim() || '';

    // /tls는 Tool로 처리되므로 여기서는 무시
    if (userMessage.startsWith(TLS_TRIGGER_PREFIX)) {
      console.log('[TLS] /tls detected, skipping chat hook (handled by Tool)');
      return;
    }
  };
}
