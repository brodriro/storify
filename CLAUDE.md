# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Storify is a multi-user "mini NAS" file manager: NestJS 11 backend rendering Handlebars (`hbs`) views, plus a conversational agent (OpenAI tool-calling over Socket.IO) that can query and act on the storage. UI copy, docs and commit history are mostly in Spanish.

## Commands

Package manager is **pnpm**, pinned via `packageManager` in `package.json` (`.npmrc` sets `node-linker=hoisted`; `pnpm-workspace.yaml` lists which dependency build scripts are allowed). Don't use npm to install.

```bash
pnpm install
pnpm run start:dev          # watch mode, http://localhost:3000
pnpm run build              # nest build → dist/ (copies views/ and public/ as assets, see nest-cli.json)
pnpm run start:prod         # node dist/main
pnpm run lint               # eslint --fix over src/test (type-checked rules + prettier)
pnpm run lint:check         # eslint without --fix (what CI runs)
pnpm run typecheck          # tsc --noEmit (ts-jest does NOT type-check specs)
pnpm run format             # prettier on src/test
pnpm test                   # jest, rootDir=src, *.spec.ts
pnpm test -- path/or/pattern -t "test name"   # single test file / single test
pnpm run test:e2e           # jest --config test/jest-e2e.json
pnpm hash-password          # bcrypt hash for USER_<NAME>, password read from stdin
```

CI (`.github/workflows/ci.yml`) runs build, typecheck, lint, `prettier --check`, unit and e2e; all blocking. Lint is at zero errors, so keep it there.

The e2e suite boots the real `AppModule` against a temp `STORAGE_PATH`. Env vars must be set before `AppModule` is required, because configuration is read at import time. `src/app.setup.ts` (`configureApp`) holds the Express setup (helmet/CSP, static assets, `/vendor/*`, hbs, cookies) shared by `main.ts` and the tests.

`pnpm-workspace.yaml` sets `minimumReleaseAge` to 14 days: pnpm refuses to resolve versions younger than that. Don't bypass it to grab a fresh release.

## Configuration

`src/config/configuration.ts` (`loadConfig`) is the only place that reads `process.env`. It returns a typed `AppConfig` and **throws at startup** on invalid config: `JWT_SECRET` must be 32+ characters, every user in `USERS` needs a non-empty `USER_<NAME>`, and usernames are restricted to `[A-Za-z0-9_-]`. Consume config with `ConfigService<AppConfig, true>` and `get('key', { infer: true })`; never read raw env keys. See `.env.example` for all variables.

AI is optional. It is enabled by `OPENAI_API_KEY` and/or `LLM_BASE_URL` (any OpenAI-compatible endpoint, e.g. Ollama), with `LLM_MODEL` (default `gpt-5-mini`; it must support tool calling). When AI is disabled, `LlmService` throws `ServiceUnavailableException` on use and the rest of the app works. `USER_<NAME>` may be a bcrypt hash (recommended) or plaintext (logs a warning). Backups: `BACKUP_PATH`, `BACKUP_KEEP_FULL`.

## Architecture

### Roles and access control
`roleForUsername`: `ADMIN` → `admin`, `INVITADO` → `guest`, anyone else → `member`. The JWT only carries the username; `AuthService.userFromPayload` reloads the role from config on every request/socket. Handlers get an `AuthUser { username, role }` via `@CurrentUser()`; admin-only routes use `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles('admin')`.

**Every filesystem access goes through `AccessPolicy` (`src/storage/access-policy.ts`)**, for both the HTTP API and the agent:
- `resolve(user, relPath, 'read'|'write')` normalizes first, checks containment with `path.relative` and symlinks with `realpath`, then applies the rules. admin: all of `users/`. member: all of `users/` except top-level folders named after another configured user. guest: read-only on `public/`.
- `assertMutable` blocks delete/rename/move of a storage root, and of a user home folder for non-admins. `assertValidName` validates single names and stops non-admins creating a top-level folder named after another user.
- Denials throw `ForbiddenException` and are recorded as `access_denied` security events.
- `StorageService` (`src/storage/`) methods take an `AuthUser` and work with paths relative to the user's root. To read a file from another module, use `resolveReadableFile`; never `path.join` storage paths yourself.

