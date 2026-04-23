import { Logger as BaseLogger } from '../utils';

export class DCPLogger {
  private prefix = '[DCP]';
  private debugEnabled: boolean;

  constructor(debugEnabled = false) {
    this.debugEnabled = debugEnabled;
  }

  info(message: string, data?: Record<string, unknown>): void {
    BaseLogger.info(`${this.prefix} ${message}`, data);
  }

  debug(message: string, data?: Record<string, unknown>): void {
    if (!this.debugEnabled) return;
    BaseLogger.debug(`${this.prefix} ${message}`, data);
  }

  warn(message: string, data?: Record<string, unknown>): void {
    BaseLogger.warn(`${this.prefix} ${message}`, data);
  }

  error(message: string, data?: Record<string, unknown>): void {
    BaseLogger.error(`${this.prefix} ${message}`, data);
  }
}

export function createLogger(enabled: boolean): DCPLogger {
  return new DCPLogger(enabled);
}
