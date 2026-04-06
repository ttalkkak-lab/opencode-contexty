import type { OpencodeClient } from '@opencode-ai/sdk';
import type { ACPMModule } from '../acpm';
import { getToolCategory } from '../acpm/toolMapping';
import type { ToolCategory } from '../acpm/types';
import { sessionTracker } from '../core/sessionTracker';
import { acpmCounter } from '../metrics/acpmCounter';

type ToolExecuteBeforeInput = {
  tool: string;
  sessionID: string;
  callID: string;
};

type ToolExecuteBeforeOutput = {
  args: any;
};

const FILE_READ_TOOLS = new Set<ToolCategory>(['file-read']);
const FILE_WRITE_TOOLS = new Set<ToolCategory>(['file-write']);

function getToolPermissionEnabled(acpm: ACPMModule, category: ToolCategory | null): boolean {
  if (!category) {
    return true;
  }

  const preset = acpm.getActivePreset();
  if (!preset) {
    return true;
  }

  const permission = preset.toolPermissions.find((entry) => entry.category === category);
  return permission?.enabled ?? true;
}

function getFilePathForWrite(args: any): string | null {
  if (!args || typeof args !== 'object') {
    return null;
  }

  if (typeof args.file_path === 'string') {
    return args.file_path;
  }

  if (typeof args.filePath === 'string') {
    return args.filePath;
  }

  if (typeof args.path === 'string') {
    return args.path;
  }

  return null;
}

function getFilePathForRead(input: ToolExecuteBeforeInput, args: any): string | null {
  if (!args || typeof args !== 'object') {
    return null;
  }

  if (typeof args.filePath === 'string') {
    return args.filePath;
  }

  if (typeof args.path === 'string') {
    return args.path;
  }

  if (input.tool === 'glob' && typeof args.pattern === 'string') {
    const dir = args.pattern.replace(/[*{}[\]!]/g, '').replace(/\/+/g, '/').trim();
    return dir.length > 0 ? dir : '.';
  }

  if (input.tool === 'grep') {
    if (typeof args.include === 'string') {
      return args.include;
    }
  }

  return null;
}

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

    if (!getToolPermissionEnabled(acpm, category)) {
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
      const filePath = getFilePathForRead(input, _output.args);

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