`src/storage/storage.service.spec.ts` is the table of ACL cases; extend it when you change rules.

### Storage layout
`<STORAGE_PATH>/users/<USERNAME>/…` (home created on login for non-guests), `public/` (guest root), `backups/` (default `BACKUP_PATH`), `.tmp/` (multer temp dir, same volume so the final `rename` works), `.audit/events.jsonl` (security events), `.thumbs/` (`ThumbnailService`: WebP cache keyed by path+size+mtime, served with `ETag`, pruned after 90 days on startup). Upload limits come from config; `TOTAL_STORAGE_GB` is enforced on upload (507) only when set explicitly (`storageLimitBytes`). Name collisions become `name_duplicado[N].ext`, reserved atomically with `O_EXCL`.

**Performance rules** (phase 3, measured with `monitorEventLoopDelay`): never `Promise.all` an fs call over a directory's entries, use `mapWithConcurrency` (`src/common/concurrency.ts`); the file browser renders 200 entries per page (`BROWSER_PAGE_SIZE`), since rendering, not I/O, is what blocks on big folders; tree searches take a limit. `getGlobalStats` is cached (5 min TTL, one shared walk) and invalidated by every `StorageService` write, so new write methods must call `invalidateStats()`. File-type lists, MIME types and `formatSize` live in `src/common/file-types.ts`.

