import type { ACPMModule } from '../acpm';
import { getToolCategory } from '../acpm/toolMapping';
import type { ToolCategory } from '../acpm/types';
import { sessionTracker } from '../core/sessionTracker';
import { acpmCounter } from '../metrics/acpmCounter';

type ToolExecuteAfterInput = {
  tool: string;
  sessionID: string;
  callID: string;
  args?: any;
};

type ToolExecuteAfterOutput = {
  title: string;
  output: string;
  metadata: any;
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

function getFilePathForRead(input: ToolExecuteAfterInput): string | null {
  const args = input.args;
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

function getFilePathForWrite(args: any): string | null {
  if (!args || typeof args !== 'object') {
    return null;
  }

  return typeof args.file_path === 'string' ? args.file_path : null;
}

function sanitizeOutput(output: ToolExecuteAfterOutput, reason: string): void {
  output.title = `[ACPM] Access denied`;
  output.output = reason;
  output.metadata = {};
}

export function createToolExecuteAfterHook(acpm: ACPMModule) {
  return async (input: ToolExecuteAfterInput, output: ToolExecuteAfterOutput): Promise<void> => {
    try {
      sessionTracker.setSessionId(input.sessionID);
      const category = getToolCategory(input.tool);

      if (!getToolPermissionEnabled(acpm, category)) {
        acpmCounter.recordSanitize();
        if (category) {
          acpmCounter.recordDeny(category);
        }
        sanitizeOutput(output, `Tool "${input.tool}" is disabled by the active permission preset.`);
        return;
      }

      const evaluator = acpm.getEvaluator();

      if (category && FILE_WRITE_TOOLS.has(category)) {
        const filePath = getFilePathForWrite(input.args);

        if (filePath) {
          const access = evaluator.checkFolderAccess(filePath, 'write');

          if (!access.allowed) {
            acpmCounter.recordSanitize();
            acpmCounter.recordDeny('file-write');
            sanitizeOutput(output, access.reason ?? `Write denied for ${filePath}`);
            return;
          }
        }
      }

      if (category && FILE_READ_TOOLS.has(category)) {
        const filePath = getFilePathForRead(input);

        if (filePath) {
          const access = evaluator.checkFolderAccess(filePath, 'read');

          if (!access.allowed) {
            acpmCounter.recordSanitize();
            acpmCounter.recordDeny('file-read');
            sanitizeOutput(output, access.reason ?? `Read denied for ${filePath}`);
            return;
          }
        }
      }

      acpmCounter.recordAllow();
    } catch {
      sanitizeOutput(output, 'Permission check failed.');
    }
  };
}
