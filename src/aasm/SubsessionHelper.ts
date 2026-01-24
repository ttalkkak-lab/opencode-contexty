import type { OpencodeClient } from '@opencode-ai/sdk';
import type { SubsessionConfig } from '../types';
import { Logger } from '../utils';

const DEFAULT_CONFIG: SubsessionConfig = {
  timeout: 30 * 1000,
  pollInterval: 500,
  stabilityRequired: 3,
};

const activeSubsessions = new Set<string>();

export function isAASMSubsession(sessionID: string): boolean {
  return activeSubsessions.has(sessionID);
}

export class SubsessionHelper {
  private config: SubsessionConfig;

  constructor(
    private client: OpencodeClient,
    config?: Partial<SubsessionConfig>
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  async callLLM(prompt: string, sessionID: string): Promise<string> {
    const sessionBody: any = {
      parentID: sessionID,
      title: 'AASM Lint Analysis',
    };

    if (this.config.model) {
      sessionBody.model = this.config.model;
    }

    const createResult = await this.client.session.create({
      body: sessionBody,
    });

    const subsessionID = createResult.data?.id;
    if (!subsessionID) {
      throw new Error('Failed to create subsession: no session ID returned');
    }

    Logger.debug(`Subsession created: ${subsessionID}`, { parentID: sessionID });

    activeSubsessions.add(subsessionID);

    try {
      Logger.debug(`Sending prompt to subsession ${subsessionID}`);
      await this.client.session.prompt({
        path: { id: subsessionID },
        body: {
          tools: {
            task: false,
            delegate_task: false,
          },
          parts: [{ type: 'text', text: prompt }],
        },
      });

      const response = await this.pollForCompletion(subsessionID);
      Logger.debug(`Received response from subsession ${subsessionID}`, {
        length: response.length,
      });
      return response;
    } finally {
      activeSubsessions.delete(subsessionID);
    }
  }

  private async pollForCompletion(subsessionID: string): Promise<string> {
    const pollStart = Date.now();
    let stablePolls = 0;
    let lastMsgCount = 0;

    Logger.debug(`Starting poll for subsession ${subsessionID}`);

    while (Date.now() - pollStart < this.config.timeout) {
      await new Promise((resolve) => setTimeout(resolve, this.config.pollInterval));

      const statusResult = await this.client.session.status();
      const allStatuses = (statusResult.data ?? {}) as Record<string, { type: string }>;
      const sessionStatus = allStatuses[subsessionID];

      if (sessionStatus && sessionStatus.type !== 'idle') {
        stablePolls = 0;
        lastMsgCount = 0;
        continue;
      }

      const messagesCheck = await this.client.session.messages({
        path: { id: subsessionID },
      });
      const msgs = (messagesCheck.data ?? messagesCheck) as any[];
      const currentMsgCount = msgs.length;

      if (currentMsgCount > 0 && currentMsgCount === lastMsgCount) {
        stablePolls++;
        if (stablePolls >= this.config.stabilityRequired) {
          Logger.debug(`Subsession ${subsessionID} stabilized after ${stablePolls} checks`);
          break;
        }
      } else {
        stablePolls = 0;
        lastMsgCount = currentMsgCount;
      }
    }

    if (Date.now() - pollStart >= this.config.timeout) {
      throw new Error('Subsession timeout: LLM did not respond within 30 seconds');
    }

    const messagesResult = await this.client.session.messages({
      path: { id: subsessionID },
    });
    const messages = (messagesResult.data ?? messagesResult) as any[];

    const assistantMsgs = messages.filter((m) => m.info?.role === 'assistant');
    const responseText = assistantMsgs
      .flatMap((m) => m.parts ?? [])
      .filter((p) => p.type === 'text')
      .map((p) => p.text)
      .join('\n\n');

    return responseText;
  }
}
