/**
 * Build script for extracted Claude Code source.
 *
 * Usage:
 *   bun run build.ts                    # standard external build
 *   bun run build.ts --all-features     # enable ALL feature flags
 *   CLAUDE_FEATURES=VOICE_MODE,BUDDY bun run build.ts  # selective flags
 */

// ---------------------------------------------------------------------------
// 1. Build-time MACRO definitions (inlined via --define)
// ---------------------------------------------------------------------------
const VERSION = process.env.CLAUDE_VERSION ?? '2.1.88-dev';
const BUILD_TIME = new Date().toISOString();

const macroDefines: Record<string, string> = {
  'MACRO.VERSION':           JSON.stringify(VERSION),
  'MACRO.BUILD_TIME':        JSON.stringify(BUILD_TIME),
  'MACRO.PACKAGE_URL':       JSON.stringify('@anthropic-ai/claude-code'),
  'MACRO.NATIVE_PACKAGE_URL': JSON.stringify(null),
  'MACRO.FEEDBACK_CHANNEL':  JSON.stringify('https://github.com/anthropics/claude-code/issues'),
  'MACRO.ISSUES_EXPLAINER':  JSON.stringify('Please report issues at https://github.com/anthropics/claude-code/issues'),
  'MACRO.VERSION_CHANGELOG': JSON.stringify(''),
};

// ---------------------------------------------------------------------------
// 2. Feature flags — all 88 flags from the source
// ---------------------------------------------------------------------------
const ALL_FEATURE_FLAGS = [
  'ABLATION_BASELINE', 'AGENT_MEMORY_SNAPSHOT', 'AGENT_TRIGGERS',
  'AGENT_TRIGGERS_REMOTE', 'ALLOW_TEST_VERSIONS', 'ANTI_DISTILLATION_CC',
  'AUTO_THEME', 'AWAY_SUMMARY', 'BASH_CLASSIFIER', 'BG_SESSIONS',
  'BREAK_CACHE_COMMAND', 'BRIDGE_MODE', 'BUDDY', 'BUILDING_CLAUDE_APPS',
  'BUILTIN_EXPLORE_PLAN_AGENTS', 'BYOC_ENVIRONMENT_RUNNER',
  'CACHED_MICROCOMPACT', 'CCR_AUTO_CONNECT', 'CCR_MIRROR', 'CCR_REMOTE_SETUP',
  'CHICAGO_MCP', 'COMMIT_ATTRIBUTION', 'COMPACTION_REMINDERS',
  'CONNECTOR_TEXT', 'CONTEXT_COLLAPSE', 'COORDINATOR_MODE',
  'COWORKER_TYPE_TELEMETRY', 'DAEMON', 'DIRECT_CONNECT',
  'DOWNLOAD_USER_SETTINGS', 'DUMP_SYSTEM_PROMPT', 'ENHANCED_TELEMETRY_BETA',
  'EXPERIMENTAL_SKILL_SEARCH', 'EXTRACT_MEMORIES', 'FILE_PERSISTENCE',
  'FORK_SUBAGENT', 'HARD_FAIL', 'HISTORY_PICKER', 'HISTORY_SNIP',
  'HOOK_PROMPTS', 'IS_LIBC_GLIBC', 'IS_LIBC_MUSL', 'KAIROS', 'KAIROS_BRIEF',
  'KAIROS_CHANNELS', 'KAIROS_DREAM', 'KAIROS_GITHUB_WEBHOOKS',
  'KAIROS_PUSH_NOTIFICATION', 'LODESTONE', 'MCP_RICH_OUTPUT', 'MCP_SKILLS',
  'MEMORY_SHAPE_TELEMETRY', 'MESSAGE_ACTIONS', 'MONITOR_TOOL',
  'NATIVE_CLIENT_ATTESTATION', 'NATIVE_CLIPBOARD_IMAGE', 'NEW_INIT',
  'OVERFLOW_TEST_TOOL', 'PERFETTO_TRACING', 'POWERSHELL_AUTO_MODE',
  'PROACTIVE', 'PROMPT_CACHE_BREAK_DETECTION', 'QUICK_SEARCH',
  'REACTIVE_COMPACT', 'REVIEW_ARTIFACT', 'RUN_SKILL_GENERATOR',
  'SELF_HOSTED_RUNNER', 'SHOT_STATS', 'SKILL_IMPROVEMENT',
  'SKIP_DETECTION_WHEN_AUTOUPDATES_DISABLED', 'SLOW_OPERATION_LOGGING',
  'SSH_REMOTE', 'STREAMLINED_OUTPUT', 'TEAMMEM', 'TEMPLATES',
  'TERMINAL_PANEL', 'TOKEN_BUDGET', 'TORCH', 'TRANSCRIPT_CLASSIFIER',
  'TREE_SITTER_BASH', 'TREE_SITTER_BASH_SHADOW', 'UDS_INBOX', 'ULTRAPLAN',
  'ULTRATHINK', 'UNATTENDED_RETRY', 'UPLOAD_USER_SETTINGS',
  'VERIFICATION_AGENT', 'VOICE_MODE', 'WEB_BROWSER_TOOL', 'WORKFLOW_SCRIPTS',
] as const;

