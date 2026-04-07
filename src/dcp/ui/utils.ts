import { formatTokenCount } from './notification';

export function formatStatsHeader(totalTokensSaved: number, pruneTokenCounter: number): string {
    const totalTokensSavedStr = `~${formatTokenCount(totalTokensSaved + pruneTokenCounter)}`
    return `▣ DCP | ${totalTokensSavedStr} saved total`
}

export function formatProgressBar(
    messageIds: string[],
    prunedMessages: Map<string, number>,
    recentMessageIds: string[],
    width: number = 50,
): string {
    const ACTIVE = "█"
    const PRUNED = "░"
    const RECENT = "⣿"
    const recentSet = new Set(recentMessageIds)

    const total = messageIds.length
    if (total === 0) return `│${PRUNED.repeat(width)}│`

    const bar = new Array(width).fill(ACTIVE)

    for (let m = 0; m < total; m++) {
        const msgId = messageIds[m]
        const start = Math.floor((m / total) * width)
        const end = Math.floor(((m + 1) / total) * width)

        if (recentSet.has(msgId)) {
            for (let i = start; i < end; i++) {
                bar[i] = RECENT
            }
        } else if (prunedMessages.has(msgId)) {
            for (let i = start; i < end; i++) {
                bar[i] = PRUNED
            }
        }
    }

    return `│${bar.join("")}│`
}
