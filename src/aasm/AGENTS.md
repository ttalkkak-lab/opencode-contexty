# AASM KNOWLEDGE BASE

**Context:** Active Agent-supervised Architecture (AASM)

## OVERVIEW
The "Active Agent" supervision layer that validates user intent and enforces architectural integrity in real-time.

## WHERE TO LOOK
| Task | Location | Notes |
|------|----------|-------|
| **Lint Logic** | `LLMLinter.ts` | Core linter for detecting anti-patterns |
| **Intent Analysis** | `SubsessionHelper.ts` | Classifies user intent (refactor/feature/fix) |
| **Prompts** | `prompts.ts` | System prompts for the supervision agent |
| **Entry** | `index.ts` | Module initialization |

## CONVENTIONS
- **Intent-First**: Every user message is analyzed for intent before execution.
- **Non-Blocking**: Linter runs in parallel with response generation where possible.

## ANTI-PATTERNS
- **Monolithic Logic**: NEVER allow logic to accumulate in a single file (e.g., `main.ts`). AASM explicitly flags this.
- **Silent Failures**: Supervising agent must always report why it blocked an action.
- **Direct Execution**: AASM suggests changes; it does not execute them without user consent (unless high confidence).
