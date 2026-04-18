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

type ToolExecuteAfterInput = {
  tool: string;
  sessionID: string;
  callID: string;
  args?: unknown;
};

type ToolExecuteAfterOutput = {
  title: string;
  output: string;
  metadata: Record<string, unknown>;
};

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
      const preset = acpm.getActivePreset();

      if (!getToolPermissionEnabled(preset, category)) {
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
        const filePath = getFilePathForRead(input.tool, input.args);

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
