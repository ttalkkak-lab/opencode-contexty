import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as os from 'os';
import { FileSystem } from './index';

describe('FileSystem.writeJSONAtomic', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'contexty-utils-'));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('writes valid JSON', async () => {
    const filePath = path.join(tempDir, 'data.json');
    const data = { name: 'contexty', version: 1, nested: { enabled: true } };

    await FileSystem.writeJSONAtomic(filePath, data);

    const content = await fs.readFile(filePath, 'utf8');
    expect(JSON.parse(content)).toEqual(data);
  });

  it('cleans up temp file on success', async () => {
    const filePath = path.join(tempDir, 'clean.json');

    await FileSystem.writeJSONAtomic(filePath, { ok: true });

    expect(await FileSystem.exists(`${filePath}.tmp`)).toBe(false);
  });

  it('creates directory if missing', async () => {
    const filePath = path.join(tempDir, 'nested', 'dir', 'data.json');

    await FileSystem.writeJSONAtomic(filePath, { created: true });

    expect(JSON.parse(await fs.readFile(filePath, 'utf8'))).toEqual({ created: true });
  });

  it('cleans up temp file on failure', async () => {
    const filePath = path.join('/dev/null', 'impossible', 'file.json');

    expect(FileSystem.writeJSONAtomic(filePath, { fail: true })).rejects.toThrow();
    expect(await FileSystem.exists(`${filePath}.tmp`)).toBe(false);
  });

  it('overwrites existing file', async () => {
    const filePath = path.join(tempDir, 'overwrite.json');

    await FileSystem.writeJSONAtomic(filePath, { value: 1 });
    await FileSystem.writeJSONAtomic(filePath, { value: 2 });

    expect(JSON.parse(await fs.readFile(filePath, 'utf8'))).toEqual({ value: 2 });
  });
});
