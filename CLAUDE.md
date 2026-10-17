# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Storify is a multi-user "mini NAS" file manager: NestJS 11 backend rendering Handlebars (`hbs`) views, plus a conversational agent (OpenAI tool-calling over Socket.IO) that can query and act on the storage. UI copy, docs and commit history are mostly in Spanish.

## Commands

Package manager is **pnpm** (`.npmrc` sets `node-linker=hoisted`). A stray `package-lock.json` also exists; don't use npm to install.

```bash
pnpm install
pnpm run start:dev          # watch mode, http://localhost:3000
pnpm run build              # nest build → dist/ (copies views/ and public/ as assets, see nest-cli.json)
pnpm run start:prod         # node dist/main
pnpm run lint               # eslint --fix over src/test (type-checked rules + prettier)
pnpm run format             # prettier on src/test
pnpm test                   # jest, rootDir=src, *.spec.ts
pnpm test -- path/or/pattern -t "test name"   # single test file / single test
pnpm run test:e2e           # jest --config test/jest-e2e.json
```

Known state as of 2026-10: `build` fails (missing `src/agent/logs/*`, missing `@nestjs/websockets` dependency), the only unit/e2e tests are stale NestJS starter tests that do not compile/pass, and most of the codebase isn't prettier-formatted yet (lint reports ~1300 errors, mostly `prettier/prettier`). Don't assume a green baseline.

## Configuration

`.env` (see `.env.example`) is read by `@nestjs/config` and also directly via `process.env` / `dotenv` in places. Key variables: `USERS` (comma list) + `USER_<NAME>` (plaintext password per user), `STORAGE_PATH`, `TOTAL_STORAGE_GB`, `ADMIN_EMAIL`, `JWT_SECRET`, `OPENAI_API_KEY`, `PORT`.

`src/config/configuration.ts` maps env to a typed object (`storagePath`, `totalStorageGb`, `users`, …), but some services read raw env keys through `ConfigService` instead (`STORAGE_PATH`, `TOTAL_STORAGE_GB`, `ADMIN_EMAIL`, `JWT_SECRET`) and `FileReaderService` hardcodes `./public_storage`. When touching config, check every consumer — the two naming styles have different defaults.

`LlmService` throws in its constructor if `OPENAI_API_KEY` is unset, so the whole app fails to boot without it.

## Architecture

### Roles and access control
Roles come from the username in `configuration.ts`: `ADMIN` → `admin`, `INVITADO` → `public`, everyone else → `moderator`. `FileSystemController` then maps roles to a string `userRole` of `admin | moderator | guest` (repeated inline in every handler) and passes it to `FileSystemService`.

All ACL logic lives in `FileSystemService` (`resolveRoot`, `ensureUserAccess`, the filter in `listFiles`, and per-method `startsWith(root)` checks):
- `admin` and `moderator` operate on `<STORAGE_PATH>/users`; `guest` is rooted at `<STORAGE_PATH>/public`.
- Moderators can reach every user folder except `ADMIN`'s; the "regular user = own folder only" branch described in README/docs is effectively unreachable because no role maps to it.
- Any new filesystem operation must go through `resolveRoot` + `ensureUserAccess` + the root containment check; services in `src/agent/` currently bypass these and resolve paths themselves.

Auth: `POST /auth/login` validates against env users, signs a JWT (1 day) and stores it in the `jwt` cookie; `JwtStrategy` reads it from the cookie. `JwtAuthGuard` is applied at controller level on `files` and `admin`. There is no role guard — admin checks are done ad hoc inside handlers.

### Storage layout
`<STORAGE_PATH>/users/<USERNAME>/…` (created on login), `<STORAGE_PATH>/public/` (guest root), `<STORAGE_PATH>/backups/` (ZIPs + `last_backup_timestamp.json`). Uploads land in `./temp_uploads` (multer) and are `rename`d into place; name collisions become `name_duplicado[N].ext`.

### Agent (`src/agent/`)
- `chat/chat.gateway.ts`: Socket.IO `chat` event → keeps per-socket history in memory → `AgentService.processMessage` → emits `chatResponse`.
- `agent.service.ts`: ReAct-style loop (`maxIterations`). Tool schemas are declared in the `availableTools` array and dispatched in the `executeTool` switch — adding a tool requires editing both. Mutating tools (`move_file`, `create_folder`) call `FileSystemService` as user `ADMIN` with role `admin`.
- `llm/llm.service.ts`: OpenAI client. Agent decisions use the Responses API (`gpt-5-mini`); summaries use Chat Completions; classification uses `gpt-4o-mini` with JSON mode. Model names are hardcoded.
- `classification/` builds a Spanish prompt from file metadata + extracted text (`file-reader/` handles `.txt`, `.docx` via mammoth, `.pdf` via pdf-parse) and returns `FileClassificationResponse`. Also exposed over HTTP as `POST /files/classify`.
- `src/agent/logs/` (`LogsModule`/`LogsService`, used for `get_suspicious_activity`) is imported but not in the repo: the `.gitignore` rule `logs/` excludes it. If you recreate it, add a negation (`!src/agent/logs/`) or it will stay untracked.
- Imports under `src/agent` sometimes use the absolute form `src/...` (relies on `baseUrl`); prefer relative imports, jest has no `moduleNameMapper` for it.

### Views and frontend
- `main.ts` sets up hbs: partials from `views/partials` and `views/layouts` (layouts are used as partial blocks: `{{#> main}} … {{/main}}`), and an `if_eq` helper. Paths switch between `dist/` and project root based on `__dirname`.
- `views/browser.hbs` is the file browser and contains most client-side logic inline (large `<script>` block, inline `onclick` handlers, `fetch` calls to `/files/*`). `views/dashboard.hbs` is the admin dashboard.
- `public/js/chat.js` is the chat widget, loaded on every page via `layouts/main.hbs` together with socket.io and marked from CDNs.
- Styling: `public/css/style.css` (imports `style-ux.css`) and `chat.css`. Tokens follow `design-system/storify-nas/MASTER.md` (Fira Sans/Fira Code, `--color-*` variables); dark mode is toggled by a `dark` class on `body` stored in `localStorage`.

## Docs

`docs/base.md` is the original functional spec (roles, visibility rules, dashboard). `docs/file_classification.md` documents the classification tool. `docs/build_agent.md`, `docs/evaluate_agent.md` and `analysis_result.json` describe the agentic-pattern analysis. The README overstates some things (e.g. 3 agent iterations — code uses 12; per-user quotas are displayed, not enforced).
