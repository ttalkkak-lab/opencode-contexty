export type FolderAccess = 'denied' | 'read-only' | 'read-write';

export type ToolCategory = 'file-read' | 'file-write' | 'shell' | 'web' | 'lsp' | 'mcp';

export interface FolderPermission {
  path: string;
  access: FolderAccess;
}

export interface ToolPermission {
  category: ToolCategory;
  enabled: boolean;
}

export interface Preset {
  name: string;
  description?: string;
  folderPermissions: FolderPermission[];
  toolPermissions: ToolPermission[];
  defaultPolicy: 'allow-all';
}

export interface PermissionsFile {
  version: number;
  presets: Preset[];
}

export interface PermissionCheckResult {
  allowed: boolean;
  reason?: string;
  matchedRule?: string;
}

const folderAccessValues: FolderAccess[] = ['denied', 'read-only', 'read-write'];
const toolCategoryValues: ToolCategory[] = ['file-read', 'file-write', 'shell', 'web', 'lsp', 'mcp'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isFolderPermission(value: unknown): value is FolderPermission {
  return (
    isRecord(value) &&
    typeof value.path === 'string' &&
    folderAccessValues.includes(value.access as FolderAccess)
  );
}

function isToolPermission(value: unknown): value is ToolPermission {
  return (
    isRecord(value) &&
    toolCategoryValues.includes(value.category as ToolCategory) &&
    typeof value.enabled === 'boolean'
  );
}

export function isValidPreset(preset: unknown): preset is Preset {
  return (
    isRecord(preset) &&
    typeof preset.name === 'string' &&
    (preset.description === undefined || typeof preset.description === 'string') &&
    Array.isArray(preset.folderPermissions) &&
    preset.folderPermissions.every(isFolderPermission) &&
    Array.isArray(preset.toolPermissions) &&
    preset.toolPermissions.every(isToolPermission) &&
    preset.defaultPolicy === 'allow-all'
  );
}

export function isValidPermissionsFile(data: unknown): data is PermissionsFile {
  return (
    isRecord(data) &&
    typeof data.version === 'number' &&
    Array.isArray(data.presets) &&
    data.presets.every(isValidPreset)
  );
}
