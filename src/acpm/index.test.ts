import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { ACPMModule } from './index';
import type { Preset } from './types';

const createPreset = (name: string, access: 'denied' | 'read-only' | 'read-write' = 'read-only'): Preset => ({
  name,
  description: `${name} preset`,
  folderPermissions: [{ path: '/workspace', access }],
  toolPermissions: [{ category: 'shell', enabled: false }],
  defaultPolicy: 'allow-all',
});

describe('ACPMModule', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'contexty-acpm-'));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('loads a preset and activates evaluator rules', async () => {
    const module = new ACPMModule(tempDir);
    const preset = createPreset('default');
    await module.createPreset(preset);

    await module.loadPreset('default');

    expect(module.getActivePreset()?.name).toBe('default');
    expect(module.getEvaluator().checkFolderAccess('/workspace/file.txt', 'read').allowed).toBe(true);
    expect(module.getEvaluator().checkFolderAccess('/workspace/file.txt', 'write').allowed).toBe(false);
  });

  it('falls back to allow-all when no preset is active', async () => {
    const module = new ACPMModule(tempDir);

    expect(module.getActivePreset()).toBeNull();
    expect(module.getEvaluator().checkFolderAccess('/anywhere', 'read').allowed).toBe(true);
    expect(module.getEvaluator().checkFolderAccess('/anywhere', 'write').allowed).toBe(true);
  });

  it('supports preset CRUD lifecycle', async () => {
    const module = new ACPMModule(tempDir);
    const preset = createPreset('alpha');

    await module.createPreset(preset);
    expect((await module.listPresets()).map((entry) => entry.name)).toEqual(['alpha']);

    const updated = createPreset('beta', 'read-write');
    await module.updatePreset('alpha', updated);
    expect((await module.listPresets()).map((entry) => entry.name)).toEqual(['beta']);
    expect((await module.listPresets())[0].folderPermissions[0].access).toBe('read-write');

    await module.deletePreset('beta');
    expect(await module.listPresets()).toEqual([]);
  });

  it('keeps allow-all when loading a missing preset', async () => {
    const module = new ACPMModule(tempDir);
    await module.loadPreset('missing');

    expect(module.getActivePreset()).toBeNull();
    expect(module.getEvaluator().checkFolderAccess('/workspace', 'write').allowed).toBe(true);
  });

  it('auto-loads the default preset during construction', async () => {
    const storageDir = path.join(tempDir, '.contexty');
    await fs.mkdir(storageDir, { recursive: true });
    await fs.writeFile(
      path.join(storageDir, 'permissions.json'),
      JSON.stringify({ version: 1, presets: [createPreset('default', 'denied')] }, null, 2)
    );

    const module = new ACPMModule(tempDir, 'default');
    await module.listPresets();

    expect(module.getActivePreset()?.name).toBe('default');
    expect(module.getEvaluator().checkFolderAccess('/workspace', 'read').allowed).toBe(false);
  });
});