### Agent (`src/agent/`)
- `tools/`: one `@Injectable` class per tool implementing `AgentTool` (name, JSON schema, `mutates`, `adminOnly`, optional `describe`, `run(params, { user })`). **To add a tool**, create `xyz.tool.ts` and list it in `tools/index.ts`. `ToolRegistry` hides admin-only tools from non-admins and validates arguments (`validateToolParams`: flat schemas, string/number/integer/boolean). Tools must access files only through `StorageService` with `ctx.user`.
- `agent.service.ts`: Chat Completions tool loop with a full transcript (`assistant.tool_calls` + `tool` messages), parallel calls, 12 iterations and a 75 s budget. Tools with `mutates: true` are **never run directly**: the loop returns `confirmation` + `pending`, and `resolveConfirmation(pending, approved, user)` resumes it.
- `chat/chat.gateway.ts`: authenticates the socket from the `jwt` cookie in `handleConnection` (no CORS), emits `chatInfo { enabled, provider }`, keeps a bounded per-socket history, and replies only to that socket. One pending confirmation per socket (`confirmAction { id, approved }`, single use, 5 min TTL, dropped by a new message).
- `llm/llm.service.ts`: Chat Completions only, the API that OpenAI-compatible local servers implement. `chat(messages, tools)`, `summarizeText`, `classifyFile` (JSON mode), all with the configured model and base URL.
- `classification/` builds a Spanish prompt from file metadata, extracted text and the folders the user can see, and owns `POST /files/classify` (kept out of the core file modules so they don't depend on the LLM). `documents/` (`DocumentReaderService`) extracts text from `.txt`/`.docx`/`.pdf` and does **no** ACL checks: pass it only already-resolved paths.
- `src/audit/` (`AuditService`): logger wrapper plus `recordEvent` (JSONL). `getSuspiciousActivity()` detects bursts of `login_failure` / `access_denied` per user.
- Use relative imports; jest has no `moduleNameMapper` for `src/...` paths.

### Backups (`src/backup/`)
`BackupService.start('full'|'incremental')` runs in the background: it writes `*.zip.partial`, renames it when complete and writes `<name>.manifest.json` (file state, archived paths, deletions, base full). Incrementals diff against the latest manifest (size/mtime) and add `DELETED.txt`. Retention runs only after a successful full backup. Partials are deleted on startup, and a running backup is aborted on shutdown (`enableShutdownHooks` in `main.ts`). `AdminController` exposes create, list and download (newest full by default).

### HTTP conventions
- Every body and query has a DTO (`*.dto.ts`, class-validator) under a global `ValidationPipe` (whitelist + forbidNonWhitelisted + transform). DTOs check shape only; path rules belong to `AccessPolicy`.
- Throw Nest HTTP exceptions (403/404/409/400), never a bare `Error`. `ViewExceptionFilter` turns 401/403 on HTML GET navigations into redirects (401 to `/`, 403 to `/files/browser`); fetch/JSON callers get normal errors.

### Views and frontend
- **No inline JavaScript and no inline styles.** The CSP is `script-src 'self'; style-src 'self'` (an e2e test asserts no `style=""`/`<style>`). Views load `public/js/*.js` (`theme.js`, `i18n.js`, `browser.js`, `dashboard.js`, `chat.js`) and use `data-action` / `data-path` attributes with event delegation. Never put user data in `on*=` attributes or build HTML from it; use `textContent` / `dataset`. Scripts may set `element.style` (CSSOM is allowed).
- `browser.hbs` receives pre-encoded `thumbnailUrl` / `downloadUrl`, folder/breadcrumb/pagination links built by `FilesController.browser` (`browserUrl`, keeps sort/order), and an inert `<script type="application/json" id="browserData">` with `<` escaped.
- Accessibility patterns (keep them): folders are links and files are buttons covering the card; ⋯ is a WAI-ARIA menu button; dialogs are native `<dialog>` with `showModal()`; the chat panel is `inert` while closed; one `<h1>` per page inside the layout's `<main id="main">`. Details in `design-system/storify-nas/DESIGN.md`.
- **UI strings** (Spanish, D5) live in `src/i18n/es.ts`. Views: `{{t "key" name=value}}` (helper in `app.setup.ts`, throws on unknown keys). Scripts: `window.t('key', params)` over the catalog's `client` part, embedded as JSON in `<head>`. Server messages users see use `t('errors.…')`; logs and LLM-facing messages stay English. `src/i18n/i18n.spec.ts` checks keys and flags UI text outside the catalog.
- The chat widget and its scripts render only when `user` is set. Model output goes through `DOMPurify.sanitize(marked.parse(...))`. marked, DOMPurify and the Fira fonts (`@fontsource`) are served from `node_modules` under `/vendor/`, the socket.io client from `/socket.io/`; no CDNs or Google Fonts (the UI works offline).
- Layouts are hbs partial blocks (`{{#> main}} … {{/main}}`); controllers pass `pageTitle` for `<title>`. Helpers `if_eq`, `t`, `clientMessages` are registered in `app.setup.ts`.
- Styling: `public/css/tokens.css` (semantic colour tokens per theme, the only place with colour values), `fonts.css`, `style.css` (components) and `chat.css`. The theme is `html[data-theme]`, set by `theme.js` in `<head>` from the saved choice or `prefers-color-scheme`. `src/ui/contrast.spec.ts` checks WCAG AA for the token pairs; run it after changing a colour. Design rules: `design-system/storify-nas/DESIGN.md`.

## Docs

`README.md` documents roles, configuration, deployment, backups and the agent for users; keep it in sync when behaviour changes. `docs/base.md` is the original functional spec (roles, visibility rules, dashboard). `docs/file_classification.md` documents the classification endpoint/tool. `docs/build_agent.md`, `docs/evaluate_agent.md` and `analysis_result.json` are a historical agentic-pattern analysis of an earlier version (e.g. 3 iterations, no confirmation); don't treat them as current.

A local, git-ignored improvement plan lives in `plan-mejoras/` (audit findings S*/A*/C*/U*/Q*, decisions D1-D7, phase roadmap with status). Finding IDs in commits and tests refer to it.
