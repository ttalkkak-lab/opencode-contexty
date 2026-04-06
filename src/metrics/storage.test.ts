/// <reference types="bun-types" />

import { describe, expect, it, beforeEach, afterEach } from 'bun:test'
import * as fs from 'fs/promises'
import * as os from 'os'
import * as path from 'path'
import { clearMetrics, readMetrics, writeMetrics } from './storage'
import type { MetricsSnapshot } from './types'

function makeSnapshot(overrides?: Partial<MetricsSnapshot>): MetricsSnapshot {
  return {
    version: 1,
    sessionID: 'ses_test',
    timestamp: '2026-01-01T00:00:00.000Z',
    tokens: {
      input: 1,
      output: 2,
      reasoning: 3,
      cacheRead: 4,
      cacheWrite: 5,
    },
    files: [],
    tools: [],
    acpm: {
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
    },
    ...overrides,
  }
}

describe('metrics storage', () => {
  let tempDir: string

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'contexty-metrics-'))
  })

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true })
  })

  it('writes metrics atomically to the session path', async () => {
    const snapshot = makeSnapshot()

    await writeMetrics(tempDir, 'ses_test', snapshot)

    const filePath = path.join(tempDir, '.contexty', 'sessions', 'ses_test', 'metrics.json')
    expect(JSON.parse(await fs.readFile(filePath, 'utf8'))).toEqual(snapshot)

    const dirEntries = await fs.readdir(path.dirname(filePath))
    expect(dirEntries.some((entry) => entry.endsWith('.tmp'))).toBe(false)
  })

  it('keeps sessions isolated', async () => {
    const snapshot = makeSnapshot({ sessionID: 'ses_abc' })

    await writeMetrics(tempDir, 'ses_abc', snapshot)

    expect(readMetrics(tempDir, 'ses_abc')).resolves.toEqual(snapshot)
    expect(readMetrics(tempDir, 'ses_xyz')).resolves.toBeNull()
  })

  it('returns null when the file is missing', async () => {
    expect(readMetrics(tempDir, 'ses_test')).resolves.toBeNull()
  })

  it('returns null for corrupted JSON', async () => {
    await fs.mkdir(path.join(tempDir, '.contexty', 'sessions', 'ses_test'), { recursive: true })
    await fs.writeFile(path.join(tempDir, '.contexty', 'sessions', 'ses_test', 'metrics.json'), '{not-json', 'utf8')

    expect(readMetrics(tempDir, 'ses_test')).resolves.toBeNull()
  })

  it('clears the metrics file without failing when missing', async () => {
    const snapshot = makeSnapshot()

    await writeMetrics(tempDir, 'ses_test', snapshot)
    await clearMetrics(tempDir, 'ses_test')
    await clearMetrics(tempDir, 'ses_test')

    expect(readMetrics(tempDir, 'ses_test')).resolves.toBeNull()
  })
})
