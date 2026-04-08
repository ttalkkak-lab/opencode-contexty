import { isIgnoredUserMessage } from '../message-ids';
import { countTokens } from '../token-utils';
import { formatTokenCount } from './notification';
import type { SessionState, WithParts } from '../types';

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

export function formatCompressionRatio(inputTokens: number, outputTokens: number): string {
    if (outputTokens === 0) return "∞:1"
    if (inputTokens <= 0) return "0:1"
    return `${Math.round(inputTokens / outputTokens)}:1`
}

export function formatCompressionTime(ms: number): string {
    if (ms < 1000) return `${Math.round(ms)} ms`
    const seconds = ms / 1000
    if (seconds < 60) return `${seconds.toFixed(1)}s`
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = Math.round(seconds % 60)
    if (h > 0) return `${h}h ${m}m ${s}s`
    return `${m}m ${s}s`
}

export function cacheSystemPromptTokens(
    state: SessionState,
    messages: WithParts[],
): void {
    const firstAssistant = messages.find((msg) => {
        const info = msg.info as any;
        return info.role === 'assistant' && info.tokens?.input !== undefined;
    });

    if (!firstAssistant) {
        state.systemPromptTokens = undefined;
        return;
    }

    const tokens = (firstAssistant.info as any).tokens;
    const firstInputTokens =
        (tokens.input ?? 0) + (tokens.cache?.read ?? 0) + (tokens.cache?.write ?? 0);

    let firstUserTokens = 0;
    for (const msg of messages) {
        const info = msg.info as any;
        if (info.role !== 'user') continue;
        if (isIgnoredUserMessage(msg)) continue;

        for (const part of msg.parts ?? []) {
            if (part.type === 'text' && typeof part.text === 'string') {
                firstUserTokens = countTokens(part.text);
                break;
            }
        }

        if (firstUserTokens > 0) break;
    }

    state.systemPromptTokens = Math.max(0, firstInputTokens - firstUserTokens);
}
