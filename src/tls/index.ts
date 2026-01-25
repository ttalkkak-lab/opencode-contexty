import { Hooks } from '@opencode-ai/plugin';
import { OpencodeClient } from '@opencode-ai/sdk';
import getBashResult from './getBashResult';

const TLS = (client: OpencodeClient): Hooks['event'] => async ({ event }) => {
  const bashResult = getBashResult(event);
  if (bashResult.isBashToolCompleted) {
    const payload = {
      "model": "gemma3:1b",
      "prompt": (
        `Summarize the following terminal command and its output in 1-2 sentences in Korean.\nCommand: ${bashResult.command}\nOutput: ${bashResult.output}`
      ),
      "stream": false
    }
    
    const response = await fetch("http://127.0.0.1:11434/api/generate", {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify(payload)
    });

    if (response.status !== 200) {
      await client.tui.showToast({
        body: {
          title: "TLS",
          message: "Fail to summarize.",
          variant: "error",
          duration: 3000
        }
      })
    } else {
      const result = Object(await response.json());
      await client.tui.showToast({
        body: {
          title: "TLS",
          message: result?.response,
          variant: "info",
          duration: 60000
        }
      })
    };
  }
  
};

export function createTLSHook(client: OpencodeClient) {
  return TLS(client);
};
