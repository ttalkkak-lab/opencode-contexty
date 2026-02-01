# Contributing to opencode-contexty

First off, thanks for taking the time to contribute! This document provides guidelines and instructions for contributing to opencode-contexty.

## Table of Contents

- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Development Setup](#development-setup)
  - [Testing Your Changes Locally](#testing-your-changes-locally)
- [Project Structure](#project-structure)
- [Development Workflow](#development-workflow)
  - [Build Commands](#build-commands)
- [Making Changes](#making-changes)
  - [Adding AASM Features](#adding-aasm-features)
  - [Adding HSCMM Features](#adding-hscmm-features)
  - [Adding a New Hook](#adding-a-new-hook)
  - [Adding a New Tool](#adding-a-new-tool)
- [Pull Request Process](#pull-request-process)
- [Getting Help](#getting-help)

## Getting Started

### Prerequisites
EX)
- **Bun** (latest version) - The only supported package manager and runtime
- **TypeScript 5.4+** - For type checking and declarations
- **OpenCode 1.0.150+** - For testing the plugin
- **VSCode** (optional) - For testing the Mirror Explorer extension

### Development Setup
EX)
```bash
# Clone the repository
git clone https://github.com/ttalkkak-lab/opencode-contexty.git
cd opencode-contexty

# Install dependencies (bun only - never use npm/yarn)
bun install

# Build the project
bun run build
```

### Testing Your Changes Locally
EX)
After making changes, you can test your local build in OpenCode:

1. **Build the project**:
   ```bash
   bun run build
   ```

2. **Update your OpenCode config** (`~/.config/opencode/opencode.json` or `opencode.jsonc`):
   ```json
   {
     "plugin": [
       "file:///absolute/path/to/opencode-contexty/dist/index.js"
     ]
   }
   ```

   For example, if your project is at `/Users/yourname/projects/opencode-contexty`:
   ```json
   {
     "plugin": [
       "file:///Users/yourname/projects/opencode-contexty/dist/index.js"
     ]
   }
   ```

   > **Note**: Remove `"@ttalkkak-lab/opencode-contexty"` from the plugin array if it exists, to avoid conflicts with the npm version.

3. **Restart OpenCode** to load the changes.

4. **Verify** the plugin is loaded by running `/agent status` to check AASM availability.

## Project Structure

```
opencode-contexty/
├── src/
│   ├── aasm/              # Active Agent-Supervised Architecture
│   │   ├── index.ts       # AASMModule, IntentAnalyzer
│   │   ├── LLMLinter.ts   # LLM-based architecture linting
│   │   ├── SubsessionHelper.ts  # LLM subsession management
│   │   └── prompts.ts     # Lint prompt building
│   ├── hscmm/             # Human-Supervised Context Management
│   │   ├── index.ts       # HSCMM exports
│   │   ├── transformer.ts # Context transformation hook
│   │   └── storage.ts     # Tool log persistence
│   ├── hooks/             # OpenCode integration hooks
│   │   ├── chat-message.aasm.ts      # AASM chat hook
│   │   └── messages-transform.hscmm.ts  # HSCMM transform hook
│   ├── tools/             # Agent tools
│   │   └── agent.ts       # AASM mode control tool
│   ├── types/             # TypeScript interfaces
│   ├── utils/             # Common utilities
│   └── index.ts           # Main plugin entry (ContextyPlugin)
├── dist/                  # Build output
├── .contexty/             # Runtime data (tool-parts.json, blacklist)
├── opencode.json          # OpenCode plugin configuration
├── contexty.config.json   # Plugin-specific configuration
└── tsconfig.json          # TypeScript configuration
```

## Development Workflow

### Build Commands
EX
```bash
# Type check only
bun run tsc --noEmit

# Full build (TypeScript compilation)
bun run build

# Watch mode for development
bun run dev

# Run tests
bun test

# Lint code
bun run lint

# Format code
bun run format
```

## Making Changes

### Adding AASM Features

EX)

AASM (Active Agent-Supervised Architecture) handles intent analysis and architecture linting.

1. For **new anti-pattern detection**, modify `src/aasm/prompts.ts`:
   ```typescript
   // Add to the anti-pattern list in buildLintPrompt()
   const antiPatterns = [
     // ... existing patterns
     'New anti-pattern description',
   ];
   ```

2. For **new intent types**, update `src/aasm/index.ts`:
   ```typescript
   // Add to IntentAnalyzer keyword patterns
   private static readonly INTENT_KEYWORDS = {
     refactor: ['refactor', 'restructure', ...],
     feature: ['add', 'create', ...],
     // Add new intent type here
     migration: ['migrate', 'upgrade', 'convert', ...],
   };
   ```

3. Add tests in `src/aasm/*.test.ts`

### Adding HSCMM Features

HSCMM (Human-Supervised Context Management) handles context persistence and transformation.

1. For **storage modifications**, update `src/hscmm/storage.ts`
2. For **transformation logic**, modify `src/hscmm/transformer.ts`
3. Add tests in `src/hscmm/*.test.ts`

### Adding a New Hook

1. Create a new file in `src/hooks/` with naming pattern `[name].[module].ts`:
   ```typescript
   // src/hooks/session-start.aasm.ts
   import type { OpencodeClient } from '@opencode-ai/plugin';
   import type { AASMModule } from '../aasm';

   export function createSessionStartHook(aasm: AASMModule, client: OpencodeClient) {
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
     'session.start': createSessionStartHook(aasm, client),
   };
   ```

### Adding a New Tool
EX)
1. Create the tool in `src/tools/`:
   ```typescript
   // src/tools/my-tool.ts
   import { tool } from '@opencode-ai/plugin';

   export function createMyTool() {
     return tool({
       description: 'Description of what this tool does',
       args: {
         param: tool.schema.string().describe('Parameter description'),
       },
       async execute(args) {
         // Tool implementation
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
   bun run lint       # Ensure no lint errors
   bun run build      # Ensure build succeeds
   bun test           # Ensure all tests pass
   ```
4. **Test in OpenCode** using the local build method described above
5. **Commit** with clear, descriptive messages:
   - Use present tense ("Add feature" not "Added feature")
   - Reference issues if applicable ("Fix #123")
6. **Push** to your fork and create a Pull Request
7. **Describe** your changes clearly in the PR description

### PR Checklist
EX)
- [ ] Code follows project conventions
- [ ] `bun run lint` passes
- [ ] `bun run build` succeeds
- [ ] `bun test` passes
- [ ] Tested locally with OpenCode
- [ ] Updated documentation if needed (README.md, AGENTS.md)
- [ ] No version changes in `package.json`
- [ ] AASM and HSCMM concerns remain properly separated

## Getting Help

- **Project Knowledge**: Check `AGENTS.md` for detailed project documentation
- **Code Patterns**: Review existing implementations in `src/`
- **Issues**: Open an issue for bugs or feature requests
- **Discussions**: Start a discussion for questions or ideas


---

Thank you for contributing to opencode-contexty! Your efforts help make AI-assisted development better for everyone.