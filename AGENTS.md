<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:orchestration-rules -->
# Swarm orchestration: Sonnet 4.6 + DeepSeek

This project uses a two-tier swarm architecture:

## Tier 1 — Orchestrator (Claude Sonnet 4.6)
The main Claude Code session always runs on **Sonnet 4.6** via Anthropic's API.
This session plans, reasons, delegates, and reviews. It is the project manager.

## Tier 2 — Workers (DeepSeek via CCR)
Background agents and sub-agents should be routed through **DeepSeek** for cost- and token-efficiency.
DeepSeek handles: research, exploration, code generation, and any task that doesn't require Tier 1's reasoning depth.

## How it works
- `ANTHROPIC_BASE_URL` must NOT be set globally. The main session talks to Anthropic directly.
- When spawning a background Agent, use the `ccr deepseek` preset to route it through DeepSeek:
  `ccr deepseek "your prompt"` — this starts a sub-session routed through CCR → DeepSeek.
- The orchestrator tracks what it delegates, reviews results, and handles integration.

## CCR preset: `deepseek`
Located at `~/.claude-code-router/presets/deepseek/config.json`
Routes through: `deepseek-chat` (default) or `deepseek-reasoner` (for complex reasoning tasks)
Server runs on `http://127.0.0.1:3456`
<!-- END:orchestration-rules -->
