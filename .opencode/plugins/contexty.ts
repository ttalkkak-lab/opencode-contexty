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

      const partsByMessageID = new Map<string, typeof mergedParts>();
      for (const part of mergedParts) {
        if (!partsByMessageID.has(part.messageID)) {
          partsByMessageID.set(part.messageID, []);
        }
        partsByMessageID.get(part.messageID)?.push(part);
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
