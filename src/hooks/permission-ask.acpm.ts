import type { Permission } from '@opencode-ai/sdk';
import type { ACPMModule } from '../acpm';
import { getToolCategory } from '../acpm/toolMapping';
import type { ToolCategory } from '../acpm/types';

type PermissionAskOutput = {
  status: 'ask' | 'deny' | 'allow';
};

const TOOL_NAME_KEYS = ['tool', 'toolName', 'name', 'command'];
const FILE_PATH_KEYS = ['filePath', 'file_path', 'path', 'targetPath', 'target_path'];

function getStringProperty(input: Permission, keys: string[]): string | null {
  const record = input as Record<string, unknown>;

  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim().length > 0) {
      return value;
    }
  }

  return null;
}

function getToolName(input: Permission): string | null {
  return getStringProperty(input, TOOL_NAME_KEYS);
}

function getFilePath(input: Permission): string | null {
  return getStringProperty(input, FILE_PATH_KEYS);
}

function isToolCategoryEnabled(acpm: ACPMModule, category: ToolCategory): boolean {
  const preset = acpm.getActivePreset();
  if (!preset) {
    return false;
  }

  const permission = preset.toolPermissions.find((entry) => entry.category === category);
  return permission?.enabled ?? true;
}

function getFolderOperation(category: ToolCategory | null): 'read' | 'write' {
  return category === 'file-write' ? 'write' : 'read';
}

export function createPermissionAskHook(acpm: ACPMModule) {
  return async (input: Permission, output: PermissionAskOutput): Promise<void> => {
    const preset = acpm.getActivePreset();

    if (!preset) {
      output.status = 'ask';
      return;
    }

    const toolName = getToolName(input);
    const category = toolName ? getToolCategory(toolName) : null;

    if (category && !isToolCategoryEnabled(acpm, category)) {
      output.status = 'deny';
      return;
    }

    const filePath = getFilePath(input);
    if (filePath) {
      const access = acpm.getEvaluator().checkFolderAccess(filePath, getFolderOperation(category));

      if (!access.allowed) {
        output.status = 'deny';
        return;
      }
    }

    output.status = 'allow';
  };
}
