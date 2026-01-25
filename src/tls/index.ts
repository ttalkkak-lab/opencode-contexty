import { Hooks } from '@opencode-ai/plugin';
import type { TLSModule } from './TLSModule';

export function createTLSEventHook(tlsModule: TLSModule): Hooks['event'] {
  return async ({ event }) => {
    await tlsModule.processEvent(event, true);
  };
}

export { TLSModule, type BashResult, type TLSSummaryResult, type TLSConfig } from './TLSModule';
