"""
Developer Handoff - Contexty Plugin (Local OpenCode Integration)
"""

Overview
This project builds a local OpenCode plugin that captures tool parts, persists them
to disk, and re-injects them into UI messages so model context can be edited by hand.

Key goals
- Tool parts are sourced from UI messages, appended to a file, and re-injected from that file.
- Manual edits are preserved via a blacklist to remove specific tool part IDs.

Local plugin entry points
- .opencode/plugins/contexty.ts
- .opencode/plugins/utils/tool-log.ts

Runtime files
- .contexty/tool-parts.json
  - Stored tool parts. You can edit this file to add/remove/modify tool parts.
- .contexty/tool-parts.blacklist.json
  - Format: {"ids":["<tool-part-id>"]}
  - Any IDs here are excluded during append and reinjection.

Current behavior (important)
- experimental.chat.messages.transform:
  - Reads tool parts from current UI messages.
  - Appends new tool parts to .contexty/tool-parts.json (dedupe + blacklist).
  - Removes tool parts from UI messages.
  - Re-injects tool parts from .contexty/tool-parts.json back into UI messages
    by matching messageID.
- tool.execute.after is disabled (no write here).

Important constraints
- The tool parts that are re-injected must have messageID values that exist in the
  current UI messages, or they will not attach.
- If invalid tool part structure is injected, OpenCode can throw:
  AI_InvalidPromptError: Invalid prompt: The messages must be a ModelMessage[].

How to use manual overrides
1) Edit .contexty/tool-parts.json to add tool parts.
2) To remove an existing tool part, add its "id" to
   .contexty/tool-parts.blacklist.json.
3) Restart OpenCode to ensure fresh reads if needed.

Where the tool parts come from
- UI messages (OpenCode internal) are modified in experimental.chat.messages.transform.
- Core conversion to model messages happens in OpenCode core, not in this repo.

OpenCode core references (for context)
- Message flow and tool results creation:
  https://raw.githubusercontent.com/opencode-ai/opencode/main/internal/llm/agent/agent.go
- Provider conversion (example OpenAI):
  https://raw.githubusercontent.com/opencode-ai/opencode/main/internal/llm/provider/openai.go
- Prompt assembly:
  https://raw.githubusercontent.com/opencode-ai/opencode/main/internal/llm/prompt/prompt.go

Related plugin reference
- DCP plugin pattern using experimental.chat.messages.transform:
  https://github.com/Opencode-DCP/opencode-dynamic-context-pruning

Files touched in this repo
- .opencode/plugins/contexty.ts
- .opencode/plugins/utils/tool-log.ts
- src/index.ts
- src/utils/tool-log.ts

Notes for future work
- If you need to target a different message, update the reinjection mapping
  in contexty.ts (currently matches by messageID).
- If you want to fully override OpenCode core tool injection, you must modify
  OpenCode core, not just this plugin.
