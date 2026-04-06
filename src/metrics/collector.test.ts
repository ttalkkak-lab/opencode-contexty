/// <reference types="bun-types" />

import { describe, expect, it } from 'bun:test';
import { MetricsCollector } from './collector';

function createCollector() {
  return new MetricsCollector('/tmp');
}

describe('MetricsCollector', () => {
  it('sums assistant token metrics', () => {
    const collector = createCollector();

    const snapshot = collector.collect([
      {
        info: { id: 'm1', role: 'assistant' },
        tokens: { input: 10, output: 20, reasoning: 3, cache: { read: 4, write: 5 } },
        parts: [],
      },
      {
        info: { id: 'm2', role: 'assistant' },
        tokens: { input: 1, output: 2, reasoning: 3, cache: { read: 4, write: 5 } },
        parts: [],
      },
      {
        info: { id: 'm3', role: 'user' },
        tokens: { input: 100, output: 100, reasoning: 100, cache: { read: 100, write: 100 } },
        parts: [],
      },
    ] as any);

    expect(snapshot.tokens).toEqual({
      input: 11,
      output: 22,
      reasoning: 6,
      cacheRead: 8,
      cacheWrite: 10,
    });
  });

  it('deduplicates file metrics by path', () => {
    const collector = createCollector();

    const snapshot = collector.collect([
      {
        info: { id: 'm1', role: 'assistant' },
        parts: [
          { type: 'file', source: { path: 'src/a.ts' }, content: 'abcd' },
        ],
      },
      {
        info: { id: 'm2', role: 'assistant' },
        parts: [
          { type: 'file', source: { path: 'src/a.ts' }, content: 'abcdefgh' },
          { type: 'file', source: { path: 'src/b.ts' }, content: 'abc' },
        ],
      },
    ] as any);

    expect(snapshot.files).toEqual([
      { path: 'src/a.ts', tokenEstimate: 3, role: 'assistant' },
      { path: 'src/b.ts', tokenEstimate: 1, role: 'assistant' },
    ]);
  });

  it('counts completed and error tools', () => {
    const collector = createCollector();

    const snapshot = collector.collect([
      {
        info: { id: 'm1', role: 'assistant' },
        parts: [
          { type: 'tool', tool: 'search', state: { status: 'completed' } },
          { type: 'tool', tool: 'search', state: { status: 'error' } },
          { type: 'tool', tool: 'search', state: { status: 'running' } },
          { type: 'tool', tool: 'lint', state: { status: 'completed' } },
        ],
      },
    ] as any);

    expect(snapshot.tools).toEqual([
      { name: 'search', count: 2, successCount: 1, failCount: 1 },
      { name: 'lint', count: 1, successCount: 1, failCount: 0 },
    ]);
  });

  it('returns empty metrics for empty messages', () => {
    const collector = createCollector();

    const snapshot = collector.collect([]);

    expect(snapshot.tokens).toEqual({
      input: 0,
      output: 0,
      reasoning: 0,
      cacheRead: 0,
      cacheWrite: 0,
    });
    expect(snapshot.files).toEqual([]);
    expect(snapshot.tools).toEqual([]);
    expect(snapshot.acpm).toEqual({
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
