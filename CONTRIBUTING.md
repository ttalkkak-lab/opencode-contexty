# Contributing to opencode-contexty

Thanks for taking the time to contribute! This document provides guidelines for contributing to opencode-contexty.

## Table of Contents

- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Development Setup](#development-setup)
  - [Testing Your Changes Locally](#testing-your-changes-locally)
- [Project Structure](#project-structure)
- [Development Workflow](#development-workflow)
  - [Build Commands](#build-commands)
- [Making Changes](#making-changes)
  - [Adding HSCMM Features](#adding-hscmm-features)
  - [Adding AASM Features](#adding-aasm-features)
  - [Adding TLS Features](#adding-tls-features)
  - [Adding a New Hook](#adding-a-new-hook)
  - [Adding a New Tool](#adding-a-new-tool)
- [Pull Request Process](#pull-request-process)
- [Getting Help](#getting-help)

## Getting Started

### Prerequisites

- **Bun** (≥1.0.0) — Package manager and runtime
- **TypeScript 5.4+**
- **OpenCode 1.0.150+** — For testing the plugin
- **VSCode / Cursor / Windsurf** (optional) — For testing the Context Explorer extension

### Development Setup

```bash
git clone https://github.com/ttalkkak-lab/opencode-contexty.git
cd opencode-contexty

# Install dependencies (bun only)
bun install

# Build the project
bun run build
```

### Testing Your Changes Locally

1. **Build**:
   ```bash
   bun run build
   ```

2. **Point OpenCode to your local build** (`~/.config/opencode/opencode.json`):
   ```json
   {
     "plugin": [
       "file:///absolute/path/to/opencode-contexty/dist/index.js"
     ]
   }
   ```

   > Remove `"@ttalkkak-lab/opencode-contexty"` from the plugin array if it exists, to avoid conflicts with the npm version.

3. **Restart OpenCode** and verify with `/agent-status`.

## Project Structure

```
src/
├── index.ts                              # Plugin entry point (ContextyPlugin)
├── cli/
│   └── index.ts                          # CLI: `opencode-contexty init`
├── hscmm/                                # Human-Supervised Context Management
│   ├── index.ts                          # Re-exports
│   ├── transformer.ts                    # Context transformation logic
│   ├── transformer.test.ts               # Transformer tests
│   └── storage.ts                        # Tool log persistence (.contexty/)
├── aasm/                                 # Active Agent-Supervised Architecture
│   ├── index.ts                          # AASMModule, IntentAnalyzer
│   ├── llmLinter.ts                      # LLM-based architecture linting
│   ├── llmLinter.test.ts                 # llmLinter tests
│   ├── subsessionHelper.ts               # LLM subsession management
│   ├── subsessionHelper.test.ts          # subsessionHelper tests
│   └── prompts.ts                        # Lint prompt builder & parser
├── tls/                                  # Terminal Log Summarization
│   ├── index.ts                          # TLSModule
│   ├── shell.ts                          # Shell command executor
│   ├── tuiController.ts                  # Toast UI feedback
│   ├── prompts.ts                        # Summarization & output prompts
│   └── types.ts                          # TlsResult, BunShellOutput
├── hooks/                                # OpenCode integration hooks
│   ├── index.ts                          # Re-exports
│   ├── chatMessage.aasm.ts              # AASM: intercept user messages
│   ├── messagesTransform.hscmm.ts       # HSCMM: persist & inject tool parts
│   └── commandExecuteBefore.tls.ts     # TLS: intercept /tls command
├── tools/                                # Agent tools
│   ├── index.ts                          # Re-exports
│   └── agent.ts                          # AASM mode control (/agent-*)
├── types/
│   └── index.ts                          # Core interfaces
└── utils/
    └── index.ts                          # FileSystem, TokenEstimator, Logger, etc.
```

## Development Workflow

### Build Commands

```bash
bun run build       # TypeScript compilation → dist/
bun run dev         # Watch mode (tsc --watch)
bun test            # Run tests
bun run lint        # ESLint
bun run format      # Prettier
```

## Making Changes

### Adding HSCMM Features

HSCMM handles context persistence and transformation.

- **Storage** (`src/hscmm/storage.ts`): Tool log read/write to `.contexty/sessions/<sessionId>/tool-parts.json`
- **Transformation** (`src/hscmm/transformer.ts`): Extract tool parts from messages, deduplicate, respect blacklist, re-inject with metadata
- Tests: `src/hscmm/transformer.test.ts`

### Adding AASM Features

AASM handles intent analysis and architecture linting.

1. **New anti-pattern detection** — modify `src/aasm/prompts.ts`:
   ```typescript
   // Add to the anti-pattern list in buildLintPrompt()
   const antiPatterns = [
     // ... existing patterns
     'New anti-pattern description',
   ];
   ```

2. **New intent types** — update `src/aasm/index.ts`:
   ```typescript
   // Add to IntentAnalyzer keyword patterns
   private static readonly INTENT_KEYWORDS = {
     refactor: ['refactor', 'restructure', ...],
     feature: ['add', 'create', ...],
     migration: ['migrate', 'upgrade', 'convert', ...],
   };
   ```

3. Tests: `src/aasm/llmLinter.test.ts`, `src/aasm/subsessionHelper.test.ts`

### Adding TLS Features

TLS wraps terminal commands and summarizes output via LLM. Results are also persisted to HSCMM.

- **Shell execution** (`src/tls/shell.ts`): Command execution via Bun shell, returns `BunShellOutput`
- **Summarization** (`src/tls/index.ts`): LLM-based output summarization through subsessionHelper
- **Prompts** (`src/tls/prompts.ts`): Summarization prompt and output template
- **UI feedback** (`src/tls/tuiController.ts`): Animated toast notifications for progress/success/fail
- **Types** (`src/tls/types.ts`): `TlsResult`, `BunShellOutput`

### Adding a New Hook

1. Create `src/hooks/<hook-name>.<module>.ts`:
   ```typescript
   import type { OpencodeClient } from '@opencode-ai/plugin';

   export function createMyHook(client: OpencodeClient) {
     return async () => {
       // Hook implementation
     };
   }
   ```

2. Export from `src/hooks/index.ts`

3. Register in `src/index.ts`:
   ```typescript
   return {
     // ... existing hooks
     'hook.name': createMyHook(client),
   };
   ```

### Adding a New Tool

1. Create `src/tools/my-tool.ts`:
   ```typescript
   import { tool } from '@opencode-ai/plugin';

   export function createMyTool() {
     return tool({
       description: 'What this tool does',
       args: {
         param: tool.schema.string().describe('Parameter description'),
       },
       async execute(args) {
         return { result: 'success' };
       },
     });
   }
   ```

2. Export from `src/tools/index.ts`

3. Register in `src/index.ts`:
   ```typescript
   return {
     tool: {
       aasm: createAgentTool(aasm),
       myTool: createMyTool(),
     },
     // ... hooks
   };
   ```

## Pull Request Process

1. **Fork** the repository and create your branch from `main`
2. **Make changes** following the conventions above
3. **Build and test** locally:
   ```bash
   bun run lint
   bun run build
   bun test
   ```
4. **Test in OpenCode** using the local build method described above
5. **Commit** with clear messages in present tense ("Add feature" not "Added feature")
6. **Push** and create a Pull Request

### PR Checklist

- [ ] `bun run lint` passes
- [ ] `bun run build` succeeds
- [ ] `bun test` passes
- [ ] Tested locally with OpenCode
- [ ] Updated documentation if needed
- [ ] No version changes in `package.json`
- [ ] HSCMM, AASM, TLS concerns remain properly separated

## Getting Help

- **Code Patterns**: Review existing implementations in `src/`
- **Issues**: Open an issue for bugs or feature requests
- **Discussions**: Start a discussion for questions or ideas

---

Thank you for contributing to opencode-contexty!
