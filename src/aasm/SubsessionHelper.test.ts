import { describe, test, expect, beforeEach, mock } from 'bun:test';
import { SubsessionHelper } from './subsessionHelper';

describe('SubsessionHelper', () => {
  let helper: SubsessionHelper;
  let mockClient: any;
  const mockParentSessionID = 'parent-session-123';
  const mockSubsessionID = 'subsession-456';

  beforeEach(() => {
    mockClient = {
      session: {
        create: mock(() => Promise.resolve({ data: { id: mockSubsessionID } })),
        prompt: mock(() => Promise.resolve()),
        status: mock(() => Promise.resolve({ data: {} })),
        messages: mock(() => Promise.resolve({ data: [] })),
      },
    };
    helper = new SubsessionHelper(mockClient);
  });

  describe('callLLM', () => {
    test('should create subsession with correct params', async () => {
      mockClient.session.status = mock(() =>
        Promise.resolve({ data: { [mockSubsessionID]: { type: 'idle' } } })
      );
      mockClient.session.messages = mock(() =>
        Promise.resolve({
          data: [
            {
              info: { role: 'assistant' },
              parts: [{ type: 'text', text: 'Mock response' }],
            },
          ],
        })
      );

      const prompt = 'Test prompt';
      await helper.callLLM(prompt, mockParentSessionID);

      expect(mockClient.session.create).toHaveBeenCalledTimes(1);
      const createCall = mockClient.session.create.mock.calls[0][0];
      expect(createCall.body.parentID).toBe(mockParentSessionID);
      expect(createCall.body.title).toContain('AASM Lint');
    });

    test('should send prompt with tool restrictions', async () => {
      mockClient.session.status = mock(() =>
        Promise.resolve({ data: { [mockSubsessionID]: { type: 'idle' } } })
      );
      mockClient.session.messages = mock(() =>
        Promise.resolve({
          data: [
            {
              info: { role: 'assistant' },
              parts: [{ type: 'text', text: 'Mock response' }],
            },
          ],
        })
      );

      const prompt = 'Test prompt';
      await helper.callLLM(prompt, mockParentSessionID);

      expect(mockClient.session.prompt).toHaveBeenCalledTimes(1);
      const promptCall = mockClient.session.prompt.mock.calls[0][0];
      expect(promptCall.body.tools).toEqual({
        task: false,
        delegate_task: false,
      });
      expect(promptCall.body.parts[0].text).toBe(prompt);
    });

    test('should poll until stable idle', async () => {
      let pollCount = 0;
      mockClient.session.status = mock(() => {
        pollCount++;
        if (pollCount < 5) {
          return Promise.resolve({ data: { [mockSubsessionID]: { type: 'running' } } });
        }
        return Promise.resolve({ data: { [mockSubsessionID]: { type: 'idle' } } });
      });

      mockClient.session.messages = mock(() =>
        Promise.resolve({
          data: [
            {
              info: { role: 'assistant' },
              parts: [{ type: 'text', text: 'Response after polling' }],
            },
          ],
        })
      );

      const result = await helper.callLLM('Test prompt', mockParentSessionID);

      expect(pollCount).toBeGreaterThanOrEqual(5);
      expect(result).toBe('Response after polling');
    });

    test('should timeout after configured timeout', async () => {
      const shortTimeoutHelper = new SubsessionHelper(mockClient, {
        timeout: 100,
        pollInterval: 10,
        stabilityRequired: 3,
      });

      mockClient.session.status = mock(() =>
        Promise.resolve({ data: { [mockSubsessionID]: { type: 'running' } } })
      );

      const startTime = Date.now();
      await expect(shortTimeoutHelper.callLLM('Test prompt', mockParentSessionID)).rejects.toThrow(
        /timeout/i
      );
      const elapsed = Date.now() - startTime;

      expect(elapsed).toBeGreaterThanOrEqual(90);
      expect(elapsed).toBeLessThan(500);
    });

    test('should throw on session creation failure', async () => {
      mockClient.session.create = mock(() => Promise.reject(new Error('Session creation failed')));

      await expect(helper.callLLM('Test prompt', mockParentSessionID)).rejects.toThrow(
        /Session creation failed/
      );
    });
  });
});
