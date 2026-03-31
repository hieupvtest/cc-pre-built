# Building the Extracted Claude Code Source

## Prerequisites

- **Bun >= 1.2** — required (this project uses `bun:bundle`, Bun's build API, and React/JSX compilation)
- **Node.js >= 18** — for runtime
- **macOS / Linux** — vendor binaries are platform-specific

## Quick Start

```bash
cd extracted-src

# 1. Install dependencies
bun install

# 2. Build
bun run build.ts

# 3. Run
node dist/cli.js --version
```

## What Was Extracted

The source map (`cli.js.map`, 57MB) embedded **full original TypeScript source** via
`sourcesContent`. Every file was extracted verbatim:

| Directory        | Files | Description                                 |
|------------------|-------|---------------------------------------------|
| `src/`           | 1,902 | First-party TypeScript/TSX                  |
| `node_modules/`  | 2,854 | Third-party dependencies (316 packages)     |

## Build-Time Constructs

### 1. `MACRO.*` Constants (7 total)

Inlined via Bun's `define` option:

| Macro                       | Purpose                              |
|-----------------------------|--------------------------------------|
| `MACRO.VERSION`             | Semver string                        |
| `MACRO.BUILD_TIME`          | ISO timestamp                        |
| `MACRO.PACKAGE_URL`         | npm package name                     |
| `MACRO.NATIVE_PACKAGE_URL`  | Native binary package (nullable)     |
| `MACRO.FEEDBACK_CHANNEL`    | Feedback/issues URL                  |
| `MACRO.ISSUES_EXPLAINER`    | Issue reporting instructions         |
| `MACRO.VERSION_CHANGELOG`   | Release notes text                   |

### 2. `feature()` Flags (88 total)

`import { feature } from 'bun:bundle'` is used in 156+ files for dead-code
elimination. The `feature('FLAG_NAME')` call resolves to `true`/`false` at
bundle time, letting the bundler tree-shake unused code paths.

The build script maps `bun:bundle` → `src/shims/bun_bundle.ts` which provides
a runtime shim. For true DCE, a Bun plugin would need to rewrite calls.

### 3. React Compiler

~395 files import `react/compiler-runtime` — they were pre-processed by the
React Compiler (automatic memoization). This is a standard React 19 feature.

### 4. `@ant/*` Internal Packages

These Anthropic-internal packages ARE included in `node_modules/` (they were
in the source map too):
- `@ant/claude-for-chrome-mcp` — Chrome extension MCP bridge
- `@ant/computer-use-mcp` — Computer use tool
- `@ant/computer-use-input` — Input capture for computer use
- `@ant/computer-use-swift` — macOS Swift bridge for computer use

### 5. Absolute `src/` Imports

~367 imports use `from 'src/services/...'` syntax (absolute from project root).
The `tsconfig.json` `paths` alias handles this: `"src/*" → ["./src/*"]`.

## Troubleshooting

### "Cannot find module 'bun:bundle'"
You must use Bun's bundler. The build script maps this to the local shim.
If running files directly with `bun run`, set `CLAUDE_CODE_FEATURES` env var.

### Missing `@ant/*` packages
These are already in `node_modules/` from the extraction. If you remove
`node_modules/` and reinstall, you'll lose them. Back them up first.

### `MACRO.VERSION` is undefined
You're running the raw source without building. Use `bun run build.ts` first,
or define the macros manually when running unbundled.

### Feature-gated code not included
By default, only a conservative set of feature flags are enabled.
Use `--all-features` to enable everything:
```bash
bun run build.ts --all-features
```
Or selectively:
```bash
CLAUDE_FEATURES=VOICE_MODE,BUDDY bun run build.ts
```
