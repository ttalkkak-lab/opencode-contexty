import { tool } from '@opencode-ai/plugin';
import type { OpencodeClient } from '@opencode-ai/sdk';
import type { TLSModule } from '../tls';

export function createTLSTool(
  tlsModule: TLSModule,
  client: OpencodeClient
): ReturnType<typeof tool> {
  console.log('[TLS Tool] Creating TLS tool...');
  return tool({
    // @ts-ignore
    name: 'tls',
    description: 'TLS Shell - Open a terminal with automatic log summarization powered by Ollama',
    args: {
      command: tool.schema
        .string()
        .optional()
        .describe('Optional command to run immediately in TLS Shell'),
    },
    async execute(args) {
      console.log('[TLS Tool] execute() called with args:', args);

      try {
        const TLS_SHELL_TITLE = '🔍🤖 TLS SHELL (Auto-Summary Mode) 🔍🤖';
        const commandAfterPrefix = args.command?.trim() || '';

        console.log('[TLS Tool] Opening TLS Shell...');
        console.log('[TLS Tool] Command:', commandAfterPrefix);
        console.log('[TLS Tool] Current working directory:', process.cwd());

        await client.tui.showToast({
          body: {
            title: TLS_SHELL_TITLE,
            message: '터미널을 여는 중...',
            variant: 'info',
            duration: 1500,
          },
        });

        const shellCommand = process.env.SHELL || '/bin/zsh';
        console.log('[TLS Tool] Using shell:', shellCommand);

        // TLS Shell 배너 스크립트
        const tlsBanner = `
echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║                                                            ║"
echo "║      🔍 TLS SHELL - Terminal Log Summarization 🔍         ║"
echo "║                                                            ║"
echo "║  ✅ Auto-Summary Mode ACTIVE                              ║"
echo "║  📊 All commands will be automatically summarized         ║"
echo "║  🤖 Powered by Ollama                                     ║"
echo "║                                                            ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
`;

        const initCommand = commandAfterPrefix
          ? `${tlsBanner}; ${commandAfterPrefix}; exec ${shellCommand}`
          : `${tlsBanner}; exec ${shellCommand}`;

        console.log('[TLS Tool] Init command length:', initCommand.length);

        console.log('[TLS Tool] Requesting PTY creation...');
        const ptyResult = await client.pty.create({
          body: {
            title: TLS_SHELL_TITLE,
            command: shellCommand,
            args: ['-c', initCommand],
            cwd: process.cwd(),
          },
        });
        console.log('[TLS Tool] PTY creation result:', JSON.stringify(ptyResult));

        if (ptyResult.data) {
          const ptyId = ptyResult.data.id;
          console.log('[TLS Tool] PTY created with ID:', ptyId);

          // TLS 추적 활성화
          tlsModule.addTLSPtySession(ptyId);
          console.log('[TLS Tool] Added PTY to TLS tracking');

          // PTY 연결
          console.log('[TLS Tool] Connecting to PTY...');
          await client.pty.connect({
            path: { id: ptyId },
          });
          console.log('[TLS Tool] Connected to PTY');

          const displayMessage = commandAfterPrefix
            ? `🔍 TLS 모드로 실행: ${commandAfterPrefix}\n\n✅ TLS Shell 활성화됨\n📊 명령어 자동 감지 ON\n🤖 Ollama 요약 준비 완료`
            : '🔍 TLS Shell이 열렸습니다!\n\n✅ TLS 모드 활성화됨\n📊 명령어 자동 감지 중...\n🤖 Ollama 요약 대기 중\n\n💡 Tip: 명령어를 입력하면 자동으로 요약이 표시됩니다.';

          await client.tui.showToast({
            body: {
              title: TLS_SHELL_TITLE,
              message: displayMessage,
              variant: 'success',
              duration: 5000,
            },
          });

          // TLS 활성화 상태를 지속적으로 표시 (긴 duration)
          await client.tui.showToast({
            body: {
              title: '✅ TLS 모드 활성',
              message: `터미널 ID: ${ptyId.substring(0, 8)}...\n모든 명령어가 자동으로 요약됩니다.`,
              variant: 'info',
              duration: 10000,
            },
          });

          return JSON.stringify({
            success: true,
            message: 'TLS Shell opened successfully',
            ptyId: ptyId,
          });
        } else {
          console.error('[TLS Tool] Failed to create PTY. Result data is null.');
          return JSON.stringify({
            success: false,
            error: 'Failed to create PTY',
          });
        }
      } catch (error) {
        console.error('[TLS Tool] Error executing tool:', error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        await client.tui.showToast({
          body: {
            title: '🔍 TLS Shell',
            message: `터미널 열기 실패: ${errorMessage}`,
            variant: 'error',
            duration: 5000,
          },
        });

        return JSON.stringify({
          success: false,
          error: errorMessage,
        });
      }
    },
  });
}
