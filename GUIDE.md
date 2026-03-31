# Claude Code — Extracted Source: Developer Guide

## Table of Contents

1. [Project Structure](#project-structure)
2. [How to Build](#how-to-build)
3. [Architecture Overview](#architecture-overview)
4. [How to Add a New Tool](#how-to-add-a-new-tool)
5. [How to Add a New Slash Command](#how-to-add-a-new-slash-command)
6. [Feature Flags](#feature-flags)
7. [Build-Time Macros](#build-time-macros)
8. [Stub Files](#stub-files)
9. [Troubleshooting](#troubleshooting)

---

## Project Structure

```
extracted-src/
├── build.ts                  # Bun build script
├── package.json              # Dependencies
├── tsconfig.json             # TypeScript config
├── dist/
│   └── cli.js                # Built output (24MB single-file bundle)
├── src/
│   ├── entrypoints/
│   │   ├── cli.tsx           # CLI entrypoint (Commander.js)
│   │   ├── mcp.ts            # MCP server entrypoint
│   │   └── sdk/              # Agent SDK entrypoints
│   ├── Tool.ts               # Base tool type + buildTool() factory
│   ├── tools.ts              # Tool registry (getAllBaseTools)
│   ├── tools/                # 40+ tool implementations
│   │   ├── BashTool/
│   │   ├── FileReadTool/
│   │   ├── FileEditTool/
│   │   ├── FileWriteTool/
│   │   ├── GlobTool/
│   │   ├── GrepTool/
│   │   ├── AgentTool/
│   │   ├── WebFetchTool/
│   │   └── ...
│   ├── commands.ts           # Command registry
│   ├── commands/             # 90+ slash commands
│   │   ├── commit.ts
│   │   ├── clear/
│   │   ├── review/
│   │   ├── theme/
│   │   └── ...
│   ├── main.tsx              # Commander.js CLI definition + system prompts
│   ├── ink/                  # Custom React/Ink terminal UI framework
│   ├── components/           # React UI components
│   ├── hooks/                # React hooks
│   ├── services/             # Analytics, OAuth, MCP, settings sync
│   ├── utils/                # Permissions, sandboxing, git, config
│   ├── bridge/               # WebSocket remote control (claude.ai)
│   ├── state/                # React state management
│   ├── shims/
│   │   └── bun_bundle.ts     # Runtime shim for bun:bundle feature()
│   └── ...
└── node_modules/
    ├── @ant/                 # Internal packages (from source map)
    ├── react/
    ├── zod/
    └── ... (70+ packages)
```

---

## How to Build

### Prerequisites

- **Bun >= 1.2** — the build tool and bundler
- **Node.js >= 18** — for runtime

### Commands

```bash
# Install dependencies
bun install

# Build (default feature set)
bun run build.ts

# Build with all feature flags enabled
bun run build.ts --all-features

# Build with specific features
CLAUDE_FEATURES=VOICE_MODE,BUDDY,DAEMON bun run build.ts

# Set version
CLAUDE_VERSION=2.2.0 bun run build.ts

# Run the built CLI
node dist/cli.js --version
node dist/cli.js -p "hello world"
node dist/cli.js   # interactive mode
```

### What the Build Does

1. **Resolves `bun:bundle`** → maps to `src/shims/bun_bundle.ts` (feature flag runtime)
2. **Inlines `MACRO.*` constants** via Bun's `define` option
3. **Loads `.md` and `.txt` files** as string imports
4. **Stubs `.d.ts` imports** (declaration-only, no runtime code)
5. **Bundles everything** into a single `dist/cli.js` ESM file with shebang

### Build Output

| Property | Value |
|----------|-------|
| Format | Single-file ESM bundle |
| Target | Node.js |
| Size | ~24MB (unminified) |
| Sourcemap | Linked (dist/cli.js.map) |

---

## Architecture Overview

### The Tool System

A **Tool** is a TypeScript object conforming to the `Tool<Input, Output, Progress>` type
defined in `src/Tool.ts`. Tools are the primary mechanism for Claude to interact with the
filesystem, shell, web, MCP servers, and other systems.

**Key types:**

| Type | File | Purpose |
|------|------|---------|
| `Tool<I, O, P>` | `src/Tool.ts` | The full tool interface |
| `ToolDef<I, O>` | `src/Tool.ts` | Partial tool definition (input to `buildTool`) |
| `ToolUseContext` | `src/Tool.ts` | Rich context passed to `call()` |
| `ToolResult<T>` | `src/Tool.ts` | Return type of `call()` |
| `ToolPermissionContext` | `src/Tool.ts` | Permission mode, allow/deny rules |

**Every tool has 3 files** (convention):

```
src/tools/MyTool/
├── MyTool.ts     # Tool definition (schema, logic, permissions)
├── UI.tsx        # React rendering functions
└── prompt.ts     # Name constant + description string
```

### The Command System

A **Command** is a slash command (e.g. `/commit`, `/clear`, `/review`). Three types:

| Type | Model-invocable? | What it does |
|------|-------------------|--------------|
| `'prompt'` | ✅ (via SkillTool) | Returns content sent to the model |
| `'local'` | ❌ | Runs local logic, returns text |
| `'local-jsx'` | ❌ | Renders interactive React/Ink UI |

---

## How to Add a New Tool

### Step 1: Create the Directory

```bash
mkdir -p src/tools/MyNewTool
```

### Step 2: Create `prompt.ts`

```typescript
// src/tools/MyNewTool/prompt.ts
export const MY_NEW_TOOL_NAME = 'MyNewTool'

export const DESCRIPTION = `\
- Short description of what the tool does
- When to use it
- What parameters it accepts
- Any important notes`
```

### Step 3: Create `UI.tsx`

```tsx
// src/tools/MyNewTool/UI.tsx
import React from 'react'
import type { ToolInput, ToolOutput } from './MyNewTool.js'

export function userFacingName(): string {
  return 'My Tool'
}

export function renderToolUseMessage(
  input: ToolInput,
  { verbose }: { verbose: boolean }
): React.ReactNode {
  return <>{verbose ? `MyNewTool: ${input.param}` : input.param}</>
}

export function renderToolResultMessage(
  output: ToolOutput,
): React.ReactNode {
  return <>{output.result}</>
}

export function getToolUseSummary(input: ToolInput): string {
  return `MyNewTool(${input.param})`
}
```

### Step 4: Create `MyNewTool.ts`

```typescript
// src/tools/MyNewTool/MyNewTool.ts
import { z } from 'zod'
import { buildTool, type ToolDef } from '../../Tool.js'
import { lazySchema } from '../../utils/lazySchema.js'
import { MY_NEW_TOOL_NAME, DESCRIPTION } from './prompt.js'
import {
  userFacingName,
  renderToolUseMessage,
  renderToolResultMessage,
  getToolUseSummary,
} from './UI.js'

// Input schema — defines what parameters the model can send
const inputSchema = lazySchema(() =>
  z.strictObject({
    param: z.string().describe('Description of the parameter'),
    optionalParam: z.string().optional().describe('Optional parameter'),
  })
)
type InputSchema = ReturnType<typeof inputSchema>
export type ToolInput = z.infer<InputSchema>

// Output schema — defines the shape of the result
const outputSchema = lazySchema(() =>
  z.object({
    result: z.string(),
    count: z.number(),
  })
)
export type ToolOutput = z.infer<ReturnType<typeof outputSchema>>

export const MyNewTool = buildTool({
  name: MY_NEW_TOOL_NAME,
  maxResultSizeChars: 100_000,

  get inputSchema() { return inputSchema() },
  get outputSchema() { return outputSchema() },

  // --- Description (shown to model) ---
  async description() { return DESCRIPTION },
  async prompt() { return DESCRIPTION },

  // --- Metadata flags ---
  isConcurrencySafe() { return true },   // safe to run in parallel?
  isReadOnly() { return true },          // only reads, no writes?

  // --- Core logic ---
  async call(input, context) {
    // context provides: abortController, getAppState, readFileState, etc.
    const result = `Processed: ${input.param}`
    return {
      data: { result, count: result.length },
    }
  },

  // --- Serialize for API ---
  mapToolResultToToolResultBlockParam(output, toolUseID) {
    return {
      tool_use_id: toolUseID,
      type: 'tool_result',
      content: output.result,
    }
  },

  // --- UI ---
  userFacingName,
  renderToolUseMessage,
  renderToolResultMessage,
  getToolUseSummary,
} satisfies ToolDef<InputSchema, ToolOutput>)
```

### Step 5: Register in `src/tools.ts`

```typescript
// Add import
import { MyNewTool } from './tools/MyNewTool/MyNewTool.js'

// Add to getAllBaseTools()
export function getAllBaseTools(): Tools {
  return [
    // ... existing tools ...
    MyNewTool,
  ]
}
```

### Step 6: Build and Test

```bash
bun run build.ts
node dist/cli.js -p "Use MyNewTool with param 'test'"
```

### Optional: Add Permission Checking

```typescript
// In MyNewTool.ts, add to buildTool():
async checkPermissions(input, context) {
  // Return { behavior: 'allow' } to auto-allow
  // Return { behavior: 'ask', message: '...' } to prompt user
  // Return { behavior: 'deny', message: '...' } to block
  if (input.param.includes('dangerous')) {
    return { behavior: 'ask', message: `Allow MyNewTool on "${input.param}"?` }
  }
  return { behavior: 'allow', updatedInput: input }
},
```

### Optional: Feature-Gate the Tool

```typescript
// In src/tools.ts, use conditional require:
const MyNewTool =
  feature('MY_FEATURE_FLAG')
    ? require('./tools/MyNewTool/MyNewTool.js').MyNewTool
    : null

// Then in getAllBaseTools():
...(MyNewTool ? [MyNewTool] : []),
```

---

## How to Add a New Slash Command

### Option A: `prompt` Command (Model-Invocable)

A prompt command sends instructions to the model — like `/commit` or `/review`.

```typescript
// src/commands/my-skill.ts
import type { Command } from '../types/command.js'

const command = {
  type: 'prompt' as const,
  name: 'my-skill',
  description: 'Does something useful',
  aliases: ['ms'],                    // optional aliases
  argumentHint: '<target>',           // shown in autocomplete
  progressMessage: 'doing the thing', // shown in spinner
  contentLength: 0,
  source: 'builtin',
  allowedTools: ['Bash(git:*)', 'Read'], // restrict tool access (optional)

  async getPromptForCommand(args: string, context) {
    return [{
      type: 'text' as const,
      text: `Please do the thing with: ${args}\n\nFollow these steps:\n1. ...\n2. ...`,
    }]
  },
} satisfies Command

export default command
```

### Option B: `local` Command (Runs Code Directly)

A local command runs TypeScript logic without the model.

```typescript
// src/commands/my-command/index.ts
import type { Command } from '../../types/command.js'

const myCommand = {
  type: 'local' as const,
  name: 'my-command',
  description: 'Does a local thing',
  aliases: ['mc'],
  supportsNonInteractive: false,
  load: () => import('./my-command.js'),
} satisfies Command

export default myCommand
```

```typescript
// src/commands/my-command/my-command.ts
import type { LocalCommandCall } from '../../types/command.js'

export const call: LocalCommandCall = async (args, context) => {
  // args = string after the command name
  // context = { abortController, readFileState, ... }
  const result = `Processed: ${args}`
  return { type: 'text', value: result }
}
```

### Option C: `local-jsx` Command (Interactive UI)

For commands that render interactive React/Ink UI (like `/theme`, `/model`).

```typescript
// src/commands/my-dialog/index.ts
const myDialog = {
  type: 'local-jsx' as const,
  name: 'my-dialog',
  description: 'Shows an interactive dialog',
  load: () => import('./my-dialog.js'),
} satisfies Command

export default myDialog
```

```tsx
// src/commands/my-dialog/my-dialog.tsx
import React, { useState } from 'react'

export const call = (onDone: (result: any) => void, context: any) => {
  return <MyDialog onDone={onDone} />
}

function MyDialog({ onDone }: { onDone: (result: any) => void }) {
  // Interactive Ink UI here...
  return <Text>Hello from my dialog</Text>
}
```

### Register the Command

```typescript
// src/commands.ts
import myCommand from './commands/my-command/index.js'

const COMMANDS = memoize((): Command[] => [
  // ... existing commands ...
  myCommand,
])
```

---

## Feature Flags

88 feature flags control compile-time dead-code elimination.

### How They Work

```typescript
import { feature } from 'bun:bundle'

// Compile-time: feature('X') → true or false
// The bundler tree-shakes dead branches
if (feature('VOICE_MODE')) {
  // This entire block is removed if VOICE_MODE=false
  const voiceModule = require('./voice/index.js')
}
```

### Controlling Flags

**At build time** (in `build.ts`):
```typescript
// Edit DEFAULT_ENABLED_FLAGS to change which flags are on by default
const DEFAULT_ENABLED_FLAGS = new Set<string>([
  'AUTO_THEME',
  'BUILTIN_EXPLORE_PLAN_AGENTS',
  // Add your flag here
  'MY_NEW_FEATURE',
]);
```

**Via environment variable:**
```bash
CLAUDE_FEATURES=MY_NEW_FEATURE,VOICE_MODE bun run build.ts
```

**Enable everything:**
```bash
bun run build.ts --all-features
```

**At dev/runtime** (when running unbundled):
```bash
CLAUDE_CODE_FEATURES=MY_NEW_FEATURE bun run src/entrypoints/cli.tsx
```

### Full Flag List

See `build.ts` → `ALL_FEATURE_FLAGS` array for all 88 flags. Key categories:

| Category | Flags |
|----------|-------|
| Product features | `VOICE_MODE`, `BUDDY`, `TEMPLATES`, `WEB_BROWSER_TOOL`, `COORDINATOR_MODE` |
| Infrastructure | `DAEMON`, `BG_SESSIONS`, `BRIDGE_MODE`, `SSH_REMOTE`, `DIRECT_CONNECT` |
| Internal/Ant-only | `ABLATION_BASELINE`, `DUMP_SYSTEM_PROMPT`, `ANTI_DISTILLATION_CC` |
| Experiments | `ULTRATHINK`, `ULTRAPLAN`, `TORCH`, `REACTIVE_COMPACT` |
| Platform | `IS_LIBC_GLIBC`, `IS_LIBC_MUSL`, `TREE_SITTER_BASH` |

---

## Build-Time Macros

7 constants inlined via Bun's `define` option:

| Macro | Default | Purpose |
|-------|---------|---------|
| `MACRO.VERSION` | `"2.1.88-dev"` | Semver shown in `--version` |
| `MACRO.BUILD_TIME` | Current ISO timestamp | Displayed in diagnostics |
| `MACRO.PACKAGE_URL` | `"@anthropic-ai/claude-code"` | npm package identifier |
| `MACRO.NATIVE_PACKAGE_URL` | `null` | Native binary package |
| `MACRO.FEEDBACK_CHANNEL` | GitHub issues URL | Where to report issues |
| `MACRO.ISSUES_EXPLAINER` | Issue reporting text | User-facing help text |
| `MACRO.VERSION_CHANGELOG` | `""` | Release notes |

Override at build time:
```bash
CLAUDE_VERSION=3.0.0 bun run build.ts
```

---

## Stub Files

34 files were stubbed because they were tree-shaken out of the original source map
(they only existed behind `feature()` flags that were disabled in the published build).

| Stub | Original Purpose |
|------|-----------------|
| `tools/TungstenTool/` | Internal monitoring tool |
| `tools/REPLTool/` | Internal REPL tool |
| `tools/SuggestBackgroundPRTool/` | Background PR suggestions |
| `tools/VerifyPlanExecutionTool/` | Plan verification |
| `tools/WorkflowTool/constants.ts` | Workflow automation |
| `types/connectorText.ts` | Connector text blocks |
| `utils/protectedNamespace.ts` | Protected namespace |
| `services/compact/cachedMicrocompact.ts` | Cached compaction |
| `services/compact/snipCompact.ts` | Snip compaction |
| `services/contextCollapse/` | Context collapse |
| `assistant/AssistantSessionChooser.ts` | Assistant mode |
| `commands/assistant/` | Assistant command |
| `commands/agents-platform/` | Agents platform |
| `components/agents/SnapshotUpdateDialog.ts` | Agent snapshots |
| `utils/filePersistence/types.ts` | File persistence types |
| `ink/devtools.ts` | Ink devtools |
| `entrypoints/sdk/runtimeTypes.ts` | SDK runtime types |
| `entrypoints/sdk/toolTypes.ts` | SDK tool types |
| `entrypoints/coreTypes.generated.ts` | Generated core types |

Native module stubs (in `node_modules/`):
- `color-diff-napi` — color diffing (native addon)
- `modifiers-napi` — keyboard modifier detection (native addon)

---

## Troubleshooting

### Build errors: "Could not resolve"

**Missing npm package:** Run `bun add <package-name>`

**Missing internal file:** Create a stub (see [Stub Files](#stub-files)). Most missing
files are behind `feature()` flags — they were tree-shaken from the source map.

### Build errors: "No matching export"

A stub file is missing exports. Check what the importing file expects and add the
missing exports to the stub.

### Runtime: "Cannot find module"

If `bun install` removes `@ant/*` packages, restore them:
```bash
cp -r /tmp/_ant_backup/* node_modules/@ant/
```

### Runtime: "MACRO.VERSION is not defined"

You're running the raw source without building. Either:
- Build first: `bun run build.ts`
- Or run via Bun with env vars (not recommended for full runs)

### Adding a tool but model doesn't use it

1. Check `isEnabled()` returns `true`
2. Check it's in `getAllBaseTools()` in `src/tools.ts`
3. Check the `description()` and `prompt()` are clear and descriptive
4. Check it's not filtered out by deny rules
5. Rebuild: `bun run build.ts`
