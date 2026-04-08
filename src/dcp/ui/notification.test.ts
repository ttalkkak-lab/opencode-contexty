import { describe, expect, test } from "bun:test";
import { formatTokenCount } from "./notification";

describe("formatTokenCount", () => {
  test("formats plain token counts with suffix", () => {
    expect(formatTokenCount(999)).toBe("999 tokens");
  });

  test("formats compact thousand counts", () => {
    expect(formatTokenCount(1000)).toBe("1K tokens");
    expect(formatTokenCount(1500)).toBe("1.5K tokens");
    expect(formatTokenCount(10000)).toBe("10K tokens");
  });

  test("omits suffix when abbreviated", () => {
    expect(formatTokenCount(999, true)).toBe("999");
    expect(formatTokenCount(1000, true)).toBe("1K");
  });
});
