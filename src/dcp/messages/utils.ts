import { createHash } from "node:crypto";
import type { MessagePart, WithParts } from "../types";

export function getMessageParts(message: WithParts): MessagePart[] {
  return Array.isArray(message.parts) ? message.parts : [];
}

const SUMMARY_ID_HASH_LENGTH = 16;
const DCP_BLOCK_ID_TAG_REGEX = /(<dcp-message-id(?=[\s>])[^>]*>)b\d+(<\/dcp-message-id>)/g;
const DCP_PAIRED_TAG_REGEX = /<dcp[^>]*>[\s\S]*?<\/dcp[^>]*>/gi;
const DCP_UNPAIRED_TAG_REGEX = /<\/?dcp[^>]*>/gi;

const generateStableId = (prefix: string, seed: string): string => {
  const hash = createHash("sha256").update(seed).digest("hex").slice(0, SUMMARY_ID_HASH_LENGTH);
  return `${prefix}_${hash}`;
};

export const createSyntheticUserMessage = (
  baseMessage: WithParts,
  content: string,
  variant?: string,
  stableSeed?: string,
): WithParts => {
  const info = baseMessage.info;
  const now = Date.now();
  const deterministicSeed = stableSeed?.trim() || info.id;
  const messageId = generateStableId("msg_dcp_summary", deterministicSeed);
  const partId = generateStableId("prt_dcp_summary", deterministicSeed);

  return {
    info: {
      id: messageId,
      sessionID: info.sessionID,
      role: "user" as const,
      agent: (info as Record<string, unknown>).agent,
      model: (info as Record<string, unknown>).model,
      time: { created: now },
      ...(variant !== undefined && { variant }),
    },
    parts: [
      {
        id: partId,
        sessionID: info.sessionID,
        messageID: messageId,
        type: "text" as const,
        text: content,
      },
    ],
  };
};

export const createSyntheticTextPart = (
  baseMessage: WithParts,
  content: string,
  stableSeed?: string,
) => {
  const info = baseMessage.info;
  const deterministicSeed = stableSeed?.trim() || info.id;
  const partId = generateStableId("prt_dcp_text", deterministicSeed);

  return {
    id: partId,
    sessionID: info.sessionID,
    messageID: info.id,
    type: "text" as const,
    text: content,
  };
};

export const appendToLastTextPart = (message: WithParts, injection: string): boolean => {
  const parts = getMessageParts(message);
  for (let i = parts.length - 1; i >= 0; i--) {
    const part = parts[i];
    if (part.type === "text") {
      return appendToTextPart(part, injection);
    }
  }

  return false;
};

export const appendToTextPart = (part: { type: string; text?: unknown }, injection: string): boolean => {
  if (typeof part.text !== "string") {
    return false;
  }

  const normalizedInjection = injection.replace(/^\n+/, "");
  if (!normalizedInjection.trim()) {
    return false;
  }

  if (part.text.includes(normalizedInjection)) {
    return true;
  }

  const baseText = part.text.replace(/\n*$/, "");
  part.text = baseText.length > 0 ? `${baseText}\n\n${normalizedInjection}` : normalizedInjection;
  return true;
};

export const appendToAllToolParts = (message: WithParts, tag: string): boolean => {
  let injected = false;
  for (const part of getMessageParts(message)) {
    if (part.type === "tool") {
      injected = appendToToolPart(part, tag) || injected;
    }
  }

  return injected;
};

export const appendToToolPart = (part: { type: string; state?: { status?: string; output?: unknown } }, tag: string): boolean => {
  const state = part.state;
  if (state?.status !== "completed" || typeof state.output !== "string") {
    return false;
  }

  if (state.output.includes(tag)) {
    return true;
  }

  state.output = `${state.output}${tag}`;
  return true;
};

export const hasContent = (message: WithParts): boolean => {
  return getMessageParts(message).some(
    (part) =>
      (part.type === "text" && typeof (part as { text?: unknown }).text === "string" && (part as { text: string }).text.trim().length > 0) ||
      (part.type === "tool" && (part as { state?: { status?: string; output?: unknown } }).state?.status === "completed" && typeof (part as { state: { output?: unknown } }).state.output === "string"),
  );
};

export const replaceBlockIdsWithBlocked = (text: string): string => {
  return text.replace(DCP_BLOCK_ID_TAG_REGEX, "$1BLOCKED$2");
};

export const stripHallucinationsFromString = (text: string): string => {
  return text.replace(DCP_PAIRED_TAG_REGEX, "").replace(DCP_UNPAIRED_TAG_REGEX, "");
};

export const stripHallucinations = (messages: WithParts[]): void => {
  for (const message of messages) {
    for (const part of getMessageParts(message)) {
      if (part.type === "text" && typeof (part as { text?: unknown }).text === "string") {
        (part as { text: string }).text = stripHallucinationsFromString((part as { text: string }).text);
      }

      const toolPart = part as { type: string; state?: { status?: string; output?: unknown } };
      if (toolPart.type === "tool" && toolPart.state?.status === "completed" && typeof toolPart.state.output === "string") {
        toolPart.state.output = stripHallucinationsFromString(toolPart.state.output);
      }
    }
  }
};
