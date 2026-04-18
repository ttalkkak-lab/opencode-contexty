import { countAllMessageTokens } from "../tokenUtils";
import { isMessageCompacted } from "../state/utils";
import type { SessionState, WithParts } from "../types";

export type CompressionPriority = "high" | "medium" | "low";

const RECENT_MESSAGE_WINDOW_MS = 5 * 60 * 1000;
const OLD_MESSAGE_WINDOW_MS = 24 * 60 * 60 * 1000;
const HIGH_TOOL_CALL_THRESHOLD = 2;

function getMessageParts(message: WithParts): any[] {
  return Array.isArray(message.parts) ? (message.parts as any[]) : [];
}

function countToolCalls(message: WithParts): number {
  let count = 0;
  for (const part of getMessageParts(message)) {
    if (part?.type === "tool" && typeof part.callID === "string" && part.callID.length > 0) {
      count++;
    }
  }

  return count;
}

function hasActiveCompressionReference(state: SessionState, message: WithParts): boolean {
  const rawId = message.info?.id;
  if (typeof rawId !== "string" || rawId.length === 0) {
    return false;
  }

  return state.prune.messages.byMessageId.has(rawId) || state.nudges.contextLimitAnchors.has(rawId) || state.nudges.turnNudgeAnchors.has(rawId) || state.nudges.iterationNudgeAnchors.has(rawId);
}

export function classifyMessagePriority(message: WithParts, state: SessionState): CompressionPriority {
  const role = message.info?.role;
  if (role === "system") {
    return "low";
  }

  if (isMessageCompacted(state, message) || hasActiveCompressionReference(state, message)) {
    return "low";
  }

  const createdAt = message.info?.time?.created;
  const ageMs = typeof createdAt === "number" ? Date.now() - createdAt : Number.POSITIVE_INFINITY;
  if (ageMs <= RECENT_MESSAGE_WINDOW_MS) {
    return "low";
  }

  const toolCalls = countToolCalls(message);
  const tokenCount = countAllMessageTokens(message);

  if (role === "user" && toolCalls >= HIGH_TOOL_CALL_THRESHOLD && ageMs >= OLD_MESSAGE_WINDOW_MS) {
    return "high";
  }

  if (tokenCount >= 5000 || toolCalls >= HIGH_TOOL_CALL_THRESHOLD) {
    return "medium";
  }

  return "medium";
}

export function buildPriorityMap(messages: WithParts[], state: SessionState): Map<string, CompressionPriority> {
  const priorities = new Map<string, CompressionPriority>();

  for (const message of messages) {
    const rawId = message.info?.id;
    if (typeof rawId !== "string" || rawId.length === 0) {
      continue;
    }

    priorities.set(rawId, classifyMessagePriority(message, state));
  }

  return priorities;
}
