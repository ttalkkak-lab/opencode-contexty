import { describe, expect, it, mock } from 'bun:test';
import type { ACPMModule } from '../acpm';
import type { Preset } from '../acpm/types';
import { createPermissionAskHook } from './permission-ask.acpm';

const makePreset = (overrides: Partial<Preset> = {}): Preset => ({
  name: 'test',
  description: 'test preset',
  folderPermissions: [],
  toolPermissions: [],
  defaultPolicy: 'allow-all',
  ...overrides,
});

const createModule = (preset: Preset | null, accessAllowed = true) => {
  const evaluator = {
    checkFolderAccess: mock(() => ({ allowed: accessAllowed })),
  };

  return {
    getActivePreset: mock(() => preset),
    getEvaluator: mock(() => evaluator),
  } as unknown as ACPMModule;
};

describe('createPermissionAskHook', () => {
  it('returns deny when ACPM denies the tool category', async () => {
    const module = createModule(makePreset({ toolPermissions: [{ category: 'shell', enabled: false }] }));
    const hook = createPermissionAskHook(module);
    const output: { status: 'ask' | 'deny' | 'allow' } = { status: 'ask' };

    await hook({ tool: 'bash' } as any, output);

    expect(output.status).toBe('deny');
  });

  it('returns allow when ACPM allows the tool category and folder access', async () => {
    const module = createModule(makePreset({ toolPermissions: [{ category: 'shell', enabled: true }] }));
    const hook = createPermissionAskHook(module);
    const output: { status: 'ask' | 'deny' | 'allow' } = { status: 'ask' };

    await hook({ tool: 'bash' } as any, output);

    expect(output.status).toBe('allow');
  });

  it('returns ask when ACPM preset is missing', async () => {
    const module = createModule(null);
    const hook = createPermissionAskHook(module);
    const output: { status: 'ask' | 'deny' | 'allow' } = { status: 'deny' };

    await hook({ tool: 'bash' } as any, output);

    expect(output.status).toBe('ask');
  });

  it('returns deny when folder access is denied', async () => {
    const module = createModule(
      makePreset({
        toolPermissions: [{ category: 'file-write', enabled: true }],
        folderPermissions: [{ path: '/workspace/private', access: 'denied' }],
      }),
      false
    );
    const hook = createPermissionAskHook(module);
    const output: { status: 'ask' | 'deny' | 'allow' } = { status: 'ask' };

    await hook({ tool: 'edit', filePath: '/workspace/private/secret.txt' } as any, output);

    expect(output.status).toBe('deny');
  });
});
