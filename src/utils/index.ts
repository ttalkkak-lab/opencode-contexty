import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import type { OpencodeClient } from '@opencode-ai/sdk';

/**
 * File system utilities
 */

export class FileSystem {
  /**
   * Ensure directory exists, create if not
   */
  static async ensureDir(dirPath: string): Promise<void> {
    try {
      await fs.access(dirPath);
    } catch {
      await fs.mkdir(dirPath, { recursive: true });
    }
  }

  /**
   * Read JSON file
   */
  static async readJSON<T>(filePath: string): Promise<T> {
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content);
  }

  /**
   * Write JSON file
   */
  static async writeJSON(filePath: string, data: unknown): Promise<void> {
    const dir = path.dirname(filePath);
    await this.ensureDir(dir);
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
  }

  /**
   * Write JSON file atomically via temp-file + rename
   */
  static async writeJSONAtomic(filePath: string, data: unknown): Promise<void> {
    const dir = path.dirname(filePath);
    await this.ensureDir(dir);
    const tmpPath = `${filePath}.${crypto.randomUUID()}.tmp`;
    try {
      await fs.writeFile(tmpPath, JSON.stringify(data, null, 2), 'utf-8');
      await fs.rename(tmpPath, filePath);
    } catch (e) {
      try {
        await fs.unlink(tmpPath);
      } catch {
        /* ignore cleanup failure */
      }
      throw e;
    }
  }

  /**
   * Check if file exists
   */
  static async exists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Logger utilities
 */
export class Logger {
  private static client: OpencodeClient | null = null;
  private static serviceName = 'contexty';

  static setClient(client: OpencodeClient) {
    this.client = client;
  }

  private static logToServer(
    level: 'info' | 'warn' | 'error' | 'debug',
    message: string,
    extra?: Record<string, unknown>
  ) {
    fs.appendFile(
      'contexty.log',
      `[${new Date().toISOString()}] [${level.toUpperCase()}] ${message} ${extra ? JSON.stringify(extra) : ''}\n`,
      'utf-8'
    );
    if (this.client) {
      this.client.app
        .log({
          body: {
            service: this.serviceName,
            level,
            message,
            extra,
          },
        })
        .catch(() => {});
    }
  }

  static info(message: string, extra?: Record<string, unknown>): void {
    this.logToServer('info', message, extra);
  }

  static success(message: string, extra?: Record<string, unknown>): void {
    this.logToServer('info', `[SUCCESS] ${message}`, extra);
  }

  static warn(message: string, extra?: Record<string, unknown>): void {
    this.logToServer('warn', message, extra);
  }

  static error(message: string, extra?: Record<string, unknown>): void {
    this.logToServer('error', message, extra);
  }

  static debug(message: string, extra?: Record<string, unknown>): void {
    this.logToServer('debug', message, extra);
  }
}

export function generateCustomId(prefix: string): string {
  const timestampHex = Date.now().toString(16).padStart(12, '0');
  const alphabet = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let randomPart = '';
  for (let i = 0; i < 14; i++) {
    randomPart += alphabet[crypto.randomInt(0, alphabet.length)];
  }
  return `${prefix}_${timestampHex}${randomPart}`;
}
