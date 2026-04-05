import { describe, expect, it, mock } from 'bun:test';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { ACPMModule } from '../acpm';
import type { Preset } from '../acpm/types';
import { createToolExecuteBeforeHook } from './tool-execute-before.acpm';

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

describe('createToolExecuteBeforeHook', () => {
  it('blocks disabled tool categories', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'contexty-hook-'));
    const module = new ACPMModule(tempDir);
    await module.createPreset(makePreset({ toolPermissions: [{ category: 'shell', enabled: false }] }));
    await module.loadPreset('test');

    const client = createClient();
    const hook = createToolExecuteBeforeHook(module, client as any);
    const output: { args: any } = { args: { command: 'ls' } };

    await expect(
      hook({ tool: 'bash', sessionID: 's1', callID: 'c1' }, output)
    ).rejects.toThrow('bash is disabled by the active permission preset.');

    expect(client.tui.showToast).toHaveBeenCalledTimes(1);
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('allows enabled tools to pass', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'contexty-hook-'));
    const module = new ACPMModule(tempDir);
    await module.createPreset(makePreset({ toolPermissions: [{ category: 'file-write', enabled: true }] }));
    await module.loadPreset('test');

    const client = createClient();
    const hook = createToolExecuteBeforeHook(module, client as any);
    const output: { args: any } = { args: { file_path: '/workspace/file.txt' } };

    await hook({ tool: 'edit', sessionID: 's1', callID: 'c1' }, output);

    expect(output.args).toEqual({ file_path: '/workspace/file.txt' });
    expect(client.tui.showToast).not.toHaveBeenCalled();
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('blocks denied folders for file write tools', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'contexty-hook-'));
    const module = new ACPMModule(tempDir);
    await module.createPreset(
      makePreset({
        toolPermissions: [{ category: 'file-write', enabled: true }],
        folderPermissions: [{ path: '/workspace/private', access: 'denied' }],
      })
    );
    await module.loadPreset('test');

    const client = createClient();
    const hook = createToolExecuteBeforeHook(module, client as any);
    const output: { args: any } = { args: { file_path: '/workspace/private/secret.txt' } };

    await expect(
      hook({ tool: 'edit', sessionID: 's1', callID: 'c1' }, output)
    ).rejects.toThrow('Denied by folder rule /workspace/private');

    expect(client.tui.showToast).toHaveBeenCalledTimes(1);
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('blocks writes in read-only folders', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'contexty-hook-'));
    const module = new ACPMModule(tempDir);
    await module.createPreset(
      makePreset({
        toolPermissions: [{ category: 'file-write', enabled: true }],
        folderPermissions: [{ path: '/workspace/docs', access: 'read-only' }],
      })
    );
    await module.loadPreset('test');

    const client = createClient();
    const hook = createToolExecuteBeforeHook(module, client as any);
    const output: { args: any } = { args: { file_path: '/workspace/docs/file.txt' } };

    await expect(
      hook({ tool: 'edit', sessionID: 's1', callID: 'c1' }, output)
    ).rejects.toThrow('Write blocked by read-only folder rule /workspace/docs');

    expect(client.tui.showToast).toHaveBeenCalledTimes(1);
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('allows reads in read-only folders', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'contexty-hook-'));
    const module = new ACPMModule(tempDir);
    await module.createPreset(
      makePreset({
        toolPermissions: [{ category: 'file-read', enabled: true }],
        folderPermissions: [{ path: '/workspace/docs', access: 'read-only' }],
      })
    );
    await module.loadPreset('test');

    const client = createClient();
    const hook = createToolExecuteBeforeHook(module, client as any);
    const output: { args: any } = { args: { filePath: '/workspace/docs/file.txt' } };

    await hook({ tool: 'read', sessionID: 's1', callID: 'c1' }, output);

    expect(output.args).toEqual({ filePath: '/workspace/docs/file.txt' });
    expect(client.tui.showToast).not.toHaveBeenCalled();
    await fs.rm(tempDir, { recursive: true, force: true });
  });
});
