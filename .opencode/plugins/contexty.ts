import type { Plugin } from "@opencode-ai/plugin";
import { readToolLog, writeToolLog } from "./utils/tool-log";

export const ContextyPlugin: Plugin = async ({ directory }) => {
  return {
    "tool.execute.after": async (_input, _output) => {},
    "experimental.chat.messages.transform": async (_input, output) => {
      const toolPartsFromMessages = output.messages.flatMap((message) =>
        message.parts.filter(
          (part) => part.type === "tool" && part.metadata?.contexty?.source !== "tool-log"
        )
      );

      await writeToolLog(directory, { parts: toolPartsFromMessages });

      for (const message of output.messages) {
        message.parts = message.parts.filter(
          (part) => part.type !== "tool" && part.metadata?.contexty?.source !== "tool-log"
        );
      }

      const toolLog = await readToolLog(directory);
      if (toolLog.parts.length === 0) {
        return;
      }

      const partsByMessageID = new Map<string, typeof toolLog.parts>();
      for (const part of toolLog.parts) {
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
