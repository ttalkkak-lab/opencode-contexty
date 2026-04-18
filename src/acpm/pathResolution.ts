import type { Preset, ToolCategory } from './types';

export const FILE_READ_TOOLS = new Set<ToolCategory>(['file-read']);
export const FILE_WRITE_TOOLS = new Set<ToolCategory>(['file-write']);

export function getToolPermissionEnabled(
  preset: Preset | null,
  category: ToolCategory | null
): boolean {
  if (!category || !preset) {
    return true;
  }

  const permission = preset.toolPermissions.find((entry) => entry.category === category);
  return permission?.enabled ?? true;
}

export function getFilePathForWrite(args: unknown): string | null {
  if (!args || typeof args !== 'object') {
    return null;
  }

  const values = args as { file_path?: unknown; filePath?: unknown; path?: unknown };

  if (typeof values.file_path === 'string') {
    return values.file_path;
  }

  if (typeof values.filePath === 'string') {
    return values.filePath;
  }

  return typeof values.path === 'string' ? values.path : null;
}

export function getFilePathForRead(tool: string, args: unknown): string | null {
  if (!args || typeof args !== 'object') {
    return null;
  }

  const values = args as {
    filePath?: unknown;
    path?: unknown;
    pattern?: unknown;
    include?: unknown;
  };

  if (typeof values.filePath === 'string') {
    return values.filePath;
  }

  if (typeof values.path === 'string') {
    return values.path;
  }

  if (tool === 'glob' && typeof values.pattern === 'string') {
    const dir = values.pattern.replace(/[*{}[\]!]/g, '').replace(/\/+/g, '/').trim();
    return dir.length > 0 ? dir : '.';
  }

  if (tool === 'grep' && typeof values.include === 'string') {
    return values.include;
  }

  return null;
}
