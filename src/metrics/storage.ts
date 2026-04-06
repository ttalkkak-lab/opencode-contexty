import fs from 'fs/promises'
import { FileSystem } from '../utils'
import { ensureSessionDir, sessionPath } from '../hscmm/storage'
import type { MetricsSnapshot } from './types'

const metricsFileName = 'metrics.json'

function isMetricsSnapshot(value: unknown): value is MetricsSnapshot {
  return typeof value === 'object' && value !== null && 'version' in value
}

export const writeMetrics = async (
  baseDir: string,
  sessionId: string,
  snapshot: MetricsSnapshot
): Promise<void> => {
  await ensureSessionDir(baseDir, sessionId)
  const filePath = sessionPath(baseDir, sessionId, metricsFileName)
  await FileSystem.writeJSONAtomic(filePath, snapshot)
}

export const readMetrics = async (
  baseDir: string,
  sessionId: string
): Promise<MetricsSnapshot | null> => {
  const filePath = sessionPath(baseDir, sessionId, metricsFileName)

  try {
    const raw = await fs.readFile(filePath, 'utf8')
    const parsed: unknown = JSON.parse(raw)

    if (!isMetricsSnapshot(parsed)) {
      return null
    }

    return parsed
  } catch {
    return null
  }
}

export const clearMetrics = async (baseDir: string, sessionId: string): Promise<void> => {
  const filePath = sessionPath(baseDir, sessionId, metricsFileName)

  try {
    await fs.unlink(filePath)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error
    }
  }
}
