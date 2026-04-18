function normalizePath(input: string): string {
  return input.replaceAll('\\', '/');
}

function escapeRegExpChar(ch: string): string {
  return /[\\.^$+{}()|\[\]]/.test(ch) ? `\\${ch}` : ch;
}

function hasGlobChars(value: string): boolean {
  return /[*?]/.test(value);
}

export function matchesGlob(inputPath: string, pattern: string): boolean {
  if (!pattern) return false;

  const normalizedInputPath = normalizePath(inputPath);
  const normalizedPattern = normalizePath(pattern);
  const input = hasGlobChars(normalizedInputPath) && !hasGlobChars(normalizedPattern) ? normalizedPattern : normalizedInputPath;
  const pat = hasGlobChars(normalizedInputPath) && !hasGlobChars(normalizedPattern) ? normalizedInputPath : normalizedPattern;

  let regex = '^';

  for (let i = 0; i < pat.length; i++) {
    const ch = pat[i];

    if (ch === '*') {
      const next = pat[i + 1];
      if (next === '*') {
        const after = pat[i + 2];
        if (after === '/') {
          regex += '(?:.*/)?';
          i += 2;
          continue;
        }

        regex += '.*';
        i++;
        continue;
      }

      regex += '[^/]*';
      continue;
    }

    if (ch === '?') {
      regex += '[^/]';
      continue;
    }

    if (ch === '/') {
      regex += '/';
      continue;
    }

    regex += escapeRegExpChar(ch);
  }

  regex += '$';

  return new RegExp(regex).test(input);
}

export function getFilePathsFromParameters(tool: string, parameters: unknown): string[] {
  if (typeof parameters !== 'object' || parameters === null) {
    return [];
  }

  const paths: string[] = [];
  const params = parameters as Record<string, any>;

  if (tool === 'apply_patch' && typeof params.patchText === 'string') {
    const pathRegex = /\*\*\* (?:Add|Delete|Update) File: ([^\n\r]+)/g;
    let match;
    while ((match = pathRegex.exec(params.patchText)) !== null) {
      paths.push(match[1].trim());
    }
  }

  if (tool === 'multiedit') {
    if (typeof params.filePath === 'string') {
      paths.push(params.filePath);
    }
    if (Array.isArray(params.edits)) {
      for (const edit of params.edits) {
        if (edit && typeof edit.filePath === 'string') {
          paths.push(edit.filePath);
        }
      }
    }
  }

  if (typeof params.filePath === 'string') {
    paths.push(params.filePath);
  }

  return [...new Set(paths)].filter((p) => p.length > 0);
}

export function isFilePathProtected(filePaths: string[], patterns: string[]): boolean {
  if (!filePaths || filePaths.length === 0) return false;
  if (!patterns || patterns.length === 0) return false;

  return filePaths.some((path) => patterns.some((pattern) => matchesGlob(path, pattern)));
}

const GLOB_CHARS = /[*?]/;

export function isToolNameProtected(toolName: string, patterns: string[]): boolean {
  if (!toolName || !patterns || patterns.length === 0) return false;

  const exactPatterns: Set<string> = new Set();
  const globPatterns: string[] = [];

  for (const pattern of patterns) {
    if (GLOB_CHARS.test(pattern)) {
      globPatterns.push(pattern);
    } else {
      exactPatterns.add(pattern);
    }
  }

  if (exactPatterns.has(toolName)) {
    return true;
  }

  return globPatterns.some((pattern) => matchesGlob(toolName, pattern));
}

export const DEFAULT_PROTECTED_TOOLS = [
  'task',
  'skill',
  'todowrite',
  'todoread',
  'compress',
  'batch',
  'plan_enter',
  'plan_exit',
  'write',
  'edit',
];
