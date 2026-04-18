# PROJECT KNOWLEDGE BASE

**Generated:** 2026-01-28
**Context:** OpenCode Plugin for Vibe Engineering (HSCMM/AASM)

## OVERVIEW
**opencode-contexty** is an OpenCode plugin enabling "Vibe Engineering" through **HSCMM** (Human-supervised Context Management) and **AASM** (Active Agent-supervised Architecture). It solves the "New Chat Dilemma" and "Productivity Paradox" by giving humans direct context control and agents architectural oversight.

## STRUCTURE
```
.
├── src/
│   ├── aasm/       # Active Agent Supervised Model (Linter, Intent)
│   ├── hscmm/      # Human Supervised Context Model (Transformer, Storage)
│   ├── hooks/      # OpenCode Integration Hooks
│   ├── tools/      # Agent Tools
│   └── index.ts    # Entry Point
├── dist/           # Compiled Output
└── opencode.json   # Plugin Config
```

## WHERE TO LOOK
| Task | Location | Notes |
|------|----------|-------|
| **Context Logic** | `src/hscmm/` | Context transformation, snapshot storage |
| **Agent Supervision** | `src/aasm/` | Architecture linting, intent analysis |
| **Message Intercept** | `src/hooks/` | Hooks for `chat-message` and `messages-transform` |
| **Plugin Setup** | `src/index.ts` | Main activation and registration |
| **Tests** | `*.test.ts` | Bun tests collocated with source |

## CODE MAP

| Symbol | Type | Location | Role |
|--------|------|----------|------|
| `HSCMM` | Module | `src/hscmm/index.ts` | Manages manual context control |
| `AASM` | Module | `src/aasm/index.ts` | Manages active supervision agent |
| `llmLinter` | Class | `src/aasm/llmLinter.ts` | Analyzes code for architectural violations |
| `ContextTransformer` | Class | `src/hscmm/transformer.ts` | Modifies context before sending to LLM |
| `subsessionHelper` | Class | `src/aasm/subsessionHelper.ts` | Handles sub-agent intent analysis |

## COMMANDS
```bash
# HSCMM (Context Control)
/ctx status           # View current context tokens/files
/ctx add <file>       # Add file to context
/ctx ignore <pattern> # Exclude pattern
/ctx save <name>      # Snapshot context state
/ctx load <name>      # Restore snapshot

# AASM (Supervision)
/agent active         # Enable active supervision
/agent passive        # Disable supervision
/agent status         # Check mode
```

## CONVENTIONS
- **Language**: TypeScript (Bun).
- **Modules**: Strict separation between `hscmm` (passive context) and `aasm` (active agent).
- **Hooks**: Use OpenCode hooks (`onChatMessage`, `onMessagesTransform`) to intercept interactions.
- **Testing**: Collocated `*.test.ts` files running with `bun test`.

## ANTI-PATTERNS (THIS PROJECT)
- **Direct Context Manipulation**: Do not manually modify context objects outside of `HSCMM` module.
- **Blocking Hooks**: Ensure hooks are async and non-blocking to prevent UI freeze.
- **Monolithic Logic**: AASM explicitly forbids monolithic files (e.g., giant `main.ts`).
- **Implicit State**: All state changes must be visible via `/ctx status` or `/agent status`.

## UNIQUE STYLES
- **Vibe Coding Focus**: Code is designed to be "felt" and managed intuitively, not just read.
- **Korean/English**: Documentation and UI messages often support dual languages (Project team: Korea Ddalkkak Lab).

## NOTES
- **TLS**: Terminal Logs Summarizing is an auxiliary feature (uses Ollama).
- **Bun**: Used for both runtime (dev) and build.
