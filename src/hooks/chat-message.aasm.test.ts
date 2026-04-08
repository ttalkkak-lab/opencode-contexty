import { describe, expect, it, mock } from 'bun:test';
import { createAASMChatHook } from './chat-message.aasm';

function createClient() {
  return {
    session: {
      list: mock(async () => ({ data: [] })),
      messages: mock(async () => ({ data: [] })),
      revert: mock(async () => ({ data: true })),
    },
    tui: {
      showToast: mock(async () => true),
      appendPrompt: mock(async () => true),
    },
  };
}

function createActiveAasm(validateIntent: (prompt: string, sessionID: string) => Promise<any>) {
  return {
    getMode: () => 'active',
    getModelName: () => 'test-model',
    validateIntent: mock(validateIntent),
  };
}

function createOutput(text: string) {
  return {
    message: {} as any,
    parts: [{ type: 'text', text }] as any,
  };
}

describe('createAASMChatHook', () => {
  it('does not intercept inline /agent-review command', async () => {
    const aasm = {
        getMode: () => 'active',
      getModelName: () => 'test-model',
      validateIntent: mock(async () => ({
        approved: true,
        intent: { intentType: 'feature', architecturalImpact: 'medium' },
        lintResult: {
          valid: true,
          severity: 'advisory',
          issues: [],
          suggestions: [],
          confidence: 1,
        },
      })),
      generateAntiPatternReport: mock(async (_sessionID: string, limit: number) => {
        return `# report limit=${limit}`;
      }),
    };

    const client = createClient();
    const hook = createAASMChatHook(aasm as any, client as any, '/tmp');
    const output = createOutput('/agent-review 33');

    await hook({ sessionID: 's-review', messageID: 'm-review' } as any, output as any);

    expect(aasm.generateAntiPatternReport).not.toHaveBeenCalled();
    expect(output.parts).toEqual([{ type: 'text', text: '/agent-review 33' }]);
  });

  it('intercepts inline /aasm review parser form and returns report immediately', async () => {
    const aasm = {
        getMode: () => 'active',
      getModelName: () => 'test-model',
      validateIntent: mock(async () => ({
        approved: true,
        intent: { intentType: 'feature', architecturalImpact: 'medium' },
        lintResult: {
          valid: true,
          severity: 'advisory',
          issues: [],
          suggestions: [],
          confidence: 1,
        },
      })),
      generateAntiPatternReport: mock(async (_sessionID: string, limit: number) => {
        return `# report split limit=${limit}`;
      }),
    };

    const client = createClient();
    const hook = createAASMChatHook(aasm as any, client as any, '/tmp');
    const output = createOutput('/aasm review 44');

    await hook({ sessionID: 's-review-split', messageID: 'm-review-split' } as any, output as any);

    expect(aasm.generateAntiPatternReport).toHaveBeenCalledWith('s-review-split', 44);
    expect(aasm.validateIntent).not.toHaveBeenCalled();
    expect(output.parts).toHaveLength(1);
    expect((output.parts[0] as any).id).toBe('aasm-review-inline-part');
    expect((output.parts[0] as any).text).toContain('# report split limit=44');
  });

  it('intercepts inline /aasm status command and handles mode immediately', async () => {
    const aasm = {
        getMode: () => 'active',
      getModelName: () => 'test-model',
      validateIntent: mock(async () => ({
        approved: true,
        intent: { intentType: 'feature', architecturalImpact: 'medium' },
        lintResult: {
          valid: true,
          severity: 'advisory',
          issues: [],
          suggestions: [],
          confidence: 1,
        },
      })),
      generateAntiPatternReport: mock(async () => '# report'),
      handleCommand: mock(async (mode: string) => `mode:${mode}`),
    };

    const client = createClient();
    const hook = createAASMChatHook(aasm as any, client as any, '/tmp');
    const output = createOutput('/aasm status');

    await hook({ sessionID: 's-aasm-inline', messageID: 'm-aasm-inline' } as any, output as any);

    expect(aasm.handleCommand).toHaveBeenCalledWith('status');
    expect(aasm.validateIntent).not.toHaveBeenCalled();
    expect((output.parts[0] as any).id).toBe('aasm-mode-inline-part');
    expect((output.parts[0] as any).text).toContain('mode:status');
  });

  it('ignores legacy injected decision helper prompt text', async () => {
    const aasm = {
        getMode: () => 'active',
      getModelName: () => 'test-model',
      validateIntent: mock(async () => ({
        approved: true,
        intent: { intentType: 'feature', architecturalImpact: 'medium' },
        lintResult: {
          valid: true,
          severity: 'advisory',
          issues: [],
          suggestions: [],
          confidence: 1,
        },
      })),
    };

    const client = createClient();
    const hook = createAASMChatHook(aasm as any, client as any, '/tmp');
    const output = createOutput(
      'AASM 검토 결과가 있습니다. 유지 또는 되돌리기 중 하나를 입력해 주세요. (유지/되돌리기)'
    );

    await hook({ sessionID: 's-legacy', messageID: 'm-legacy' } as any, output as any);

    expect(aasm.validateIntent).not.toHaveBeenCalled();
    expect((output.parts[0] as any).id).toBe('aasm-legacy-prompt-part');
    expect((output.parts[0] as any).text).toContain('무시되었습니다');
  });

  it('returns immediately while background analysis is running', async () => {
    let resolveValidate!: (value: any) => void;
    const delayedValidation = new Promise<any>((resolve) => {
      resolveValidate = resolve;
    });

    const aasm = createActiveAasm(async () => delayedValidation);
    const client = createClient();
    const hook = createAASMChatHook(aasm as any, client as any, '/tmp');
    const output = createOutput('새 기능 구현해줘');

    const raceResult = await Promise.race([
      hook({ sessionID: 's1' } as any, output as any).then(() => 'done'),
      new Promise((resolve) => setTimeout(() => resolve('timeout'), 30)),
    ]);

    expect(raceResult).toBe('done');
    expect(aasm.validateIntent).toHaveBeenCalledTimes(1);
    expect(output.parts).toEqual([{ type: 'text', text: '새 기능 구현해줘' }]);

    resolveValidate({
      approved: true,
      intent: { intentType: 'feature', architecturalImpact: 'medium' },
      lintResult: {
        valid: true,
        severity: 'advisory',
        issues: [],
        suggestions: [],
        confidence: 1,
      },
    });
  });

  it('only publishes toast feedback from the latest background analysis', async () => {
    let resolveFirst!: (value: any) => void;
    let resolveSecond!: (value: any) => void;

    const firstValidation = new Promise<any>((resolve) => {
      resolveFirst = resolve;
    });
    const secondValidation = new Promise<any>((resolve) => {
      resolveSecond = resolve;
    });

    const validateIntent = mock(() => firstValidation)
      .mockImplementationOnce(() => firstValidation)
      .mockImplementationOnce(() => secondValidation);

    const aasm = {
        getMode: () => 'active',
      getModelName: () => 'test-model',
      validateIntent,
    };

    const client = createClient();
    const hook = createAASMChatHook(aasm as any, client as any, '/tmp');

    await hook({ sessionID: 's2' } as any, createOutput('첫 요청') as any);
    await hook({ sessionID: 's2' } as any, createOutput('두번째 요청') as any);

    resolveSecond({
      approved: true,
      intent: { intentType: 'feature', architecturalImpact: 'medium' },
      lintResult: {
        valid: false,
        severity: 'warning',
        issues: [{ message: 'Monolithic file detected', fix: 'Split module' }],
        suggestions: [],
        confidence: 0.9,
      },
    });

    await new Promise((resolve) => setTimeout(resolve, 0));

    resolveFirst({
      approved: true,
      intent: { intentType: 'feature', architecturalImpact: 'medium' },
      lintResult: {
        valid: false,
        severity: 'warning',
        issues: [{ message: 'Old stale issue', fix: 'Ignore' }],
        suggestions: [],
        confidence: 0.9,
      },
    });

    await new Promise((resolve) => setTimeout(resolve, 0));

    const showToastMock = client.tui.showToast as any;
    const toastMessages = showToastMock.mock.calls.map(
      (call: any[]) => call[0]?.body?.message ?? ''
    );
    const issueToastCall = showToastMock.mock.calls.find(
      (call: any[]) => call[0]?.body?.title === '⚠️ AASM WARNING'
    );

    expect(issueToastCall?.[0]?.body?.duration).toBe(12000);
    expect(
      toastMessages.some((message: string) => message.includes('Monolithic file detected'))
    ).toBe(true);
    expect(toastMessages.some((message: string) => message.includes('Old stale issue'))).toBe(
      false
    );
    expect(client.tui.appendPrompt).not.toHaveBeenCalled();
  });

  it('does not block next prompt while keep/revert is pending', async () => {
    const aasm = {
        getMode: () => 'active',
      getModelName: () => 'test-model',
      validateIntent: mock(async () => ({
        approved: true,
        intent: { intentType: 'feature', architecturalImpact: 'medium' },
        lintResult: {
          valid: false,
          severity: 'warning',
          issues: [{ message: 'Monolithic file detected', fix: 'Split module' }],
          suggestions: [],
          confidence: 0.9,
        },
      })),
    };

    const client = createClient();
    const hook = createAASMChatHook(aasm as any, client as any, '/tmp');

    await hook(
      { sessionID: 's-pending', messageID: 'u-1' } as any,
      createOutput('기능 추가') as any
    );
    await new Promise((resolve) => setTimeout(resolve, 0));

    const secondOutput = createOutput('다음 작업 진행해줘');
    await hook({ sessionID: 's-pending', messageID: 'u-2' } as any, secondOutput as any);

    expect(secondOutput.parts).toEqual([{ type: 'text', text: '다음 작업 진행해줘' }]);
    expect(aasm.validateIntent).toHaveBeenCalledTimes(2);
  });

  it('reverts generated assistant message when user selects 되돌리기', async () => {
    const aasm = {
        getMode: () => 'active',
      getModelName: () => 'test-model',
      validateIntent: mock(async () => ({
        approved: true,
        intent: { intentType: 'feature', architecturalImpact: 'medium' },
        lintResult: {
          valid: false,
          severity: 'warning',
          issues: [{ message: 'Monolithic file detected', fix: 'Split module' }],
          suggestions: [],
          confidence: 0.9,
        },
      })),
    };

    const client = createClient();
    (client.session.messages as any).mockImplementation(async () => ({
      data: [{ info: { id: 'u-1', role: 'user' } }, { info: { id: 'a-1', role: 'assistant' } }],
    }));

    const hook = createAASMChatHook(aasm as any, client as any, '/tmp');

    await hook(
      { sessionID: 's-revert', messageID: 'u-1' } as any,
      createOutput('기능 추가') as any
    );
    await new Promise((resolve) => setTimeout(resolve, 0));

    const decisionOutput = createOutput('되돌리기');
    await hook({ sessionID: 's-revert', messageID: 'u-2' } as any, decisionOutput as any);

    expect(client.session.revert).toHaveBeenCalledWith({
      path: { id: 's-revert' },
      body: { messageID: 'a-1' },
    });
    expect((decisionOutput.parts[0] as any).text).toContain('되돌렸습니다');
  });
});
