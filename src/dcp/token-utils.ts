import * as _anthropicTokenizer from '@anthropic-ai/tokenizer';

import { getLastUserMessage } from './message-ids';
import { DCPLogger } from './logger';
import type { SessionState, WithParts } from './types';

const anthropicCountTokens = (
  _anthropicTokenizer.countTokens ?? (_anthropicTokenizer as any).default?.countTokens
) as typeof _anthropicTokenizer.countTokens;

export function countTokens(text: string): number {
  if (!text) return 0;
  try {
    return anthropicCountTokens(text);
  } catch {
    return Math.round(text.length / 4);
  }
}

export function estimateTokensBatch(texts: string[]): number {
  if (texts.length === 0) return 0;
  return countTokens(texts.join(' '));
}

export const COMPACTED_TOOL_OUTPUT_PLACEHOLDER = '[Old tool result content cleared]';

function stringifyToolContent(value: unknown): string {
  return typeof value === 'string' ? value : JSON.stringify(value);
}

export function extractCompletedToolOutput(part: any): string | undefined {
  if (part?.type !== 'tool' || part.state?.status !== 'completed' || part.state?.output === undefined) {
    return undefined;
  }

  if (part.state?.time?.compacted) {
    return COMPACTED_TOOL_OUTPUT_PLACEHOLDER;
  }

  return stringifyToolContent(part.state.output);
}

export function extractToolContent(part: any): string[] {
  const contents: string[] = [];

  if (part?.type !== 'tool') {
    return contents;
  }

  if (part.state?.input !== undefined) {
    contents.push(stringifyToolContent(part.state.input));
  }

  const completedOutput = extractCompletedToolOutput(part);
  if (completedOutput !== undefined) {
    contents.push(completedOutput);
  } else if (part.state?.status === 'error' && part.state?.error) {
    contents.push(stringifyToolContent(part.state.error));
  }

  return contents;
}

export function countToolTokens(part: any): number {
  return estimateTokensBatch(extractToolContent(part));
}

export function getTotalToolTokens(state: SessionState, toolIds: string[]): number {
  let total = 0;
  for (const id of toolIds) {
    const entry = state.toolParameters.get(id);
    total += entry?.tokenCount ?? 0;
  }
  return total;
}

export function countMessageTextTokens(msg: WithParts): number {
  const texts: string[] = [];
  const parts = Array.isArray(msg.parts) ? msg.parts : [];
  for (const part of parts) {
    if (part.type === 'text' && typeof part.text === 'string') {
      texts.push(part.text);
    }
  }
  if (texts.length === 0) return 0;
  return estimateTokensBatch(texts);
}

export function countAllMessageTokens(msg: WithParts): number {
  const parts = Array.isArray(msg.parts) ? msg.parts : [];
  const texts: string[] = [];
  for (const part of parts) {
    if (part.type === 'text' && typeof part.text === 'string') {
      texts.push(part.text);
    } else {
      texts.push(...extractToolContent(part));
    }
  }
  if (texts.length === 0) return 0;
  return estimateTokensBatch(texts);
}

export function getCurrentParams(
  state: SessionState,
  messages: WithParts[],
  logger: DCPLogger,
): {
  providerId: string | undefined;
  modelId: string | undefined;
  agent: string | undefined;
  variant: string | undefined;
} {
  const userMsg = getLastUserMessage(messages);
  if (!userMsg) {
    logger.debug('No user message found when determining current params');
    return {
      providerId: undefined,
      modelId: undefined,
      agent: undefined,
      variant: state.variant,
    };
  }
  const userInfo = userMsg.info as any;
  const agent: string = userInfo.agent;
  const providerId: string | undefined = userInfo.model?.providerID;
  const modelId: string | undefined = userInfo.model?.modelID;
  const variant: string | undefined = state.variant ?? userInfo.variant;

  return { providerId, modelId, agent, variant };
}
