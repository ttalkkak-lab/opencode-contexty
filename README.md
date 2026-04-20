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
> npx @ttalkkak-lab/opencode-contexty init
> ```

<!-- <CENTERED SECTION FOR GITHUB DISPLAY> -->

<div align="center">

# opencode-contexty

[teaser.webm](https://github.com/user-attachments/assets/6dbeab08-1245-4a40-b6fd-6e3d9e07682d)

### Context Engineering for OpenCode

**HSCMM** (Human-supervised Context Management) + **AASM** (Active Agent-supervised Architecture) + **ACPM** (Active Context Permission Management) + **TLS** (Terminal Log Supervision) + **DCP** (Dynamic Context Pruning)

[![npm version](https://img.shields.io/npm/v/@ttalkkak-lab/opencode-contexty?color=369eff&labelColor=black&logo=npm&style=flat-square)](https://www.npmjs.com/package/@ttalkkak-lab/opencode-contexty)
[![License](https://img.shields.io/badge/license-Apache%202.0-white?labelColor=black&style=flat-square)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.4-blue?labelColor=black&logo=typescript&style=flat-square)](https://www.typescriptlang.org/)
[![Bun](https://img.shields.io/badge/Bun-runtime-f472b6?labelColor=black&logo=bun&style=flat-square)](https://bun.sh/)

[English](README.md) | [한국어](README.ko.md)

</div>

<!-- </CENTERED SECTION FOR GITHUB DISPLAY> -->

---

## 1. Overview

The primary challenge in modern AI coding workflows is not 'speed' but 'direction'. Especially in large-scale projects, AI tends to lose overall context or destroy existing architectures for the sake of immediate functional implementation.

opencode-contexty focuses on three core values:

1. **Visibility**: Developers can monitor in real-time what the AI knows and what it doesn't.
2. **Control**: Developers precisely govern the AI's access permissions and reference scope.
3. **Sustainability**: It intervenes in real-time to prevent architecture debt caused by a beginner's incorrect prompts or an AI's short-term decision-making.

---

## 2. Key Systems

### 2.1 AASM (Active Agent-supervised Architecture)
**Real-time Prompt Guidance and Architectural Supervision for Beginners**

AASM is an intelligent agent that **intervenes at the prompt stage** before the AI begins its task. It corrects developers—especially those with less architectural experience—in real-time when they provide instructions that lead in the wrong direction.

* **Prompt-level Intervention**: When a user gives instructions that degrade quality, such as "Implement all features in one file" or "Write the API without validation logic," AASM immediately intervenes to suggest alternative architectures like separation of concerns or modularization.
* **Real-time Anti-pattern Analysis**: It detects and alerts users to anti-patterns like monolithic files, God Objects, or abuse of global states during the code generation process.
* **Decision Support**: Upon detecting an issue, it prompts the developer to make clear structural decisions through `keep` or `revert` commands.

### 2.2 HSCMM (Human-supervised Context Management)
**Visualized Context Control Center**

HSCMM ensures that the information the AI refers to is not a black box, providing an environment where users can visually inspect and edit the context.

* **Context Explorer**: Via the VSCode extension, users can visualize the files and code snippets currently 'remembered' by the AI in a tree format.
* **Manual Context Injection**: Users can drag and drop specific folders or files from the explorer to immediately feed them to the AI or remove unnecessary parts instantly.
* **Blacklist Function (/ban)**: Commands like `/ban @src/legacy` allow users to specify paths that the AI must never reference, blocking unnecessary noise.

### 2.3 ACPM (Active Context Permission Management)
**Sophisticated Tool and Path-based Permission Management**

ACPM physically restricts the AI's access scope to prevent it from damaging critical project files.

* **Categorical Tool Restriction**: Enable or disable AI tool usage by categories such as `file-read`, `file-write`, `shell`, `lsp`, and `web`.
* **Hierarchical Path Permissions**: Assign `denied`, `read-only`, or `read-write` permissions to specific directories. More specific path settings always take precedence.
* **Session-based Presets**: Quickly switch between permission profiles like 'Safe Mode' or 'Aggressive Refactoring Mode' depending on the situation.

### 2.4 TLS (Terminal Log Supervision)
**Intelligent Terminal Output Summarization**

TLS analyzes vast terminal outputs and compresses them into essential information for the developer.

* **Success/Failure Classification**: Quickly categorizes build or test results into `Success`, `Warning`, or `Error`.
* **Key Error Extraction**: Identifies and reports only the actual error locations and causes that require correction from hundreds of lines of logs.

---

## 3. Installation

### 3.1 CLI Installation
Run the following command in an environment where OpenCode is installed to start the installation wizard.

```bash
bunx @ttalkkak-lab/opencode-contexty init
```

This process performs the following:
1. Registration in the OpenCode plugin registry.
2. Installation of dedicated extensions for VSCode / Cursor.
3. Generation of the default configuration file (`contexty.config.json`) and permission presets.

### 3.2 Installation via LLM Session
If you are already in an AI session, you can use the following prompt to start the setup:

```text
Follow the instructions here to install and configure opencode-contexty for my project:
[https://raw.githubusercontent.com/ttalkkak-lab/opencode-contexty/refs/heads/main/installation.md](https://raw.githubusercontent.com/ttalkkak-lab/opencode-contexty/refs/heads/main/installation.md)
```

---

## 4. Configuration

You can adjust the system's sensitivity via `contexty.config.json`.

```json
{
  "$schema": "[https://unpkg.com/@ttalkkak-lab/opencode-contexty/schema.json](https://unpkg.com/@ttalkkak-lab/opencode-contexty/schema.json)",
  "aasm": {
    "mode": "active",
    "model": "openai/gpt-5.3-codex-spark"
  },
  "dcp": {
    "enabled": true,
    "debug": true,
    "pruneNotification": "detailed",
    "pruneNotificationType": "chat",
    "commands": {
      "enabled": true,
      "protectedTools": []
    },
    "manualMode": {
      "enabled": false,
      "automaticStrategies": []
    },
    "turnProtection": {
      "enabled": true,
      "turns": 3
    },
    "experimental": {
      "allowSubAgents": false,
      "customPrompts": false
    },
    "protectedFilePatterns": [],
    "compress": {
      "mode": "range",
      "permission": "allow",
      "showCompression": true,
      "summaryBuffer": 3,
      "maxContextLimit": 180000,
      "minContextLimit": 50000,
      "nudgeFrequency": 3
    },
    "strategies": {
      "deduplication": {
        "enabled": true,
        "protectedTools": []
      },
      "purgeErrors": {
        "enabled": true,
        "turns": 4,
        "protectedTools": []
      }
    }
  }
}
```

* **aasm.mode**: When set to `active`, the system intervenes aggressively at the prompt stage.
* **aasm.threshold**: Sets the minimum risk level to trigger alerts (`Critical`, `Warning`, `Advisory`).

---

## 5. Roadmap

* **DCP (Dynamic Context Pruning)**: A feature that automatically compresses low-value data in long conversation histories to optimize token efficiency. (Beta)
* **Cross-IDE Support**: Expanding support for Windsurf and JetBrains-based editors.

---

## 6. License & Contribution

This project is distributed under the **AGPL-3.0 License**.
Bug reports and feature suggestions are always welcome via GitHub Issues.

© 2026 [ttalkkak-lab](https://github.com/ttalkkak-lab). All rights reserved.