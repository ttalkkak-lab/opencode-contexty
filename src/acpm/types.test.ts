/// <reference types="bun-types" />

import { describe, expect, test } from 'bun:test';
import { isValidPermissionsFile, isValidPreset } from './types';

describe('ACPM types', () => {
  test('accepts a valid preset', () => {
    const preset = {
      name: 'default',
      description: 'Standard access profile',
      folderPermissions: [{ path: '/workspace', access: 'read-write' }],
      toolPermissions: [{ category: 'shell', enabled: true }],
      defaultPolicy: 'allow-all',
    };

    expect(isValidPreset(preset)).toBe(true);
  });

  test('rejects an invalid preset', () => {
    expect(
      isValidPreset({
        name: 'broken',
        folderPermissions: [{ path: '/workspace', access: 'full-access' }],
        toolPermissions: [{ category: 'shell', enabled: 'yes' }],
        defaultPolicy: 'allow-all',
      })
    ).toBe(false);
  });

  test('accepts a valid permissions file', () => {
    const data = {
      version: 1,
      presets: [
        {
          name: 'default',
          folderPermissions: [{ path: '/workspace', access: 'read-only' }],
          toolPermissions: [{ category: 'mcp', enabled: false }],
          defaultPolicy: 'allow-all',
        },
      ],
    };

    expect(isValidPermissionsFile(data)).toBe(true);
  });

  test('rejects an invalid permissions file', () => {
    expect(
      isValidPermissionsFile({
        version: '1',
        presets: [
          {
            name: 'default',
            folderPermissions: [{ path: '/workspace', access: 'read-only' }],
            toolPermissions: [{ category: 'mcp', enabled: false }],
            defaultPolicy: 'allow-all',
          },
        ],
      })
    ).toBe(false);
  });
});
