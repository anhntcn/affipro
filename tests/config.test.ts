import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { loadEnv } from "../server/config";

// loadEnv() reads process.env at call time, so each case mutates a restored copy
// of process.env and stubs process.exit / console.error to observe fail-fast
// without killing the test runner.

const ORIGINAL_ENV = { ...process.env };

describe("loadEnv()", () => {
  beforeEach(() => {
    // Start each case from a clean, known env.
    process.env = { ...ORIGINAL_ENV };
    delete process.env.PORT;
    delete process.env.GEMINI_API_KEY;
    delete process.env.NODE_ENV;
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    vi.restoreAllMocks();
  });

  it("returns PORT 3000 by default when a key is present and PORT is unset", () => {
    process.env.GEMINI_API_KEY = "test-key";
    const env = loadEnv();
    expect(env.PORT).toBe(3000);
    expect(env.GEMINI_API_KEY).toBe("test-key");
  });

  it("coerces PORT from the environment to a number", () => {
    process.env.GEMINI_API_KEY = "test-key";
    process.env.PORT = "4000";
    const env = loadEnv();
    expect(env.PORT).toBe(4000);
    expect(typeof env.PORT).toBe("number");
  });

  it("fails fast (process.exit(1)) with a message naming GEMINI_API_KEY when it is missing", () => {
    // GEMINI_API_KEY intentionally absent (deleted in beforeEach).
    const errorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    // Make process.exit throw so control flow stops like a real exit would,
    // and so we can assert it was called with code 1.
    const exitSpy = vi
      .spyOn(process, "exit")
      .mockImplementation(((code?: number) => {
        throw new Error(`process.exit:${code}`);
      }) as never);

    expect(() => loadEnv()).toThrow("process.exit:1");
    expect(exitSpy).toHaveBeenCalledWith(1);

    const printed = errorSpy.mock.calls.map((c) => String(c[0])).join("\n");
    expect(printed).toContain("GEMINI_API_KEY");
  });
});
