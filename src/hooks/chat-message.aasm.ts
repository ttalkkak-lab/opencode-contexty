import type { OpencodeClient, UserMessage, Part } from '@opencode-ai/sdk';
import type { AASMModule } from '../aasm';
import { isAASMSubsession } from '../aasm/SubsessionHelper';
import { sessionTracker } from '../core/sessionTracker';
import { Logger } from '../utils';
import * as fs from 'fs/promises';
import * as path from 'path';

let lastTitleCacheTime = 0;
const TITLE_CACHE_INTERVAL = 5 * 60 * 1000;
const latestAnalysisTokenBySession = new Map<string, number>();
const pendingDecisionBySession = new Map<string, PendingAASMDecision>();
const LEGACY_DECISION_PROMPT_PATTERN =
  /^aasm\s+검토\s+결과가\s+있습니다\.\s*유지\s+또는\s+되돌리기\s+중\s+하나를\s+입력해\s*주세요\.\s*\(유지\s*\/\s*되돌리기\)\s*$/i;

type PendingAASMDecision = {
  anchorUserMessageID?: string;
  issueCount: number;
  severity: 'critical' | 'warning' | 'advisory';
};

type AASMDecision = 'keep' | 'revert';

function issueSummary(issue: { message: string; fix?: string }): string {
  return issue.fix ? `- ${issue.message}\n  fix: ${issue.fix}` : `- ${issue.message}`;
}

function nextAnalysisToken(sessionID: string): number {
  const token = (latestAnalysisTokenBySession.get(sessionID) ?? 0) + 1;
  latestAnalysisTokenBySession.set(sessionID, token);
  return token;
}

function isLatestAnalysis(sessionID: string, token: number): boolean {
  return latestAnalysisTokenBySession.get(sessionID) === token;
}

function parseInlineAASMReviewLimit(userMessage: string): number | null {
  const trimmed = userMessage.trim();

  // Accept parser variants while keeping the command intent strict.
  // Examples:
  // - /aasm-review
  // - /aasm-review 30
  // - /aasm review
  // - /aasm review 30
  // - aasm review 30
  const directMatch = trimmed.match(/^\/?aasm-review(?:\s+(\d+))?$/i);
  const splitMatch = trimmed.match(/^\/?aasm\s+review(?:\s+(\d+))?$/i);
  const match = directMatch ?? splitMatch;

  if (!match) {
    return null;
  }

  if (!match[1]) {
    return 20;
  }

  const parsed = Number.parseInt(match[1], 10);
  if (!Number.isFinite(parsed)) {
    return 20;
  }

  return Math.max(5, Math.min(100, parsed));
}

function parseInlineAASMModeCommand(userMessage: string): 'active' | 'passive' | 'status' | null {
  const trimmed = userMessage.trim();

  const aasmModeMatch = trimmed.match(/^\/?aasm\s+(active|passive|status)$/i);
  if (aasmModeMatch) {
    return aasmModeMatch[1].toLowerCase() as 'active' | 'passive' | 'status';
  }

  return null;
}

function parseAASMDecision(userMessage: string): AASMDecision | null {
  const normalized = userMessage
    .trim()
    .toLowerCase()
    .replace(/[.!?\s]+$/g, '');

  if (!normalized) {
    return null;
  }

  if (/^(keep|유지|적용|진행|계속|ok|오케이)$/.test(normalized)) {
    return 'keep';
  }

  if (/^(revert|rollback|undo|되돌리기|되돌려|취소)$/.test(normalized)) {
    return 'revert';
  }

  return null;
}

function setSyntheticTextPart(
  output: { message: UserMessage; parts: Part[] },
  sessionID: string,
  messageID: string,
  id: string,
  text: string
): void {
  output.parts.length = 0;
  output.parts.push({
    type: 'text',
    text,
    synthetic: true,
    sessionID,
    messageID,
    id,
  });
}

async function findAssistantMessageIDForRevert(
  client: OpencodeClient,
  sessionID: string,
  anchorUserMessageID?: string
): Promise<string | null> {
  const messagesResult = await client.session.messages({
    path: { id: sessionID },
  });
  const messages = (messagesResult.data ?? messagesResult) as any[];

  const entries = Array.isArray(messages) ? messages : [];

  if (anchorUserMessageID) {
    const anchorIndex = entries.findIndex((entry) => entry?.info?.id === anchorUserMessageID);
    if (anchorIndex >= 0) {
      for (let index = anchorIndex + 1; index < entries.length; index += 1) {
        const candidate = entries[index];
        if (candidate?.info?.role === 'assistant' && typeof candidate?.info?.id === 'string') {
          return candidate.info.id;
        }
      }
    }
  }

  for (let index = entries.length - 1; index >= 0; index -= 1) {
    const candidate = entries[index];
    if (candidate?.info?.role === 'assistant' && typeof candidate?.info?.id === 'string') {
      return candidate.info.id;
    }
  }

  return null;
}

