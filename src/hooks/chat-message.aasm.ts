import type { OpencodeClient, UserMessage, Part } from '@opencode-ai/sdk';
import type { AASMModule } from '../aasm';
import { isAASMSubsession } from '../aasm/SubsessionHelper';

export function createAASMChatHook(aasm: AASMModule, client: OpencodeClient) {
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
    if (isAASMSubsession(input.sessionID)) {
      return;
    }

    if (!aasm.isEnabled()) {
      return;
    }

    const textParts = output.parts.filter((p: any) => p.type === 'text');

    if (textParts.some((p: any) => p.id === 'tls-part')) return;

    const userMessage = textParts
      .map((p: any) => {
        if (typeof p.text === 'string') return p.text;
        if (p.text && typeof p.text.value === 'string') return p.text.value;
        return JSON.stringify(p.text);
      })
      .join('\n')
      .trim()
      .normalize('NFC'); // Normalize unicode (fixes decomposed Korean input)

    await client.tui.showToast({
      body: {
        title: '📝 USER MESSAGE',
        message: `"${userMessage.substring(0, 50)}..."`,
        variant: 'info',
        duration: 3000,
      },
    });

    if (!userMessage) return;

    const mode = aasm.getMode();

    if (mode === 'passive') return;

    const loadingMessages = [
      'Analyzing user intent...',
      'Checking architectural integrity...',
      'Scanning for monolithic patterns...',
      'Validating against project conventions...',
      'Consulting active agent...',
    ];
    const progressIcons = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
    let iconIndex = 0;
    const modelName = aasm.getModelName();
    
    await client.tui.showToast({
      body: {
        title: `🧠 AASM Review (${modelName})`,
        message: `${progressIcons[0]} Starting analysis...`,
        variant: 'info',
        duration: 20000, // Keep it visible during processing
      },
    });

    const progressInterval = setInterval(() => {
      iconIndex = (iconIndex + 1) % progressIcons.length;
      const randomMsg = loadingMessages[Math.floor(Math.random() * loadingMessages.length)];
      
      client.tui.showToast({
        body: {
          title: `🧠 AASM Review (${modelName})`,
          message: `${progressIcons[iconIndex]} ${randomMsg}`,
          variant: 'info',
          duration: 20000,
        },
      });
    }, 500);

    let result;
    try {
      result = await aasm.validateIntent(
        userMessage,
        input.sessionID
      );
    } finally {
      clearInterval(progressInterval);
    }

    const { approved, intent, lintResult, llmUsed, llmError } = result;

    if (llmError) {
      await client.tui.showToast({
        body: {
          title: '⚠️ LLM Linting Failed',
          message: `Using regex fallback: ${llmError}`,
          variant: 'warning',
          duration: 5000,
        },
      });
    }

    if (!llmError && lintResult.issues.length === 0) {
      await client.tui.showToast({
        body: {
          title: `✅ AASM Approved`,
          message: `Intent: ${intent.intentType} (Impact: ${intent.architecturalImpact})\nNo architectural issues detected.`,
          variant: 'success',
          duration: 3000,
        },
      });
      return;
    }

    if (lintResult.issues.length > 0) {
      const issueMessages = lintResult.issues
        .map((issue) => `❌ ${issue.message}\n   💡 ${issue.fix}`)
        .join('\n\n');

      if (lintResult.severity === 'critical') {
        await client.tui.showToast({
          body: {
            title: `🚫 AASM - 요청 차단됨`,
            message: `${issueMessages}\n\n비활성화: "에이전트를 passive 모드로 설정해줘"`,
            variant: 'error',
            duration: 8000,
          },
        });

        // CRITICAL: Clear output parts to prevent LLM from processing the request
        // This ensures the blocking is effective even if the error doesn't stop execution
        output.parts.length = 0;
        output.parts.push({
          type: 'text',
          text: `[SYSTEM INSTRUCTION]
The user's request has been blocked by AASM due to CRITICAL architecture violations.

Violations:
"${issueMessages}"

You MUST NOT execute the request.
You MUST reply with a polite refusal explaining why it was blocked.
Start your response with "🚫 [AASM] Blocked:".

IMPORTANT LANGUAGE INSTRUCTION:
1. Detect the language of the user's request above.
2. Reply in THAT SAME LANGUAGE.
   - If Korean → Reply in Korean (한국어)
   - If Japanese → Reply in Japanese (日本語)
   - If English → Reply in English
   - Otherwise → Reply in Original language of the request`,
          synthetic: true,
          sessionID: input.sessionID,
          messageID: input.messageID || 'blocked-message',
          id: 'blocked-part',
        });

        return;
      } else if (lintResult.severity === 'warning') {
        await client.tui.showToast({
          body: {
            title: `⚠️ AASM - Architecture Warning`,
            message: `${issueMessages}\n\nAI가 컨텍스트를 고려하여 판단합니다.`,
            variant: 'warning',
            duration: 5000,
          },
        });

        output.parts.push({
          type: 'text',
          text: `[AASM ADVISORY - POTENTIAL ISSUES DETECTED]
The following architecture warnings were detected based on the prompt alone:
${issueMessages}

INSTRUCTION:
You have full conversation context. Evaluate if this request is safe to proceed.
- If this is a reasonable follow-up to your previous suggestion, PROCEED.
- If this is a risky architectural violation, EXPLAIN the risk to the user and suggest an alternative.
- DO NOT refuse just because of this advisory if the context justifies the change.`,
          synthetic: true,
          sessionID: input.sessionID,
          messageID: input.messageID || 'warning-message',
          id: 'warning-part',
        });
      }
    }
  };
}
