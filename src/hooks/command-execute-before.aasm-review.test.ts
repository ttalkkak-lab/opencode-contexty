import { describe, expect, it, mock } from 'bun:test';
import { createAASMReviewCommandHook } from './command-execute-before.aasm-review';

function createOutput() {
  return {
    parts: [{ type: 'text', text: 'existing' }] as any[],
  };
}

describe('createAASMReviewCommandHook', () => {
  it('parses inline aasm-review form when args are inside command string', async () => {
    const aasm = {
      generateAntiPatternReport: mock(async (_sessionID: string, limit: number) => {
        return `inline-report(limit=${limit})`;
      }),
      handleCommand: mock(async () => 'status-ok'),
    };

    const hook = createAASMReviewCommandHook(aasm as any);
    const output = createOutput();

    await hook!(
      { command: '/aasm-review 18', arguments: '', sessionID: 's-inline-cmd' } as any,
      output as any
    );

    expect(aasm.generateAntiPatternReport).toHaveBeenCalledWith('s-inline-cmd', 18);
    expect((output.parts[0] as any).text).toContain('inline-report(limit=18)');
  });

  it('parses inline hub form when args are inside command string', async () => {
    const aasm = {
      generateAntiPatternReport: mock(async (_sessionID: string, limit: number) => {
        return `hub-inline-report(limit=${limit})`;
      }),
      handleCommand: mock(async () => 'status-ok'),
    };

    const hook = createAASMReviewCommandHook(aasm as any);
    const output = createOutput();

    await hook!(
      { command: '/aasm review 26', arguments: '', sessionID: 's-hub-inline' } as any,
      output as any
    );

    expect(aasm.generateAntiPatternReport).toHaveBeenCalledWith('s-hub-inline', 26);
    expect((output.parts[0] as any).text).toContain('hub-inline-report(limit=26)');
  });

  it('injects report output when command is /agent-review', async () => {
    const aasm = {
      generateAntiPatternReport: mock(async (_sessionID: string, limit: number) => {
        return `review-report(limit=${limit})`;
      }),
      handleCommand: mock(async () => 'status-ok'),
    };

    const hook = createAASMReviewCommandHook(aasm as any);
    const output = createOutput();

    await hook!(
      { command: 'agent-review', arguments: '12', sessionID: 's-review' } as any,
      output as any
    );

    expect(aasm.generateAntiPatternReport).not.toHaveBeenCalled();
    expect(output.parts).toEqual([{ type: 'text', text: 'existing' }]);
  });

  it('injects report output when command is /aasm review', async () => {
    const aasm = {
      generateAntiPatternReport: mock(async (_sessionID: string, limit: number) => {
        return `report(limit=${limit})`;
      }),
      handleCommand: mock(async () => 'status-ok'),
    };

    const hook = createAASMReviewCommandHook(aasm as any);
    const output = createOutput();

    await hook!({ command: 'aasm', arguments: 'review 35', sessionID: 's1' } as any, output as any);

    expect(aasm.generateAntiPatternReport).toHaveBeenCalledTimes(1);
    expect(aasm.generateAntiPatternReport).toHaveBeenCalledWith('s1', 35);
    expect(output.parts).toHaveLength(1);
    expect((output.parts[0] as any).id).toBe('aasm-command-part');
    expect((output.parts[0] as any).text).toContain('report(limit=35)');
  });

  it('clamps invalid review limit to default range', async () => {
    const aasm = {
      generateAntiPatternReport: mock(async (_sessionID: string, limit: number) => {
        return `report(limit=${limit})`;
      }),
      handleCommand: mock(async () => 'status-ok'),
    };

    const hook = createAASMReviewCommandHook(aasm as any);
    const output = createOutput();

    await hook!(
      { command: '/aasm', arguments: 'review abc', sessionID: 's2' } as any,
      output as any
    );

    expect(aasm.generateAntiPatternReport).toHaveBeenCalledWith('s2', 20);
    expect((output.parts[0] as any).text).toContain('report(limit=20)');
  });

  it('returns status when command is /aasm without args', async () => {
    const aasm = {
      generateAntiPatternReport: mock(async (_sessionID: string, limit: number) => {
        return `report(limit=${limit})`;
      }),
      handleCommand: mock(async (command: string) => `handled:${command}`),
    };

    const hook = createAASMReviewCommandHook(aasm as any);
    const output = createOutput();

    await hook!({ command: 'aasm', arguments: '', sessionID: 's-status' } as any, output as any);

    expect(aasm.handleCommand).toHaveBeenCalledWith('status');
    expect((output.parts[0] as any).text).toContain('handled:status');
  });

  it('ignores unrelated commands', async () => {
    const aasm = {
      generateAntiPatternReport: mock(async () => 'report'),
      handleCommand: mock(async () => 'status-ok'),
    };

    const hook = createAASMReviewCommandHook(aasm as any);
    const output = createOutput();

    await hook!({ command: 'tls', arguments: '', sessionID: 's3' } as any, output as any);

    expect(aasm.generateAntiPatternReport).not.toHaveBeenCalled();
    expect(output.parts).toEqual([{ type: 'text', text: 'existing' }]);
  });
});
