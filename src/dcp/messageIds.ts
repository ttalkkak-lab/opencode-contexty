import type { SessionState, WithParts } from "./types";

const MESSAGE_REF_REGEX = /^m(\d{4})$/;
const BLOCK_REF_REGEX = /^b([1-9]\d*)$/;
const MESSAGE_ID_TAG_NAME = "dcp-message-id";

export const MESSAGE_REF_WIDTH = 4;
export const MESSAGE_REF_MIN_INDEX = 1;
export const MESSAGE_REF_MAX_INDEX = 9999;

export type ParsedBoundaryId =
  | {
      kind: "message";
      ref: string;
      index: number;
    }
  | {
      kind: "compressed-block";
      ref: string;
      blockId: number;
    };

function escapeXmlAttribute(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function formatMessageRef(index: number): string {
  if (
    !Number.isInteger(index) ||
    index < MESSAGE_REF_MIN_INDEX ||
    index > MESSAGE_REF_MAX_INDEX
  ) {
    throw new Error(
      `Message ID index out of bounds: ${index}. Supported range is 0-${MESSAGE_REF_MAX_INDEX}.`,
    );
  }

  return `m${index.toString().padStart(MESSAGE_REF_WIDTH, "0")}`;
}

export function formatBlockRef(blockId: number): string {
  if (!Number.isInteger(blockId) || blockId < 1) {
    throw new Error(`Invalid block ID: ${blockId}`);
  }

  return `b${blockId}`;
}

export function parseMessageRef(ref: string): number | null {
  const normalized = ref.trim().toLowerCase();
  const match = normalized.match(MESSAGE_REF_REGEX);
  if (!match) {
    return null;
  }

  const index = Number.parseInt(match[1], 10);
  if (!Number.isInteger(index)) {
    return null;
  }

  if (index < MESSAGE_REF_MIN_INDEX || index > MESSAGE_REF_MAX_INDEX) {
    return null;
  }

  return index;
}

export function parseBlockRef(ref: string): number | null {
  const normalized = ref.trim().toLowerCase();
  const match = normalized.match(BLOCK_REF_REGEX);
  if (!match) {
    return null;
  }

  const id = Number.parseInt(match[1], 10);
  return Number.isInteger(id) ? id : null;
}

export function parseBoundaryId(id: string): ParsedBoundaryId | null {
  const normalized = id.trim().toLowerCase();
  const messageIndex = parseMessageRef(normalized);
  if (messageIndex !== null) {
    return {
      kind: "message",
      ref: formatMessageRef(messageIndex),
      index: messageIndex,
    };
  }

  const blockId = parseBlockRef(normalized);
  if (blockId !== null) {
    return {
      kind: "compressed-block",
      ref: formatBlockRef(blockId),
      blockId,
    };
  }

  return null;
}

export function formatMessageIdTag(
  ref: string,
  attributes?: Record<string, string | undefined>,
): string {
  const serializedAttributes = Object.entries(attributes || {})
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([name, value]) => {
      if (name.trim().length === 0 || typeof value !== "string" || value.length === 0) {
        return "";
      }

      return ` ${name}="${escapeXmlAttribute(value)}"`;
    })
    .join("");

  return `\n<${MESSAGE_ID_TAG_NAME}${serializedAttributes}>${ref}</${MESSAGE_ID_TAG_NAME}>`;
}

export function isMessageWithInfo(message: unknown): message is WithParts {
  if (!message || typeof message !== "object") {
    return false;
  }

  const candidate = message as Record<string, unknown>;
  const info = candidate.info;
  if (!info || typeof info !== "object") {
    return false;
  }

  const infoRecord = info as Record<string, unknown>;
  if (typeof infoRecord.id !== "string" || !infoRecord.id.length) {
    return false;
  }

  if (typeof infoRecord.role !== "string" || !infoRecord.role.length) {
    return false;
  }

  return true;
}

export function filterProcessableMessages(messages: unknown): WithParts[] {
  if (!Array.isArray(messages)) {
    return [];
  }

  return messages.filter(isMessageWithInfo);
}

export function isIgnoredUserMessage(message: WithParts): boolean {
  if (!isMessageWithInfo(message)) {
    return false;
  }

  if (message.info.role !== "user") {
    return false;
  }

  const parts = Array.isArray(message.parts) ? message.parts : [];
  if (parts.length === 0) {
    return true;
  }

  for (const part of parts) {
    if (!(part as { ignored?: unknown }).ignored) {
      return false;
    }
  }

  return true;
}

export function getLastUserMessage(messages: WithParts[], startIndex?: number): WithParts | null {
  const start = startIndex ?? messages.length - 1;
  for (let i = start; i >= 0; i--) {
    const msg = messages[i];
    if (!isMessageWithInfo(msg)) {
      continue;
    }

    if (msg.info.role === "user" && !isIgnoredUserMessage(msg)) {
      return msg;
    }
  }

  return null;
}

export function assignMessageRefs(state: SessionState, messages: WithParts[]): number {
  let assigned = 0;
  let skippedSubAgentPrompt = false;
  const messageIds = state.messageIds;

  for (const [index, message] of messages.entries()) {
    if (isIgnoredUserMessage(message)) {
      continue;
    }

    if (state.isSubAgent && !skippedSubAgentPrompt && message.info.role === "user") {
      skippedSubAgentPrompt = true;
      continue;
    }

    if (typeof message.info.id !== "string" || message.info.id.length === 0) {
      message.info.id = `msg_${index}`;
    }

    const rawMessageId = message.info.id;

    const existingRef = messageIds.byRawId.get(rawMessageId);
    if (existingRef) {
      if (messageIds.byRef.get(existingRef) !== rawMessageId) {
        messageIds.byRef.set(existingRef, rawMessageId);
      }
      continue;
    }

    const ref = allocateNextMessageRef(state);
    messageIds.byRawId.set(rawMessageId, ref);
    messageIds.byRef.set(ref, rawMessageId);
    assigned++;
  }

  return assigned;
}

function allocateNextMessageRef(state: SessionState): string {
  const messageIds = state.messageIds;
  let candidate = Number.isInteger(messageIds.nextRef)
    ? Math.max(MESSAGE_REF_MIN_INDEX, messageIds.nextRef)
    : MESSAGE_REF_MIN_INDEX;

  while (candidate <= MESSAGE_REF_MAX_INDEX) {
    const ref = formatMessageRef(candidate);
    if (!messageIds.byRef.has(ref)) {
      messageIds.nextRef = candidate + 1;
      return ref;
    }
    candidate++;
  }

  throw new Error(
    `Message ID alias capacity exceeded. Cannot allocate more than ${formatMessageRef(MESSAGE_REF_MAX_INDEX)} aliases in this session.`,
  );
}
