import type { Plugin } from "@opencode-ai/plugin";
import { readToolLog, readToolLogBlacklist, writeToolLog } from "./utils/tool-log";

export const ContextyPlugin: Plugin = async ({ directory }) => {
  return {
    "tool.execute.after": async (_input, _output) => {},
    "experimental.chat.messages.transform": async (_input, output) => {
      const toolPartsFromMessages = output.messages.flatMap((message) =>
        message.parts.filter(
          (part) => part.type === "tool" && part.metadata?.contexty?.source !== "tool-log"
        )
      );

      const blacklist = await readToolLogBlacklist(directory);
      const blacklistIds = new Set(blacklist.ids);

      const persisted = await readToolLog(directory);
      const existingIds = new Set(persisted.parts.map((part) => part.id));

      const appendParts = toolPartsFromMessages.filter(
        (part) => !blacklistIds.has(part.id) && !existingIds.has(part.id)
      );

      const mergedParts = [...persisted.parts, ...appendParts].filter(
        (part) => !blacklistIds.has(part.id)
      );

      if (appendParts.length > 0 || persisted.parts.length !== mergedParts.length) {
        await writeToolLog(directory, { parts: mergedParts });
      }

      for (const message of output.messages) {
        message.parts = message.parts.filter(
          (part) => part.type !== "tool" && part.metadata?.contexty?.source !== "tool-log"
        );
      }

      if (mergedParts.length === 0) {
        return;
      }

      const messageIDs = new Set(output.messages.map((message) => message.info.id));
      const fallbackMessageID =
        [...output.messages].reverse().find((message) => message.info.role === "assistant")
          ?.info.id ?? output.messages[output.messages.length - 1]?.info.id;
      const partsByMessageID = new Map<string, typeof mergedParts>();
      for (const part of mergedParts) {
        const resolvedMessageID = messageIDs.has(part.messageID)
          ? part.messageID
          : fallbackMessageID;
        if (!resolvedMessageID) {
          continue;
        }
        const contextyMetadata =
          typeof part.metadata?.contexty === "object" && part.metadata?.contexty
            ? (part.metadata.contexty as Record<string, unknown>)
            : undefined;
        const taggedPart = {
          ...part,
          messageID: resolvedMessageID,
          metadata: {
            ...part.metadata,
            contexty: {
              ...contextyMetadata,
              source: "tool-log",
              ...(resolvedMessageID !== part.messageID
                ? { originalMessageID: part.messageID }
                : {})
            }
          }
        };
        if (!partsByMessageID.has(resolvedMessageID)) {
          partsByMessageID.set(resolvedMessageID, []);
        }
        partsByMessageID.get(resolvedMessageID)?.push(taggedPart);
      }

      for (const message of output.messages) {
        const parts = partsByMessageID.get(message.info.id);
        if (!parts || parts.length === 0) {
          continue;
        }
        message.parts = [...message.parts, ...parts];
      }
    }
  };
};

export default ContextyPlugin;
