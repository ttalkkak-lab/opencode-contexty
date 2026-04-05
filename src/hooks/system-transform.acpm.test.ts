import { describe, expect, it, mock } from 'bun:test';
import type { ACPMModule } from '../acpm';
import type { Preset } from '../acpm/types';
import { createSystemTransformHook } from './system-transform.acpm';

const makePreset = (overrides: Partial<Preset> = {}): Preset => ({
  name: 'test',
  description: 'test preset',
  folderPermissions: [],
  toolPermissions: [],
  defaultPolicy: 'allow-all',
  ...overrides,
});

const createModule = (preset: Preset | null) => ({
  getActivePreset: mock(() => preset),
} as unknown as ACPMModule);

describe('createSystemTransformHook', () => {
  it('appends active preset restrictions to system messages', async () => {
    const module = createModule(
      makePreset({
        folderPermissions: [
          { path: 'src/core/', access: 'denied' },
          { path: 'secrets/', access: 'read-only' },
        ],
        toolPermissions: [{ category: 'shell', enabled: false }],
      })
    );
    const hook = createSystemTransformHook(module);
    const output = { system: ['base prompt'] };

    await hook({ model: {} as any, sessionID: 's1' }, output);

    expect(output.system).toEqual([
      'base prompt',
      '[ACPM] 현재 권한 정책: src/core/ 폴더 접근 불가. secrets/ 폴더 읽기 전용. Shell 명령 카테고리 비활성화.',
    ]);
  });

  it('does not change system messages when preset is missing', async () => {
    const module = createModule(null);
    const hook = createSystemTransformHook(module);
    const output = { system: ['base prompt'] };

    await hook({ model: {} as any }, output);

    expect(output.system).toEqual(['base prompt']);
  });
});
