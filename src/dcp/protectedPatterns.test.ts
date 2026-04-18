/// <reference types="bun-types" />

import { describe, expect, test } from 'bun:test';
import {
  DEFAULT_PROTECTED_TOOLS,
  getFilePathsFromParameters,
  isFilePathProtected,
  isToolNameProtected,
  matchesGlob,
} from './protectedPatterns';

describe('protectedPatterns', () => {
  test('checks protected tool names', () => {
    expect(isToolNameProtected('task', DEFAULT_PROTECTED_TOOLS)).toBe(true);
    expect(isToolNameProtected('read_file', DEFAULT_PROTECTED_TOOLS)).toBe(false);
    expect(isToolNameProtected('compress', DEFAULT_PROTECTED_TOOLS)).toBe(true);
  });

  test('matches glob patterns', () => {
    expect(matchesGlob('src/index.ts', 'src/**/*.ts')).toBe(true);
    expect(matchesGlob('package.json', '*.json')).toBe(true);
    expect(matchesGlob('README.md', 'src/**/*.ts')).toBe(false);
    expect(matchesGlob('src/foo/bar.test.ts', '**/*.test.ts')).toBe(true);
    expect(matchesGlob('anything', '')).toBe(false);
  });

  test('checks protected file paths', () => {
    expect(isFilePathProtected(['src/index.ts'], ['src/**/*.ts'])).toBe(true);
    expect(isFilePathProtected(['README.md'], ['src/**/*.ts'])).toBe(false);
    expect(isFilePathProtected([], ['src/**/*.ts'])).toBe(false);
  });

  test('extracts file paths from parameters', () => {
    expect(getFilePathsFromParameters('read', { filePath: 'src/a.ts' })).toEqual(['src/a.ts']);
  });
});