async function handlePendingDecision(
  client: OpencodeClient,
  input: { sessionID: string; messageID?: string; userMessage: string },
  output: { message: UserMessage; parts: Part[] }
): Promise<boolean> {
  const pending = pendingDecisionBySession.get(input.sessionID);
  if (!pending) {
    return false;
  }

  const decision = parseAASMDecision(input.userMessage);

  if (!decision) {
    // Do not hijack normal prompts. Keep reminder as toast only.
    return false;
  }

  if (decision === 'keep') {
    pendingDecisionBySession.delete(input.sessionID);
    await client.tui.showToast({
      body: {
        title: '✅ AASM 유지 선택',
        message: '현재 변경사항을 그대로 유지합니다.',
        variant: 'success',
        duration: 2500,
      },
    });

    setSyntheticTextPart(
      output,
      input.sessionID,
      input.messageID || 'aasm-decision-inline-message',
      'aasm-decision-inline-part',
      'AASM 결정: 변경사항을 유지합니다.'
    );
    return true;
  }

  try {
    const messageIDToRevert = await findAssistantMessageIDForRevert(
      client,
      input.sessionID,
      pending.anchorUserMessageID
    );

    if (!messageIDToRevert) {
      throw new Error('되돌릴 assistant 메시지를 찾지 못했습니다.');
    }

    await client.session.revert({
      path: { id: input.sessionID },
      body: { messageID: messageIDToRevert },
    });

    pendingDecisionBySession.delete(input.sessionID);

    await client.tui.showToast({
      body: {
        title: '↩️ AASM 되돌리기 완료',
        message: '최근 변경사항을 되돌렸습니다.',
        variant: 'success',
        duration: 3000,
      },
    });

    setSyntheticTextPart(
      output,
      input.sessionID,
      input.messageID || 'aasm-decision-inline-message',
      'aasm-decision-inline-part',
      'AASM 결정: 변경사항을 되돌렸습니다.'
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    await client.tui.showToast({
      body: {
        title: '⚠️ AASM 되돌리기 실패',
        message: errorMessage,
        variant: 'error',
        duration: 4000,
      },
    });

    setSyntheticTextPart(
      output,
      input.sessionID,
      input.messageID || 'aasm-decision-inline-message',
      'aasm-decision-inline-part',
      `AASM 되돌리기 실패: ${errorMessage}`
    );
  }

  return true;
}

async function startBackgroundAnalysis(
  aasm: AASMModule,
  client: OpencodeClient,
  userMessage: string,
  sessionID: string,
  token: number,
  anchorUserMessageID?: string
): Promise<void> {
  const modelName = aasm.getModelName();

  await client.tui.showToast({
    body: {
      title: `🧠 AASM Review (${modelName})`,
      message: '백그라운드에서 아키텍처 검토를 진행 중입니다.',
      variant: 'info',
      duration: 2500,
    },
  });

  try {
    const { intent, lintResult, llmError } = await aasm.validateIntent(userMessage, sessionID);

    if (!isLatestAnalysis(sessionID, token)) {
      Logger.debug('Skipping stale AASM analysis result', { sessionID, token });
      return;
    }

    if (llmError) {
      await client.tui.showToast({
        body: {
          title: '⚠️ AASM LLM 분석 실패',
          message: `정규식 fallback 사용: ${llmError}`,
          variant: 'warning',
          duration: 5000,
        },
      });
    }

    if (lintResult.issues.length === 0) {
      if (!llmError) {
        await client.tui.showToast({
          body: {
            title: '✅ AASM Review Complete',
            message: `Intent: ${intent.intentType} (impact: ${intent.architecturalImpact})`,
            variant: 'success',
            duration: 2500,
          },
        });
      }
      return;
    }

    const issues = lintResult.issues.map(issueSummary).join('\n');
    const severityLabel = lintResult.severity.toUpperCase();
    const detailDuration = lintResult.severity === 'critical' ? 15000 : 12000;

    await client.tui.showToast({
      body: {
        title: `⚠️ AASM ${severityLabel}`,
        message: [
          `Intent: ${intent.intentType} (impact: ${intent.architecturalImpact})`,
          `${lintResult.issues.length}개의 아키텍처 이슈 감지`,
          issues,
          '',
          '백그라운드 검토가 완료되었습니다.',
        ].join('\n'),
        variant: lintResult.severity === 'critical' ? 'error' : 'warning',
        duration: detailDuration,
      },
    });

    pendingDecisionBySession.set(sessionID, {
      anchorUserMessageID,
      issueCount: lintResult.issues.length,
      severity: lintResult.severity,
    });

    await client.tui.showToast({
      body: {
        title: '선택 필요: 유지/되돌리기',
        message:
          '변경 완료 후 처리 방식을 선택해 주세요. 다음 입력에 유지 또는 되돌리기를 입력하면 됩니다.',
        variant: 'warning',
        duration: 12000,
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    Logger.warn(`Background AASM analysis failed: ${errorMessage}`);
    await client.tui.showToast({
      body: {
        title: '⚠️ AASM Background Review Failed',
        message: errorMessage,
        variant: 'warning',
        duration: 5000,
      },
    });
  }
}

async function cacheSessionTitles(client: OpencodeClient, directory: string): Promise<void> {
  const now = Date.now();
  if (now - lastTitleCacheTime < TITLE_CACHE_INTERVAL) {
    return;
  }
  lastTitleCacheTime = now;

  try {
    const result = await client.session.list();
    const sessions = result?.data;
    if (!Array.isArray(sessions)) {
      Logger.debug('cacheSessionTitles: unexpected response', { type: typeof result?.data });
      return;
    }

    for (const session of sessions) {
      if (!session?.id) {
        continue;
      }
      const sessionDir = path.join(directory, '.contexty', 'sessions', session.id);
      await fs.mkdir(sessionDir, { recursive: true });
      const metaPath = path.join(sessionDir, 'meta.json');
      const data = JSON.stringify({ title: session.title || '' });
      await fs.writeFile(metaPath, data, 'utf-8');
    }
    Logger.debug(`cached titles for ${sessions.length} sessions`);
  } catch (e) {
    Logger.debug('cacheSessionTitles failed', {
      error: e instanceof Error ? e.message : String(e),
    });
  }
}

export function createAASMChatHook(aasm: AASMModule, client: OpencodeClient, directory: string) {
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
    sessionTracker.setSessionId(input.sessionID);
    void cacheSessionTitles(client, directory);

    if (isAASMSubsession(input.sessionID)) {
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

    if (!userMessage) return;

    if (LEGACY_DECISION_PROMPT_PATTERN.test(userMessage)) {
      await client.tui.showToast({
        body: {
          title: 'AASM 안내 문구 무시됨',
          message:
            '입력창 안내 문구는 자동으로 무시되었습니다. 원래 작업 요청을 다시 입력해 주세요.',
          variant: 'info',
          duration: 7000,
        },
      });

      output.parts.length = 0;
      output.parts.push({
        type: 'text',
        text: 'AASM 안내 문구 입력은 무시되었습니다. 원래 작업 요청을 입력해 주세요.',
        synthetic: true,
        sessionID: input.sessionID,
        messageID: input.messageID || 'aasm-legacy-prompt-message',
        id: 'aasm-legacy-prompt-part',
      });
      return;
    }

    const inlineReviewLimit = parseInlineAASMReviewLimit(userMessage);
    if (inlineReviewLimit !== null) {
      try {
        const report = await aasm.generateAntiPatternReport(input.sessionID, inlineReviewLimit);
        output.parts.length = 0;
        output.parts.push({
          type: 'text',
          text: report,
          synthetic: true,
          sessionID: input.sessionID,
          messageID: input.messageID || 'aasm-review-inline-message',
          id: 'aasm-review-inline-part',
        });
      } catch (error) {
        output.parts.length = 0;
        output.parts.push({
          type: 'text',
          text: `AASM review failed: ${error instanceof Error ? error.message : String(error)}`,
          synthetic: true,
          sessionID: input.sessionID,
          messageID: input.messageID || 'aasm-review-inline-message',
          id: 'aasm-review-inline-part',
        });
      }
      return;
    }

    const inlineModeCommand = parseInlineAASMModeCommand(userMessage);
    if (inlineModeCommand) {
      try {
        const result = await aasm.handleCommand(inlineModeCommand);
        output.parts.length = 0;
        output.parts.push({
          type: 'text',
          text: result,
          synthetic: true,
          sessionID: input.sessionID,
          messageID: input.messageID || 'aasm-mode-inline-message',
          id: 'aasm-mode-inline-part',
        });
      } catch (error) {
        output.parts.length = 0;
        output.parts.push({
          type: 'text',
          text: `AASM mode command failed: ${error instanceof Error ? error.message : String(error)}`,
          synthetic: true,
          sessionID: input.sessionID,
          messageID: input.messageID || 'aasm-mode-inline-message',
          id: 'aasm-mode-inline-part',
        });
      }
      return;
    }

    if (await handlePendingDecision(client, { ...input, userMessage }, output)) {
      return;
    }

    if (aasm.getMode() === 'passive') return;

    const token = nextAnalysisToken(input.sessionID);
    void startBackgroundAnalysis(
      aasm,
      client,
      userMessage,
      input.sessionID,
      token,
      input.messageID
    );
  };
}
