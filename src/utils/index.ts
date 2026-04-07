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

  /**
   * List files in directory
   */
  static async listFiles(dirPath: string): Promise<string[]> {
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      return entries.filter((entry) => entry.isFile()).map((entry) => entry.name);
    } catch {
      return [];
    }
  }
}

/**
 * Token estimation utilities
 */
export class TokenEstimator {
  /**
   * Estimate token count for text
   * Simple heuristic: ~4 characters per token
   */
  static estimate(text: string): number {
    return Math.ceil(text.length / 4);
  }

  /**
   * Estimate tokens for file
   */
  static async estimateFile(filePath: string): Promise<number> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      return this.estimate(content);
    } catch {
      return 0;
    }
  }
}

/**
 * Path utilities
 */
export class PathUtils {
  /**
   * Normalize path to use forward slashes
   */
  static normalize(filePath: string): string {
    return filePath.replace(/\\/g, '/');
  }

  /**
   * Check if path matches pattern
   */
  static matches(filePath: string, pattern: string): boolean {
    const normalizedPath = this.normalize(filePath);
    const normalizedPattern = this.normalize(pattern);

    // Simple glob pattern matching
    if (normalizedPattern.endsWith('*')) {
      const prefix = normalizedPattern.slice(0, -1);
      return normalizedPath.startsWith(prefix);
    }

    return normalizedPath.includes(normalizedPattern);
  }

  /**
   * Get relative path from cwd
   */
  static relative(filePath: string): string {
    return path.relative(process.cwd(), filePath);
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

  private static colors = {
    reset: '\x1b[0m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
  };

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
    } else {
    }
  }

  static info(message: string, extra?: Record<string, unknown>): void {
    // console.log(`${this.colors.cyan}[INFO]${this.colors.reset} ${message}`);
    this.logToServer('info', message, extra);
  }

  static success(message: string, extra?: Record<string, unknown>): void {
    // console.log(`${this.colors.green}[SUCCESS]${this.colors.reset} ${message}`);
    this.logToServer('info', `[SUCCESS] ${message}`, extra);
  }

  static warn(message: string, extra?: Record<string, unknown>): void {
    // console.log(`${this.colors.yellow}[WARN]${this.colors.reset} ${message}`);
    this.logToServer('warn', message, extra);
  }

  static error(message: string, extra?: Record<string, unknown>): void {
    // console.error(`${this.colors.red}[ERROR]${this.colors.reset} ${message}`);
    this.logToServer('error', message, extra);
  }

  static debug(message: string, extra?: Record<string, unknown>): void {
    if (process.env.DEBUG) {
      // console.log(`${this.colors.magenta}[DEBUG]${this.colors.reset} ${message}`);
    }
    // Always send debug logs to server if client is available, useful for troubleshooting
    this.logToServer('debug', message, extra);
  }
}

/**
 * Date formatting utilities
 */
export class DateUtils {
  static format(date: Date): string {
    return date.toISOString().replace('T', ' ').split('.')[0];
  }

  static relative(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    if (diffSec < 60) return `${diffSec}s ago`;
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHour < 24) return `${diffHour}h ago`;
    return `${diffDay}d ago`;
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
