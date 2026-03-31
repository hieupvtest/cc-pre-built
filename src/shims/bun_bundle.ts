/**
 * Shim for `bun:bundle` — Bun's build-time dead-code elimination API.
 *
 * In Anthropic's build pipeline, `feature('FLAG_NAME')` resolves to `true` or
 * `false` at bundle time, letting the bundler tree-shake entire code paths.
 *
 * This shim makes the code importable outside of `bun build`. Two modes:
 *
 *   1. **Build mode (via build.ts):** The Bun bundler replaces
 *      `feature('X')` calls with literal `true`/`false` using the `define`
 *      config — this module is never actually executed at runtime.
 *
 *   2. **Dev/unbundled mode:** If you run files directly (e.g. `bun run
 *      src/entrypoints/cli.tsx`), this module IS loaded at runtime. It reads
 *      FEATURE_FLAGS from the environment or defaults everything to `false`.
 */

// Flags to enable when running unbundled in dev. Add flags here to
// selectively turn on features for local development.
const ENABLED_FLAGS = new Set<string>(
  (process.env.CLAUDE_CODE_FEATURES ?? '').split(',').filter(Boolean)
);

export function feature(flag: string): boolean {
  return ENABLED_FLAGS.has(flag);
}
