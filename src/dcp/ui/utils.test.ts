import { describe, expect, test } from "bun:test";
import { cacheSystemPromptTokens, formatCompressionRatio, formatCompressionTime } from "./utils";

describe("dcp ui utils", () => {
    test("formats compression ratios", () => {
        expect(formatCompressionRatio(1000, 500)).toBe("2:1");
        expect(formatCompressionRatio(1000, 0)).toBe("∞:1");
        expect(formatCompressionRatio(0, 500)).toBe("0:1");
        expect(formatCompressionRatio(1500, 1000)).toBe("2:1");
    });

    test("formats compression time", () => {
        expect(formatCompressionTime(0)).toBe("0 ms");
        expect(formatCompressionTime(50)).toBe("50 ms");
        expect(formatCompressionTime(500)).toBe("500 ms");
        expect(formatCompressionTime(1500)).toBe("1.5s");
        expect(formatCompressionTime(90000)).toBe("1m 30s");
        expect(formatCompressionTime(3661000)).toBe("1h 1m 1s");
    });

    test("computes system prompt tokens from first assistant", () => {
        const state = { systemPromptTokens: undefined } as any;
        const messages = [
            { info: { id: "m1", role: "user" }, parts: [{ type: "text", text: "Hello world" }] },
            { info: { id: "m2", role: "assistant", tokens: { input: 1000, cache: { read: 500, write: 200 } } }, parts: [] },
        ];

        cacheSystemPromptTokens(state, messages as any);

        expect(state.systemPromptTokens).toBeGreaterThan(0);
        expect(state.systemPromptTokens).toBeLessThan(1700);
    });

    test("sets undefined when no assistant with token data", () => {
        const state = { systemPromptTokens: 999 } as any;
        const messages = [
            { info: { id: "m1", role: "user" }, parts: [{ type: "text", text: "Hello" }] },
        ];

        cacheSystemPromptTokens(state, messages as any);

        expect(state.systemPromptTokens).toBeUndefined();
    });

    test("skips ignored user messages", () => {
        const state = { systemPromptTokens: undefined } as any;
        const messages = [
            { info: { id: "m1", role: "user" }, parts: [{ type: "text", text: "ignored text", ignored: true }] },
            { info: { id: "m2", role: "assistant", tokens: { input: 500 } }, parts: [] },
        ];

        cacheSystemPromptTokens(state, messages as any);

        expect(state.systemPromptTokens).toBe(500);
    });
});