// Default: external-safe flags only. Add more as desired.
const DEFAULT_ENABLED_FLAGS = new Set<string>([
  'AUTO_THEME',
  'BUILTIN_EXPLORE_PLAN_AGENTS',
  'COMMIT_ATTRIBUTION',
  'COMPACTION_REMINDERS',
  'TREE_SITTER_BASH',
  'HISTORY_PICKER',
  'HISTORY_SNIP',
  'MCP_SKILLS',
  'HOOK_PROMPTS',
  'EXTRACT_MEMORIES',
]);

const enableAll = process.argv.includes('--all-features');
const envFlags = new Set(
  (process.env.CLAUDE_FEATURES ?? '').split(',').filter(Boolean)
);

function isFeatureEnabled(flag: string): boolean {
  if (enableAll) return true;
  if (envFlags.has(flag)) return true;
  return DEFAULT_ENABLED_FLAGS.has(flag);
}

// Build the feature() defines — these replace `feature('FLAG')` → true/false
// at compile time so the bundler can tree-shake dead branches.
//
// Bun's `define` only does *identifier* replacement (like C #define).
// It cannot pattern-match `feature("FOO")` calls. Instead we rely on Bun's
// built-in `bun:bundle` handling when bundling, OR we use the `--define`
// approach with the shim module mapped below.
//
// The pragmatic approach: we DON'T try to replace feature() calls via define.
// Instead we let the shim module (src/shims/bun_bundle.ts) handle it at
// bundle-time by mapping 'bun:bundle' → our shim.  The shim then uses env
// vars.  If you want true dead-code elimination, use the Bun plugin approach
// (see the plugin below).

// ---------------------------------------------------------------------------
// 3. Bun build config
// ---------------------------------------------------------------------------

// Plugin that handles bun:bundle shim, .md/.txt file imports, and .d.ts imports
const buildPlugin: import('bun').BunPlugin = {
  name: 'claude-code-build-plugin',
  setup(build) {
    // Resolve bun:bundle → our shim
    build.onResolve({ filter: /^bun:bundle$/ }, () => ({
      path: new URL('./src/shims/bun_bundle.ts', import.meta.url).pathname,
    }));

    // Handle .md file imports — load as text strings
    build.onLoad({ filter: /\.md$/ }, async (args) => ({
      contents: `export default ${JSON.stringify(await Bun.file(args.path).text())};`,
      loader: 'js',
    }));

    // Handle .txt file imports — load as text strings
    build.onLoad({ filter: /\.txt$/ }, async (args) => ({
      contents: `export default ${JSON.stringify(await Bun.file(args.path).text())};`,
      loader: 'js',
    }));

    // Handle .d.ts imports (some files import global.d.ts for side effects)
    build.onResolve({ filter: /\.d\.ts$/ }, (args) => ({
      path: args.path,
      namespace: 'dts-stub',
    }));
    build.onLoad({ filter: /.*/, namespace: 'dts-stub' }, () => ({
      contents: '// .d.ts stub — declarations only, no runtime code',
      loader: 'js',
    }));
  },
};

async function main() {
  console.log(`Building claude-code v${VERSION}...`);
  console.log(`Build time: ${BUILD_TIME}`);
  console.log(`Feature flags: ${enableAll ? 'ALL' : [...DEFAULT_ENABLED_FLAGS, ...envFlags].join(', ')}`);
  console.log('');

  const result = await Bun.build({
    entrypoints: ['./src/entrypoints/cli.tsx'],
    outdir: './dist',
    target: 'node',
    format: 'esm',
    sourcemap: 'linked',
    minify: false,       // keep readable for development; set true for prod
    splitting: false,    // single-file output like the original

    define: {
      ...macroDefines,
      // If you want static flag replacement without the plugin, you can
      // uncomment the lines below — but this only works if bun supports
      // defining function-call expressions (it doesn't currently).
      // ...Object.fromEntries(
      //   ALL_FEATURE_FLAGS.map(f => [`feature('${f}')`, String(isFeatureEnabled(f))])
      // ),
    },

    plugins: [buildPlugin],

    // External packages — don't bundle these, resolve at runtime.
    // Comment this out if you want a fully self-contained single file.
    // external: [],
  });

  if (!result.success) {
    console.error('Build failed:');
    for (const log of result.logs) {
      console.error(log);
    }
    process.exit(1);
  }

  // Add shebang to output
  const outPath = './dist/cli.js';
  const content = await Bun.file(outPath).text();
  if (!content.startsWith('#!')) {
    await Bun.write(outPath, `#!/usr/bin/env node\n${content}`);
  }

  console.log('');
  console.log(`Build complete → dist/cli.js`);

  // Print size
  const stat = await Bun.file(outPath).size;
  console.log(`Output size: ${(stat / 1024 / 1024).toFixed(1)} MB`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
