import { z } from "zod";

// Fail-fast boot env validation (D-07, Pattern 5). Centralizes the required-var
// list + coercion + a human-readable failure message. Called ONCE at boot from
// startServer() — never at import time and never per request — so tests that
// import createApp() (with the SDK mocked) do not require a real GEMINI_API_KEY.
//
// - GEMINI_API_KEY: required non-empty string (server-side only, per CLAUDE.md).
// - PORT: coerced to a number, defaults to 3000 (replaces the old hardcode).
// - NODE_ENV: development | production | test, defaults to development.
const EnvSchema = z.object({
  GEMINI_API_KEY: z.string().min(1, "GEMINI_API_KEY is required"),
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
});

export type Env = z.infer<typeof EnvSchema>;

/**
 * Validate process.env at boot. On any missing/invalid var, print a clear list
 * naming each offending variable to stderr and exit the process immediately
 * (fail-fast) so a misconfigured deploy dies at boot instead of on the first
 * user request. On success, returns the parsed + coerced env.
 */
export function loadEnv(): Env {
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    console.error(
      "Missing or invalid environment variables:\n" +
        details +
        "\nSet the required variables (e.g. GEMINI_API_KEY) and restart.",
    );
    process.exit(1);
  }
  return parsed.data;
}
