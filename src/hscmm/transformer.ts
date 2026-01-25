import { readToolLog, readToolLogBlacklist, writeToolLog, ToolLogEntry } from './storage';

// Define minimal interfaces for the input/output structure
interface MessageInfo {
  id: string;
  role: string;
}

interface MessagePart {
  type: string;
  metadata?: Record<string, any>;
  [key: string]: any;
}

interface Message {
  info: MessageInfo;
  parts: MessagePart[];
}

interface HookOutput {
  messages: Message[];
}

function isValidToolPart(part: any): part is ToolLogEntry {
  return (
    part &&
    typeof part === 'object' &&
    part.type === 'tool' &&
    typeof part.id === 'string' &&
    typeof part.messageID === 'string' &&
    typeof part.tool === 'string' &&
    part.state &&
    typeof part.state === 'object'
  );
}

export function createHSCMMTransformHook(directory: string) {
  return async (_input: unknown, output: HookOutput) => {
    // 1. Extract new tool parts from messages
    const toolPartsFromMessages: ToolLogEntry[] = [];

    for (const message of output.messages) {
      for (const part of message.parts) {
        if (
          part.type === 'tool' &&
          part.metadata?.contexty?.source !== 'tool-log'
        ) {
          if (isValidToolPart(part)) {
            toolPartsFromMessages.push(part);
          } else {
            // For now, ignore invalid parts to prevent crashing or persisting bad data
            console.warn(`[Contexty] Invalid tool part encountered: ${part.id || 'unknown'}`);
          }
        }
      }
    }

    // 2. Load existing state
    const [blacklistSpec, persistedSpec] = await Promise.all([
      readToolLogBlacklist(directory),
      readToolLog(directory),
    ]);

    const blacklistIds = new Set(blacklistSpec.ids);
    const existingIds = new Set(persistedSpec.parts.map((part) => part.id));

    // 3. Filter new parts
    const appendParts = toolPartsFromMessages.filter(
      (part) => !blacklistIds.has(part.id) && !existingIds.has(part.id)
    );

    // 4. Merge and persist
    const mergedParts = [...persistedSpec.parts, ...appendParts].filter(
      (part) => !blacklistIds.has(part.id)
    );

    if (appendParts.length > 0 || persistedSpec.parts.length !== mergedParts.length) {
      await writeToolLog(directory, { parts: mergedParts });
    }

    // 5. Remove original tool parts from messages (to be replaced/re-injected)
    for (const message of output.messages) {
      message.parts = message.parts.filter(
        (part) => part.type !== 'tool' && part.metadata?.contexty?.source !== 'tool-log'
      );
    }

    if (mergedParts.length === 0) {
      return;
    }

    // 6. Re-inject tool parts
    const messageIDs = new Set(output.messages.map((message) => message.info.id));

    // Find fallback message ID (last assistant message or just last message)
    // Note: We search in reverse to find the last assistant message
    const reversedMessages = [...output.messages].reverse();
    const lastAssistantMessage = reversedMessages.find((m) => m.info.role === 'assistant');
    const fallbackMessageID =
      lastAssistantMessage?.info.id ?? output.messages[output.messages.length - 1]?.info.id;

    const partsByMessageID = new Map<string, ToolLogEntry[]>();

    for (const part of mergedParts) {
      const resolvedMessageID = messageIDs.has(part.messageID)
        ? part.messageID
        : fallbackMessageID;

      if (!resolvedMessageID) {
        continue;
      }

      // Clone and tag
      const contextyMetadata = part.metadata?.contexty as Record<string, unknown> | undefined;

      const taggedPart: ToolLogEntry = {
        ...part,
        messageID: resolvedMessageID,
        metadata: {
          ...part.metadata,
          contexty: {
            ...contextyMetadata,
            source: 'tool-log',
            ...(resolvedMessageID !== part.messageID
              ? { originalMessageID: part.messageID }
              : {}),
          },
        },
      };

      if (!partsByMessageID.has(resolvedMessageID)) {
        partsByMessageID.set(resolvedMessageID, []);
      }
      partsByMessageID.get(resolvedMessageID)!.push(taggedPart);
    }

    // 7. Append back to messages
    for (const message of output.messages) {
      const parts = partsByMessageID.get(message.info.id);
      if (parts && parts.length > 0) {
        message.parts = [...message.parts, ...parts];
      }
    }
  };
}
