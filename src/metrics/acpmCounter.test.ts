import { describe, expect, it } from 'bun:test';
import { acpmCounter, AcpmCounter, buildAcpmMetrics } from './acpmCounter';
import type { ACPMModule } from '../acpm';
import type { Preset } from '../acpm/types';

function createPreset(): Preset {
  return {
    name: 'default',
    folderPermissions: [
      { path: 'src', access: 'read-write' },
      { path: 'docs', access: 'read-only' },
      { path: 'secret', access: 'denied' },
      { path: 'assets', access: 'read-only' },
    ],
    toolPermissions: [
      { category: 'file-read', enabled: true },
      { category: 'file-write', enabled: false },
      { category: 'shell', enabled: true },
    ],
    defaultPolicy: 'allow-all',
  };
}

describe('AcpmCounter', () => {
  it('counts allow, deny, and sanitize events', () => {
    const counter = new AcpmCounter();

    counter.recordAllow();
    counter.recordAllow();
    counter.recordAllow();
    counter.recordDeny('file-write');
    counter.recordDeny('file-write');
    counter.recordSanitize();

    expect(counter.getCounts()).toEqual({
      allowCount: 3,
      denyCount: 2,
      sanitizeCount: 1,
      deniedByCategory: { 'file-write': 2 },
    });
  });

  it('resets all counters', () => {
    const counter = new AcpmCounter();

    counter.recordAllow();
    counter.recordDeny('shell');
    counter.recordSanitize();
    counter.reset();

    expect(counter.getCounts()).toEqual({
      allowCount: 0,
      denyCount: 0,
      sanitizeCount: 0,
      deniedByCategory: {},
    });
  });
});

describe('buildAcpmMetrics', () => {
  it('builds complete metrics from the active preset', () => {
    const counter = new AcpmCounter();
    counter.recordAllow();
    counter.recordDeny('file-write');
    counter.recordSanitize();

    const preset = createPreset();
    const acpm = {
      getActivePreset: () => preset,
    } as unknown as ACPMModule;

    expect(buildAcpmMetrics(acpm, counter)).toEqual({
      activePreset: 'default',
      allowCount: 1,
      denyCount: 1,
      sanitizeCount: 1,
      deniedByCategory: { 'file-write': 1 },
      folderAccessDistribution: {
        denied: 1,
        'read-only': 2,
        'read-write': 1,
      },
      toolCategoryStatus: [
        { category: 'file-read', enabled: true },
        { category: 'file-write', enabled: false },
        { category: 'shell', enabled: true },
      ],
    });
  });

  it('returns empty preset metrics when no preset is active', () => {
    const acpm = {
      getActivePreset: () => null,
    } as unknown as ACPMModule;

    expect(buildAcpmMetrics(acpm, acpmCounter)).toEqual({
      activePreset: null,
      allowCount: 0,
      denyCount: 0,
      sanitizeCount: 0,
      deniedByCategory: {},
      folderAccessDistribution: {
        denied: 0,
        'read-only': 0,
        'read-write': 0,
      },
      toolCategoryStatus: [],
    });
  });
});
