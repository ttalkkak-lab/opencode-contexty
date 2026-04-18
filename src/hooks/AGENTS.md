# HOOKS KNOWLEDGE BASE

**Context:** OpenCode Integration Hooks

## OVERVIEW
Integration points that intercept OpenCode events to trigger HSCMM context modification and AASM supervision.

## WHERE TO LOOK
| Task | Location | Notes |
|------|----------|-------|
| **AASM Intercept** | `chatMessage.aasm.ts` | Intercepts user messages to run intent analysis |
| **HSCMM Transform** | `messagesTransform.hscmm.ts` | Modifies outgoing messages to inject/filter context |
| **Registry** | `index.ts` | Exports hooks for the plugin system |

## CONVENTIONS
- **Naming**: `*.aasm.ts` for AASM logic, `*.hscmm.ts` for HSCMM logic.
- **Async Non-Blocking**: Hooks must return promises and should not block the UI thread for long.
- **Error Handling**: Hooks must catch errors gracefully; a failing hook should not crash the IDE.

## ANTI-PATTERNS
- **Heavy Computation**: Do not perform expensive operations directly in the hook. Delegate to background workers/tools.
- **Side Effects**: `messages-transform` should only modify the messages, not trigger unrelated UI actions.
