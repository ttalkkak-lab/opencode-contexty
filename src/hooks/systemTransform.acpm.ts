import type { ACPMModule } from '../acpm';
import type { FolderAccess, ToolCategory } from '../acpm/types';

type Model = unknown;

type SystemTransformInput = {
  sessionID?: string;
  model: Model;
};

type SystemTransformOutput = {
  system: string[];
};

const TOOL_CATEGORY_LABELS: Record<ToolCategory, string> = {
  'file-read': '파일 읽기',
  'file-write': '파일 쓰기',
  shell: 'Shell 명령',
  web: 'Web',
  lsp: 'LSP',
  mcp: 'MCP',
};

function formatFolderRule(path: string, access: FolderAccess): string | null {
  if (access === 'denied') {
    return `${path} 폴더 접근 불가`;
  }

  if (access === 'read-only') {
    return `${path} 폴더 읽기 전용`;
  }

  return `${path} 폴더 읽기/쓰기 가능`;
}

function formatToolRule(category: ToolCategory, enabled: boolean): string | null {
  if (enabled) {
    return `${TOOL_CATEGORY_LABELS[category]} 카테고리 활성화`;
  }

  return `${TOOL_CATEGORY_LABELS[category]} 카테고리 비활성화`;
}

export function createSystemTransformHook(acpm: ACPMModule) {
  return async (_input: SystemTransformInput, output: SystemTransformOutput): Promise<void> => {
    const preset = acpm.getActivePreset();

    if (!preset) {
      return;
    }

    const rules = [
      ...preset.folderPermissions.map((entry) => formatFolderRule(entry.path, entry.access)),
      ...preset.toolPermissions.map((entry) => formatToolRule(entry.category, entry.enabled)),
    ].filter((rule): rule is string => typeof rule === 'string');

    if (rules.length === 0) {
      return;
    }

    output.system.push(`[ACPM] 현재 권한 정책: ${rules.join('. ')}.`);
  };
}
