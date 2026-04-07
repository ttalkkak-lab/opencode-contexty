import { DEFAULT_PROTECTED_TOOLS } from '../../protected-patterns';
import type { DCPConfig } from '../../types';

function formatList(values: string[]): string {
  return values.map((value) => `\`${value}\``).join(', ');
}

export function buildProtectedToolsExtension(config: DCPConfig): string {
  const tools = [...new Set([...DEFAULT_PROTECTED_TOOLS, ...(config.compress.protectedTools ?? [])])];
  const filePatterns = [...new Set(config.protectedFilePatterns ?? [])].filter(Boolean);

  if (tools.length === 0 && filePatterns.length === 0) {
    return '';
  }

  const sections: string[] = [];

  if (tools.length > 0) {
    sections.push(`Do NOT compress tool outputs from: ${formatList(tools)}.`);
  }

  if (filePatterns.length > 0) {
    sections.push(`Do NOT compress content matching these protected file patterns: ${formatList(filePatterns)}.`);
  }

  return `<dcp-system-reminder>
${sections.join('\n')}
</dcp-system-reminder>`;
}
