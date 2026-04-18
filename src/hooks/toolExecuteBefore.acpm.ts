import type { OpencodeClient } from '@opencode-ai/sdk';
import type { ACPMModule } from '../acpm';
import {
  FILE_READ_TOOLS,
  FILE_WRITE_TOOLS,
  getFilePathForRead,
  getFilePathForWrite,
  getToolPermissionEnabled,
} from '../acpm/pathResolution';
import { getToolCategory } from '../acpm/toolMapping';
import { sessionTracker } from '../core/sessionTracker';
import { acpmCounter } from '../metrics/acpmCounter';

type ToolExecuteBeforeInput = {
  tool: string;
  sessionID: string;
  callID: string;
};

type ToolExecuteBeforeOutput = {
  args: unknown;
};

class ACPMBlockedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ACPMBlockedError';
  }
}

async function showBlockedToast(client: OpencodeClient, title: string, message: string): Promise<void> {
  await client.tui.showToast({
    body: {
      title,
      message,
      variant: 'error',
      duration: 4000,
    },
  });
}

export function createToolExecuteBeforeHook(acpm: ACPMModule, client: OpencodeClient) {
  return async (input: ToolExecuteBeforeInput, _output: ToolExecuteBeforeOutput): Promise<void> => {
    sessionTracker.setSessionId(input.sessionID);
    const category = getToolCategory(input.tool);
    const preset = acpm.getActivePreset();

    if (!getToolPermissionEnabled(preset, category)) {
      await showBlockedToast(
        client,
        '🚫 Tool blocked',
        `${input.tool} is disabled by the active permission preset.`
      );
      if (category) {
        acpmCounter.recordDeny(category);
      }
      throw new ACPMBlockedError(`${input.tool} is disabled by the active permission preset.`);
    }

    const evaluator = acpm.getEvaluator();

    if (category && FILE_WRITE_TOOLS.has(category)) {
      const filePath = getFilePathForWrite(_output.args);

      if (filePath) {
        const access = evaluator.checkFolderAccess(filePath, 'write');

        if (!access.allowed) {
          await showBlockedToast(client, '🚫 Write blocked', access.reason ?? `Write denied for ${filePath}`);
          acpmCounter.recordDeny('file-write');
          throw new ACPMBlockedError(access.reason ?? `Write denied for ${filePath}`);
        }
      }
    }

    if (category && FILE_READ_TOOLS.has(category)) {
      const filePath = getFilePathForRead(input.tool, _output.args);

      if (filePath) {
        const access = evaluator.checkFolderAccess(filePath, 'read');

        if (!access.allowed) {
          await showBlockedToast(client, '🚫 Read blocked', access.reason ?? `Read denied for ${filePath}`);
          acpmCounter.recordDeny('file-read');
          throw new ACPMBlockedError(access.reason ?? `Read denied for ${filePath}`);
        }
      }
    }

    acpmCounter.recordAllow();
  };
}
