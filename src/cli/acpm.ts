import path from 'path';
import { PermissionStorage } from '../acpm/storage';
import type { FolderAccess, FolderPermission, Preset, ToolCategory, ToolPermission } from '../acpm/types';
import { prompt as promptInput, promptSelect, promptYesNo } from './prompt.js';

const TOOL_CATEGORIES: ToolCategory[] = ['file-read', 'file-write', 'shell', 'web', 'lsp', 'mcp'];
const FOLDER_ACCESS_OPTIONS: FolderAccess[] = ['denied', 'read-only', 'read-write'];

type PromptDeps = {
  promptInput?: typeof promptInput;
  promptSelect?: typeof promptSelect;
  promptYesNo?: typeof promptYesNo;
};

function normalizePath(input: string): string {
  return input.trim();
}

async function collectFolderPermissions(): Promise<FolderPermission[]> {
  return collectFolderPermissionsWithDeps(promptInput, promptSelect, promptYesNo);
}

async function collectToolPermissions(): Promise<ToolPermission[]> {
  return collectToolPermissionsWithDeps(promptYesNo);
}

export async function runACPMWizard(baseDir: string, deps: PromptDeps = {}): Promise<string | null> {
  const input = deps.promptInput ?? promptInput;
  const select = deps.promptSelect ?? promptSelect;
  const yesNo = deps.promptYesNo ?? promptYesNo;

  const enabled = await yesNo('Enable ACPM permissions?', true);

  if (!enabled) {
    return null;
  }

  const folderPermissions = await collectFolderPermissionsWithDeps(input, select, yesNo);
  const toolPermissions = await collectToolPermissionsWithDeps(yesNo);
  const presetName = normalizePath(await input('Enter a preset name for ACPM: ')) || 'default';

  const preset: Preset = {
    name: presetName,
    folderPermissions,
    toolPermissions,
    defaultPolicy: 'allow-all',
  };

  const storage = new PermissionStorage(baseDir);
  const permissionsFile = await storage.readPresets();
  const presets = permissionsFile.presets.filter((entry) => entry.name !== preset.name);

  presets.push(preset);
  await storage.writePresets({ ...permissionsFile, presets });

  return preset.name;
}

async function collectFolderPermissionsWithDeps(
  input: typeof promptInput,
  select: typeof promptSelect,
  yesNo: typeof promptYesNo
): Promise<FolderPermission[]> {
  const permissions: FolderPermission[] = [];

  while (true) {
    const folderPath = normalizePath(await input('Enter a folder path for ACPM permissions: '));

    if (!folderPath) {
      const addFolder = await yesNo('Folder path is empty. Do you want to try again?', false);
      if (!addFolder) {
        break;
      }
      continue;
    }

    const resolvedPath = path.resolve(folderPath);
    const cwd = process.cwd();
    if (!resolvedPath.startsWith(cwd + path.sep) && resolvedPath !== cwd) {
      const proceed = await yesNo(
        `"${resolvedPath}" is outside the project directory. Continue?`,
        false
      );
      if (!proceed) continue;
    }

    const accessChoice = await select(
      `Select access level for ${resolvedPath}:`,
      FOLDER_ACCESS_OPTIONS,
      1
    );

    permissions.push({ path: resolvedPath, access: accessChoice as FolderAccess });

    const addAnother = await yesNo('Add another folder permission?', false);
    if (!addAnother) {
      break;
    }
  }

  return permissions;
}

async function collectToolPermissionsWithDeps(yesNo: typeof promptYesNo): Promise<ToolPermission[]> {
  const permissions: ToolPermission[] = [];

  for (const category of TOOL_CATEGORIES) {
    const enabled = await yesNo(`Enable the ${category} tool category?`, true);
    permissions.push({ category, enabled });
  }

  return permissions;
}
