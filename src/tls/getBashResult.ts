import { Event } from "@opencode-ai/sdk";

export default function getBashResult(event: Event) {
  if (event.type === "message.part.updated") {
    const part = event.properties.part;
    if (part.type === "tool" && part?.tool === "bash" && part?.state?.status === "completed") {
      const {input: {command}, output} = part.state;
      return {
        isBashToolCompleted: true,
        command: command,
        output: output
      };
    }
  }
  return {isBashToolCompleted: false};
}
