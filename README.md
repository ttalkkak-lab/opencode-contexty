
> [!NOTE]
>
> **opencode-contexty** is a plugin for [OpenCode](https://github.com/sst/opencode) that brings "Vibe Engineering" to AI-assisted development.
>
> Stop fighting context windows. Start feeling your code.

> [!TIP]
>
> **Quick Start**: One command to install. AASM watches your back. HSCMM gives you control.
>
> ```bash
> bunx @ttalkkak-lab/opencode-contexty init
> ```

<!-- <CENTERED SECTION FOR GITHUB DISPLAY> -->

<div align="center">

# opencode-contexty

### Vibe Engineering for OpenCode

**HSCMM** (Human-supervised Context Management) + **AASM** (Active Agent-supervised Architecture) + **TLS** (Terminal Log Supervision)

[![npm version](https://img.shields.io/npm/v/@ttalkkak-lab/opencode-contexty?color=369eff&labelColor=black&logo=npm&style=flat-square)](https://www.npmjs.com/package/@ttalkkak-lab/opencode-contexty)
[![License](https://img.shields.io/badge/license-MIT-white?labelColor=black&style=flat-square)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.4-blue?labelColor=black&logo=typescript&style=flat-square)](https://www.typescriptlang.org/)
[![Bun](https://img.shields.io/badge/Bun-runtime-f472b6?labelColor=black&logo=bun&style=flat-square)](https://bun.sh/)

[English](README.md) | [한국어](README.ko.md)

</div>

<!-- </CENTERED SECTION FOR GITHUB DISPLAY> -->

---

## The Problem

You've been there:

- **The "New Chat Dilemma"**: Start fresh, lose all context. Continue, drown in irrelevant history.
- **The "Productivity Paradox"**: AI writes code fast, but fixing architectural disasters takes longer than writing it yourself.
- **The "Black Box Frustration"**: What's actually in the AI's context? Who knows.

**These aren't feature requests. They're existential threats to AI-assisted development.**

## The Solution: Vibe Engineering

What if you could _feel_ your context? What if the AI had a senior architect watching every prompt?

That's **Vibe Engineering**:

1. **HSCMM** — You control what the AI sees. Explicitly. Transparently.
2. **AASM** — An active agent that lints your _intent_, not just your code.
3. **TLS** — An intelligent wrapper that summarizes your terminal outputs.

---

## Contents

- [The Problem](#the-problem)
- [The Solution: Vibe Engineering](#the-solution-vibe-engineering)
- [Features](#features)
  - [AASM: Your Architectural Guardian](#aasm-your-architectural-guardian)
  - [HSCMM: Context You Can See](#hscmm-context-you-can-see)
  - [TLS: Terminal Log Supervision](#tls-terminal-log-supervision)
- [Installation](#installation)
- [Usage](#usage)
- [Configuration](#configuration)
- [How It Works](#how-it-works)
- [Philosophy](#philosophy)

---

## Features

### AASM: Your Architectural Guardian

> "Put everything in main.ts" — **BLOCKED.**

AASM analyzes your prompts _before_ the AI acts. It detects:

| Anti-Pattern         | What AASM Catches                                      |
| -------------------- | ------------------------------------------------------ |
| **Monolithic Files** | "Add all logic to index.ts"                            |
| **God Objects**      | "Create a Manager class that handles everything"       |
| **Global State**     | "Use a shared mutable object"                          |
| **Tight Coupling**   | "Make ComponentA directly call ComponentB's internals" |
| **Mixed Concerns**   | "Put database queries in the React component"          |

**Three severity levels:**

- 🚫 **Critical**: Request blocked. You must rephrase or disable AASM.
- ⚠️ **Warning**: AI proceeds with caution, explains risks.
- 💡 **Advisory**: Information only, no blocking.

```bash
# Enable active supervision
/agent active

# Disable (when you know what you're doing)
/agent passive

# Check current mode
/agent status
```

### HSCMM: Context You Can See

> "What's in the AI's context right now?"
>
> With HSCMM: You always know.

HSCMM persists all tool interactions to `.contexty/tool-parts.json`. Combined with our **VSCode Extension**, you get:

- 👁️ **Visual Context Inspector** — See exactly what's in the AI's context window via Context Explorer
- 🎯 **Manual Context Control** — Add files, folders, or text selections to context with one click
- ✂️ **Remove from Context** — Exclude unwanted parts with inline remove buttons
- 🔦 **Context Highlighting** — Lines in context are highlighted directly in the editor

**No more guessing. No more "the AI forgot everything." You see it. You control it.**

```
┌─────────────────────────────────────────┐
│  Context Explorer                       │
│  ├─ 📁 src/                             │
│  │   ├─ 📄 index.ts                     │
│  │   │   └─ L1-50: import { ... }   ✕   │
│  │   └─ 📄 aasm/LLMLinter.ts            │
│  │       └─ Full file             ✕     │
│  └─ 📁 tests/                           │
│      └─ 📄 example.test.ts              │
└─────────────────────────────────────────┘
```

The plugin automatically captures tool logs. The extension lets you _see_ and _manage_ them.

### TLS: Terminal Log Supervision

> "Did the build fail? Why?" — **Summarized.**

TLS wraps your terminal commands and uses AI to summarize the output. It categorizes results into Success, Warning, or Error, so you don't have to parse thousands of lines of logs to find the issue.

```bash
# Wrap any command with 'tls'
tls npm run build
tls git status
```

**Output Example:**
```
----------------------------------------------------
npm run build
----------------------------------------------------
... (verbose output hidden/summarized) ...
----------------------------------------------------
summary:
 Status: Error
 - Build failed in src/index.ts
 - Type mismatch on line 42: Argument of type 'string' is not assignable to parameter of type 'number'.
```

---

## Installation

### For Humans

Install opencode-contexty with a single command:

```bash
bunx @ttalkkak-lab/opencode-contexty init
```

The CLI will:
- Install and register the plugin in your OpenCode configuration
- Set up the IDE extension (VSCode, Cursor, Windsurf, etc.)
- Create `contexty.config.json` with your preferences
- Validate the installation

**Requirements**: [OpenCode](https://opencode.ai) must be installed first.

### For LLM Agents

Paste this into your LLM agent session:

```
Install and configure opencode-contexty by following the instructions here:
https://raw.githubusercontent.com/ttalkkak-lab/opencode-contexty/refs/heads/main/installation.md
```

Your LLM agent will handle the entire setup process automatically.

---

For detailed installation options and configuration, see the [installation guide](installation.md).

---

## VSCode Extension

The **Context Explorer** extension is automatically installed during setup and provides a visual interface for managing context items.

### Features

| Feature                  | Description                                                                                       |
| ------------------------ | ------------------------------------------------------------------------------------------------- |
| **Context Explorer**     | Hierarchical tree view in the Explorer sidebar showing all files with context parts               |
| **Drag & Drop**          | Drag files or folders directly into Context Explorer to add them to context                       |
| **Add Files to Context** | Right-click files/folders to add to context                                                       |
| **Add Selections**       | Select text and add via right-click, status bar button, or CodeLens overlay                       |
| **Remove from Context**  | Inline remove buttons on parts and files in the tree view                                         |
| **Context Highlighting** | Lines included in context are highlighted with a light blue background in the editor              |
| **Auto-Refresh**         | Tree view automatically updates when files change                                                 |
| **Blacklist Support**    | Removed parts are stored in `.contexty/tool-parts.blacklist.json` for permanent exclusion         |

### Why a Separate Extension?

The OpenCode plugin captures data. The VSCode extension displays it. This separation means:

1. **No terminal clutter** — Your OpenCode stays clean
2. **Rich UI** — Trees, icons, and inline actions that terminals can't do
3. **Persistent view** — Context Explorer stays open while you work
4. **IDE integration** — Click a file in context → opens in editor

---

## Usage

Once installed, **it just works**.

### AASM Commands

| Command          | Description                               |
| ---------------- | ----------------------------------------- |
| `/agent active`  | Enable architecture supervision (default) |
| `/agent passive` | Disable supervision                       |
| `/agent status`  | Show current mode and settings            |

### HSCMM: Automatic Context Capture

HSCMM runs silently in the background:

1. **Every tool call** is logged to `.contexty/tool-parts.json`
2. **VSCode Extension** reads this file and displays it visually
3. **You manage context** through the extension UI, not commands

No commands needed. The plugin captures. The extension displays. You control.

### What Happens When AASM Blocks

When you request something architecturally dangerous:

1. **Toast notification** appears explaining the violation
2. **Request is replaced** with a system instruction
3. **AI responds** explaining why it can't proceed
4. **You decide**: rephrase your request or disable AASM

Example:

```
You: "Put all the code in one big main.ts file"

🚫 AASM - Request Blocked
❌ Monolithic main file detected
💡 Split into modules based on responsibility

To disable: "Set agent to passive mode"
```

---

## Configuration

Create `contexty.config.json` in your project root:

```json
{
  "aasm": {
    "enabled": true,
    "mode": "active",
    "enableLinting": true,
    "confidenceThreshold": 0.7,
    "model": "claude-sonnet-4-20250514"
  },
  "tls": {
    "enabled": true,
    "model": "claude-sonnet-4-20250514"
  }
}
```

| Option                     | Type                      | Default        | Description                        |
| -------------------------- | ------------------------- | -------------- | ---------------------------------- |
| `aasm.enabled`             | boolean                   | `true`         | Enable AASM globally               |
| `aasm.mode`                | `"active"` \| `"passive"` | `"active"`     | Supervision mode                   |
| `aasm.enableLinting`       | boolean                   | `true`         | Enable LLM-based linting           |
| `aasm.confidenceThreshold` | number                    | `0.7`          | Minimum confidence for suggestions |
| `aasm.model`               | string                    | (host default) | LLM model for linting              |
| `tls.enabled`              | boolean                   | `true`         | Enable TLS globally                |
| `tls.model`                | string                    | (host default) | LLM model for summarization        |

---

## How It Works

### Architecture

```
User Prompt
    │
    ▼
┌─────────────────────────────────────┐
│  chat.message hook (AASM)           │
│  ├─ Intent Analysis (local)         │
│  └─ LLM Lint (subsession)           │
│      ├─ Critical → BLOCK            │
│      ├─ Warning → ADVISE            │
│      └─ Advisory → PASS             │
└─────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────┐
│  messages.transform hook (HSCMM)    │
│  ├─ Persist tool logs               │
│  └─ Inject context                  │
└─────────────────────────────────────┘
    │
    ▼
LLM Response
```

### Key Components

| Component                  | Location                       | Role                           |
| -------------------------- | ------------------------------ | ------------------------------ |
| `AASMModule`               | `src/aasm/index.ts`            | Main supervision orchestrator  |
| `IntentAnalyzer`           | `src/aasm/index.ts`            | Local intent classification    |
| `LLMLinter`                | `src/aasm/LLMLinter.ts`        | LLM-based architecture linting |
| `SubsessionHelper`         | `src/aasm/SubsessionHelper.ts` | Manages LLM subsessions        |
| `createHSCMMTransformHook` | `src/hscmm/transformer.ts`     | Context transformation         |
| `TLSModule`                | `src/tls/index.ts`             | Terminal Log Supervision       |
| `createTLSCommandHook`     | `src/hooks/command-execute-before.tls.ts` | Intercepts 'tls' command       |

---

## Philosophy

### Why "Vibe Engineering"?

Traditional engineering is about rules, types, and tests. **Vibe Engineering** adds intuition.

When you're deep in flow, you _feel_ when code is right. You _sense_ when architecture is drifting. But AI doesn't have that intuition—**unless you give it tools to develop one.**

AASM is that tool. It's not a linter that checks semicolons. It's a **senior architect** that reviews your _intentions_ before they become technical debt.

### The Ddalkkak Philosophy

This project comes from **ttalkkak-lab** (딸깍 연구소).

"Ddalkkak" (딸깍) is the Korean onomatopoeia for a click—the satisfying snap of something fitting perfectly into place. That's what we're building: tools that just _click_.

No configuration wrestling. No documentation spelunking. Install, and it works. That's ddalkkak.

---

## License

MIT © [ttalkkak-lab](https://github.com/ttalkkak-lab)

---

<div align="center">

**Stop drowning in context. Start vibing with your code.**

[Report Bug](https://github.com/ttalkkak-lab/opencode-contexty/issues) · [Request Feature](https://github.com/ttalkkak-lab/opencode-contexty/issues)

</div>
