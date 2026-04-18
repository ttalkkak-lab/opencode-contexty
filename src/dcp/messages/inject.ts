import { countAllMessageTokens } from "../tokenUtils";
import { getActiveSummaryTokenUsage } from "../state/utils";
import type { DCPConfig, SessionState, WithParts } from "../types";
import { assignMessageRefs, formatMessageIdTag } from "../messageIds";
import { appendToLastTextPart, createSyntheticTextPart, createSyntheticUserMessage } from "./utils";

const NUDGE_TAG = "[DCP context-limit nudge]";

function getMessageParts(message: WithParts): any[] {
  return Array.isArray(message.parts) ? (message.parts as any[]) : [];
}

function parseLimit(limit: DCPConfig["compress"]["maxContextLimit"], modelContextLimit: number | undefined): number | undefined {
  if (typeof limit === "number") {
    return limit;
  }

  if (!limit.endsWith("%") || modelContextLimit === undefined) {
    return undefined;
  }

  const percent = Number.parseFloat(limit.slice(0, -1));
  if (!Number.isFinite(percent)) {
    return undefined;
  }

  const clampedPercent = Math.max(0, Math.min(100, Math.round(percent)));
  return Math.round((clampedPercent / 100) * modelContextLimit);
}

function getLatestAnchorIndex(state: SessionState, messages: WithParts[]): number {
  let latest = -1;
  for (let index = messages.length - 1; index >= 0; index--) {
    if (state.nudges.contextLimitAnchors.has(messages[index].info.id)) {
      latest = index;
      break;
    }
  }

  return latest;
}

function hasNudgeText(message: WithParts): boolean {
  return getMessageParts(message).some((part) => part?.type === "text" && typeof part.text === "string" && part.text.includes(NUDGE_TAG));
}

function injectNudgeMessage(messages: WithParts[], nudgeText: string): WithParts {
  const base = messages[messages.length - 1] ?? {
    info: { id: "fallback", role: "user", time: { created: Date.now() } },
    parts: [],
  };

  const message = createSyntheticUserMessage(base, nudgeText, "context-limit", `context-limit:${base.info.id}:${messages.length}`);
  messages.push(message);
  return message;
}

export function injectCompressNudges(config: DCPConfig, state: SessionState, messages: WithParts[]): void {
  const limit = parseLimit(config.compress.maxContextLimit, state.modelContextLimit);
  if (limit === undefined || limit <= 0) {
    return;
  }

  const currentTokens = messages.reduce((total, message) => total + countAllMessageTokens(message), 0)
    + (state.systemPromptTokens ?? 0)
    + getActiveSummaryTokenUsage(state);

  if (currentTokens <= limit) {
    return;
  }

  const anchorIndex = getLatestAnchorIndex(state, messages);
  const nudgeFrequency = Math.max(1, Math.floor(config.compress.nudgeFrequency || 1));
  if (anchorIndex >= 0 && messages.length - 1 - anchorIndex < nudgeFrequency) {
    return;
  }

  const lastMessage = messages[messages.length - 1];
  if (!lastMessage || hasNudgeText(lastMessage) || state.nudges.contextLimitAnchors.has(lastMessage.info.id)) {
    return;
  }

  const nudgeText = config.compress.nudgeForce === "strong"
    ? `${NUDGE_TAG}\nCompress the conversation now.`
    : `${NUDGE_TAG}\nPlease compress the conversation when you can.`;

  const nudgeMessage = injectNudgeMessage(messages, nudgeText);
  state.nudges.contextLimitAnchors.add(lastMessage.info.id);
  const parts = Array.isArray(nudgeMessage.parts) ? nudgeMessage.parts : (nudgeMessage.parts = []);
  if (parts.length === 0) {
    parts.push(createSyntheticTextPart(nudgeMessage, nudgeText));
    return;
  }

  appendToLastTextPart(nudgeMessage, nudgeText);
}

export function injectMessageIds(state: SessionState, messages: WithParts[]): number {
  const assigned = assignMessageRefs(state, messages);

  for (const message of messages) {
    const rawId = message.info?.id;
    if (typeof rawId !== "string" || rawId.length === 0) {
      continue;
    }

    const ref = state.messageIds.byRawId.get(rawId);
    if (!ref) {
      continue;
    }

    const tag = formatMessageIdTag(ref);
    const parts = getMessageParts(message);
    const alreadyTagged = parts.some((part) => part?.type === "text" && typeof part.text === "string" && part.text.includes(tag));
    if (alreadyTagged) {
      continue;
    }

    if (!appendToLastTextPart(message, tag)) {
      message.parts = [...parts, createSyntheticTextPart(message, tag)];
    }
  }

  return assigned;
}

export function stripStaleMetadata(messages: WithParts[]): void {
  for (const message of messages) {
    for (const part of getMessageParts(message)) {
      if (!part || typeof part !== "object") {
        continue;
      }

      if ("metadata" in part) {
        delete (part as { metadata?: unknown }).metadata;
      }

      if (part.type === "tool" && part.state && typeof part.state === "object" && "metadata" in part.state) {
        delete part.state.metadata;
      }
    }
  }
}
