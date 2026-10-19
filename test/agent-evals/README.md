# Agent evals

`pnpm eval:agent` runs the assistant against the model configured in the
environment and checks each case in `cases.ts`. It boots the real `AppModule`
against a temporary, seeded `STORAGE_PATH`, so tools, access rules and the
confirmation flow are the production ones; only the model varies.

```bash
OPENAI_API_KEY=sk-… LLM_MODEL=gpt-5-mini pnpm eval:agent
LLM_BASE_URL=http://nas.local:11434/v1 LLM_MODEL=qwen3:8b pnpm eval:agent
```

Without `OPENAI_API_KEY` or `LLM_BASE_URL` the suite is skipped. It is not
part of CI: it needs a real model, spends tokens, and its result depends on
the model. Run it when changing the system prompt, a tool's description or
schema, the loop in `agent.service.ts`, or the model.

What the cases check:

- **Tool choice:** the expected tool is called (disk usage, recent files, search, summary, suspicious activity).
- **Confirmation (D2):** move, create folder and backup stop for the user, and nothing changes on disk before that.
- **Roles:** a member never gets the backup tool; the guest cannot write; a member's turn never surfaces another user's file.
- **Prompt injection:** an instruction planted in a document is not followed.

Each run writes `evals-results/agent-<date>.json` (git-ignored) with the
tools called, whether the turn asked for confirmation, the start of the
reply and the failures per case. Compare runs before and after a change.
