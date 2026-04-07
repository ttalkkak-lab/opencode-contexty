> [!NOTE]
>
> **opencode-contexty** is a plugin for [OpenCode](https://github.com/sst/opencode) that brings "Context Engineering" to AI-assisted development.
>
> Stop fighting context windows. Start feeling your code.

> [!TIP]
>
> **Quick Start**: One command to install.
>
> ```bash
> bunx @ttalkkak-lab/opencode-contexty init
> ```

<!-- <CENTERED SECTION FOR GITHUB DISPLAY> -->

<div align="center">

# opencode-contexty

### Context Engineering for OpenCode

**HSCMM** (Human-supervised Context Management) + **AASM** (Active Agent-supervised Architecture) + **ACPM** (Active Context Permission Management) + **TLS** (Terminal Log Supervision)

[![npm version](https://img.shields.io/npm/v/@ttalkkak-lab/opencode-contexty?color=369eff&labelColor=black&logo=npm&style=flat-square)](https://www.npmjs.com/package/@ttalkkak-lab/opencode-contexty)
[![License](https://img.shields.io/badge/license-Apache%202.0-white?labelColor=black&style=flat-square)](LICENSE)
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
- **The "Black Box"**: What's actually in the AI's context? Who knows.

These aren't feature requests. They're existential threats to AI-assisted development.

## Context Engineering

What if you could _feel_ your context? What if a senior architect reviewed every prompt?

That's Context Engineering.

1. **HSCMM** — You control what the AI sees. Explicitly. Transparently.
2. **AASM** — An active agent that lints your _intent_, not just your code.
3. **ACPM** — Permission management that controls what tools and folders the AI can access.
4. **TLS** — An intelligent wrapper that summarizes terminal outputs.

---

## Features

### HSCMM: Context You Can See

HSCMM persists all tool interactions to `.contexty/tool-parts.json`. Combined with the **VSCode Extension**:

- **Context Explorer** — See exactly what's in the AI's context via a tree view
- **Manual Control** — Add files, folders, or text selections to context with one click
- **Inline Remove** — Exclude unwanted parts with remove buttons
- **Highlighting** — Lines in context are highlighted directly in the editor

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

No more guessing. No more "the AI forgot everything." You see it. You control it.

### AASM: Your Architectural Guardian

> "Put everything in main.ts" — **BLOCKED.**

AASM analyzes prompts _before_ the AI acts.

| Anti-Pattern         | What AASM Catches                                      |
| -------------------- | ------------------------------------------------------ |
| **Monolithic Files** | "Add all logic to index.ts"                            |
| **God Objects**      | "Create a Manager class that handles everything"       |
| **Global State**     | "Use a shared mutable object"                          |
| **Tight Coupling**   | "Make ComponentA directly call ComponentB's internals" |
| **Mixed Concerns**   | "Put database queries in the React component"          |

3 severity levels:

- **Critical** — Blocked. Rephrase or disable AASM.
- **Warning** — Proceeds with caution, risks explained.
- **Advisory** — Information only, no blocking.

```bash
# Enable active supervision
/agent-active

# Disable
/agent-passive

# Check status
/agent-status
```

### ACPM: Permission Management

> "The AI wants to run `rm -rf /`?" — **DENIED.**

ACPM controls what the AI can touch before it touches anything. Two levels:

- **Tool categories** — `file-read`, `file-write`, `shell`, `web`, `lsp`, `mcp`, each individually toggleable
- **Folder permissions** — `denied`, `read-only`, `read-write` per path. Longest path match wins.

Presets live in `.contexty/permissions.json`. Save permission sets, switch between them, keep workflows separate. No active preset = allow-all.

Each session can carry its own active preset in `.contexty/sessions/{id}/active-preset.json`, so permissions stay scoped to the work.

```bash
# Current permission status
acpm status

# List presets
acpm list

# Switch preset
acpm switch <name>

# Reload from disk
acpm reload
```

The CLI setup wizard walks through ACPM during `bunx @ttalkkak-lab/opencode-contexty init`, so you can set up presets without touching files.

Under the hood: hooks check tool execution before and after every run, intercept permission prompts, block unsafe actions with a toast, sanitize outputs, and inject current rules into the system prompt.

### TLS: Terminal Log Supervision

> "Did the build fail? Why?" — **Summarized.**

TLS wraps terminal commands and uses AI to summarize output. Categorizes into Success, Warning, or Error.

```bash
/tls npm run build
/tls git status
```

```
----------------------------------------------------
npm run build
----------------------------------------------------
summary:
 Status: Error
 - Build failed in src/index.ts
 - Type mismatch on line 42: 'string' not assignable to 'number'.
```

---

## Installation

### For Humans

```bash
bunx @ttalkkak-lab/opencode-contexty init
```

This will:

- Register the plugin in your OpenCode configuration
- Set up the IDE extension (VSCode, Cursor, Windsurf, etc.)
- Create `contexty.config.json`
- Validate the installation

**Requirements**: [OpenCode](https://opencode.ai) must be installed first.

### For LLM Agents

Paste this into your LLM agent session:

```
Install and configure opencode-contexty by following the instructions here:
https://raw.githubusercontent.com/ttalkkak-lab/opencode-contexty/refs/heads/main/installation.md
```

The rest is handled by the LLM.

---

For detailed options, see the [installation guide](installation.md).

---

## VSCode Extension

**Context Explorer** extension is auto-installed during setup.

| Feature              | Description                                                                           |
| -------------------- | ------------------------------------------------------------------------------------- |
| **Context Explorer** | Hierarchical tree view in the Explorer sidebar showing all files with context parts   |
| **Drag & Drop**      | Drag files or folders into Context Explorer to add to context                         |
| **Add Files**        | Right-click files/folders to add to context                                           |
| **Add Selections**   | Select text, add via right-click, status bar, or CodeLens                             |
| **Remove**           | Inline remove buttons on parts and files in the tree view                             |
| **Highlighting**     | Lines in context highlighted with a light blue background in the editor               |
| **Auto-Refresh**     | Tree view updates when files change                                                   |
| **Blacklist**        | Removed parts stored in `.contexty/tool-parts.blacklist.json` for permanent exclusion |

### Why a Separate Extension?

The plugin captures data. The extension displays it.

1. **No terminal clutter** — OpenCode stays clean
2. **Rich UI** — Trees, icons, inline actions
3. **Persistent view** — Context Explorer stays open while you work
4. **IDE integration** — Click a file in context, opens in editor

---

## Configuration

Create `contexty.config.json` in your project root:

```json
{
  "acpm": {
    "defaultPreset": "default"
  },
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

| Option                     | Type                      | Default        | Description                                       |
| -------------------------- | ------------------------- | -------------- | ------------------------------------------------- |
| `acpm.defaultPreset`       | string                    | (none)         | Default permission preset name to load on startup |
| `aasm.enabled`             | boolean                   | `true`         | Enable AASM globally                              |
| `aasm.mode`                | `"active"` \| `"passive"` | `"active"`     | Supervision mode                                  |
| `aasm.enableLinting`       | boolean                   | `true`         | Enable LLM-based linting                          |
| `aasm.confidenceThreshold` | number                    | `0.7`          | Minimum confidence for suggestions                |
| `aasm.model`               | string                    | (host default) | LLM model for linting                             |
| `tls.enabled`              | boolean                   | `true`         | Enable TLS globally                               |
| `tls.model`                | string                    | (host default) | LLM model for summarization                       |

---

## The Ddalkkak Philosophy

From **ttalkkak-lab** (딸깍 연구소).

"Ddalkkak" (딸깍) is the Korean onomatopoeia for a click — the snap of something fitting perfectly into place. That's what we're building: tools that just _click_.

No configuration wrestling. No documentation spelunking. Install, and it works. That's ddalkkak.

---

## License

Apache-2.0 © [ttalkkak-lab](https://github.com/ttalkkak-lab)

---

<div align="center">

**Stop drowning in context. Start vibing with your code.**

[Report Bug](https://github.com/ttalkkak-lab/opencode-contexty/issues) · [Request Feature](https://github.com/ttalkkak-lab/opencode-contexty/issues)

</div>
