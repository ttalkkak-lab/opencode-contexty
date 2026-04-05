/// <reference types="bun-types" />

import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { ACPMModule } from './index';
import type { Preset } from './types';
import { createPermissionAskHook } from '../hooks/permission-ask.acpm';
import { createSystemTransformHook } from '../hooks/system-transform.acpm';
import { createToolExecuteBeforeHook } from '../hooks/tool-execute-before.acpm';

const makePreset = (overrides: Partial<Preset> = {}): Preset => ({
  name: 'test',
  description: 'test preset',
  folderPermissions: [],
  toolPermissions: [],
  defaultPolicy: 'allow-all',
  ...overrides,
});

const createClient = () => ({
  tui: {
    showToast: mock(async () => {}),
  },
});

describe('ACPM integration', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'contexty-acpm-int-'));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('runs the preset lifecycle from create through delete', async () => {
    const module = new ACPMModule(tempDir);
    const created = makePreset({
      name: 'preset-a',
      folderPermissions: [{ path: '/workspace', access: 'read-only' }],
      toolPermissions: [{ category: 'shell', enabled: false }],
    });

    await module.createPreset(created);
    await module.loadPreset('preset-a');

    expect(module.getActivePreset()?.name).toBe('preset-a');
    expect(module.getEvaluator().checkFolderAccess('/workspace/file.txt', 'read')).toEqual({
      allowed: true,
      matchedRule: path.resolve('/workspace'),
    });
    expect(module.getEvaluator().checkFolderAccess('/workspace/file.txt', 'write').allowed).toBe(false);

    const updated = makePreset({
      name: 'preset-a',
      folderPermissions: [{ path: '/workspace', access: 'read-write' }],
      toolPermissions: [{ category: 'shell', enabled: true }],
    });

    await module.updatePreset('preset-a', updated);

    expect(module.getActivePreset()?.folderPermissions[0].access).toBe('read-write');
    expect(module.getEvaluator().checkFolderAccess('/workspace/file.txt', 'write').allowed).toBe(true);

    await module.deletePreset('preset-a');

    expect(await module.listPresets()).toEqual([]);
    expect(module.getActivePreset()).toBeNull();
    expect(module.getEvaluator().checkFolderAccess('/workspace/file.txt', 'write').allowed).toBe(true);
  });

  it('injects restriction text into system transform output', async () => {
    const module = new ACPMModule(tempDir);
    await module.createPreset(
      makePreset({
        name: 'preset-a',
        folderPermissions: [{ path: '/workspace/private', access: 'denied' }],
        toolPermissions: [{ category: 'shell', enabled: false }],
      })
    );
    await module.loadPreset('preset-a');

    const hook = createSystemTransformHook(module);
    const output = { system: ['base prompt'] };

    await hook({ model: {} as any, sessionID: 's1' }, output);

    expect(output.system).toEqual([
      'base prompt',
      '[ACPM] 현재 권한 정책: /workspace/private 폴더 접근 불가. Shell 명령 카테고리 비활성화.',
    ]);
  });

  it('blocks shell execution when the preset disables shell tools', async () => {
    const module = new ACPMModule(tempDir);
    await module.createPreset(makePreset({ name: 'preset-a', toolPermissions: [{ category: 'shell', enabled: false }] }));
    await module.loadPreset('preset-a');

    const client = createClient();
    const hook = createToolExecuteBeforeHook(module, client as any);
    const output: { args: any } = { args: { command: 'ls -la' } };

    await expect(
      hook({ tool: 'bash', sessionID: 's1', callID: 'c1' }, output)
    ).rejects.toThrow('bash is disabled by the active permission preset.');

    expect(client.tui.showToast).toHaveBeenCalledTimes(1);
  });

  it('blocks file writes inside denied folders', async () => {
    const module = new ACPMModule(tempDir);
    await module.createPreset(
      makePreset({
        name: 'preset-a',
        toolPermissions: [{ category: 'file-write', enabled: true }],
        folderPermissions: [{ path: '/workspace/private', access: 'denied' }],
      })
    );
    await module.loadPreset('preset-a');

    const client = createClient();
    const hook = createToolExecuteBeforeHook(module, client as any);
    const output: { args: any } = { args: { file_path: '/workspace/private/secret.txt' } };

    await expect(
      hook({ tool: 'edit', sessionID: 's1', callID: 'c1' }, output)
    ).rejects.toThrow('Denied by folder rule /workspace/private');

    expect(client.tui.showToast).toHaveBeenCalledTimes(1);
  });

  it('returns deny from permission ask when the preset blocks the request', async () => {
    const module = new ACPMModule(tempDir);
    await module.createPreset(
      makePreset({
        name: 'preset-a',
        toolPermissions: [{ category: 'file-write', enabled: true }],
        folderPermissions: [{ path: '/workspace/private', access: 'denied' }],
      })
    );
    await module.loadPreset('preset-a');

    const hook = createPermissionAskHook(module);
    const output: { status: 'ask' | 'deny' | 'allow' } = { status: 'ask' };

    await hook({ tool: 'edit', filePath: '/workspace/private/secret.txt' } as any, output);

    expect(output.status).toBe('deny');
  });

  it('returns ask when no preset is active', async () => {
    const module = new ACPMModule(tempDir);
    const hook = createPermissionAskHook(module);
    const output: { status: 'ask' | 'deny' | 'allow' } = { status: 'deny' };

    await hook({ tool: 'bash' } as any, output);

    expect(output.status).toBe('ask');
  });

  it('falls back to allow-all for malformed permissions json', async () => {
    await fs.mkdir(path.join(tempDir, '.contexty'), { recursive: true });
    await fs.writeFile(path.join(tempDir, '.contexty', 'permissions.json'), '{ broken json', 'utf8');

    const module = new ACPMModule(tempDir);

    expect(await module.listPresets()).toEqual([]);
    expect(module.getActivePreset()).toBeNull();
    expect(module.getEvaluator().checkFolderAccess('/anywhere/file.txt', 'write')).toEqual({ allowed: true });
  });

  it('switches evaluation results when changing active presets', async () => {
    const module = new ACPMModule(tempDir);
    await module.createPreset(
      makePreset({
        name: 'preset-a',
        folderPermissions: [{ path: '/workspace/shared', access: 'denied' }],
      })
    );
    await module.createPreset(
      makePreset({
        name: 'preset-b',
        folderPermissions: [{ path: '/workspace/shared', access: 'read-write' }],
      })
    );

    await module.loadPreset('preset-a');
    expect(module.getEvaluator().checkFolderAccess('/workspace/shared/file.txt', 'write').allowed).toBe(false);

    await module.loadPreset('preset-b');
    expect(module.getActivePreset()?.name).toBe('preset-b');
    expect(module.getEvaluator().checkFolderAccess('/workspace/shared/file.txt', 'write').allowed).toBe(true);
  });
});
