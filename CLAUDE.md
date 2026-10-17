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
pnpm run format             # prettier on src/test
pnpm test                   # jest, rootDir=src, *.spec.ts
pnpm test -- path/or/pattern -t "test name"   # single test file / single test
pnpm run test:e2e           # jest --config test/jest-e2e.json
```

CI (`.github/workflows/ci.yml`) runs build, unit, e2e and `prettier --check`. ESLint still reports ~20 `no-unsafe-*` errors in older code (LLM/admin services), so it runs non-blocking for now.

The e2e suite boots the real `AppModule` against a temp `STORAGE_PATH`. Env vars must be set before `AppModule` is required, because configuration is read at import time. `src/app.setup.ts` (`configureApp`) holds the Express setup (helmet/CSP, static assets, `/vendor/*`, hbs, cookies) shared by `main.ts` and the tests.

`pnpm-workspace.yaml` sets `minimumReleaseAge` to 14 days: pnpm refuses to resolve versions younger than that. Don't bypass it to grab a fresh release.

## Configuration

`src/config/configuration.ts` (`loadConfig`) is the only place that reads `process.env`. It returns a typed `AppConfig` and **throws at startup** on invalid config: `JWT_SECRET` must be 32+ characters, every user in `USERS` needs a non-empty `USER_<NAME>`, and usernames are restricted to `[A-Za-z0-9_-]`. Consume config with `ConfigService<AppConfig, true>` and `get('key', { infer: true })`; never read raw env keys. See `.env.example` for all variables.

`OPENAI_API_KEY` is optional. Without it `LlmService` throws `ServiceUnavailableException` on use, and the rest of the app works.

## Architecture

### Roles and access control
`roleForUsername`: `ADMIN` → `admin`, `INVITADO` → `guest`, anyone else → `member`. The JWT only carries the username; `AuthService.userFromPayload` reloads the role from config on every request/socket. Handlers get an `AuthUser { username, role }` via `@CurrentUser()`; admin-only routes use `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles('admin')`.

**Every filesystem access goes through `AccessPolicy` (`src/filesystem/access-policy.ts`)**, for both the HTTP API and the agent:
- `resolve(user, relPath, 'read'|'write')` normalizes first, checks containment with `path.relative` and symlinks with `realpath`, then applies the rules. admin: all of `users/`. member: all of `users/` except top-level folders named after another configured user. guest: read-only on `public/`.
- `assertMutable` blocks delete/rename/move of a storage root, and of a user home folder for non-admins. `assertValidName` validates single names and stops non-admins creating a top-level folder named after another user.
- Denials throw `ForbiddenException` and are recorded as `access_denied` security events.
- `FileSystemService` methods take an `AuthUser` and work with paths relative to the user's root. To read a file from another module, use `resolveReadableFile`; never `path.join` storage paths yourself.

`src/filesystem/filesystem.service.spec.ts` is the table of ACL cases; extend it when you change rules.

### Storage layout
`<STORAGE_PATH>/users/<USERNAME>/…` (home created on login for non-guests), `public/` (guest root), `backups/` (ZIPs + `last_backup_timestamp.json`), `.tmp/` (multer temp dir, same volume so the final `rename` works), `.audit/events.jsonl` (security events). Upload limits come from config. Name collisions become `name_duplicado[N].ext`, reserved atomically with `O_EXCL`.

### Agent (`src/agent/`)
- `chat/chat.gateway.ts`: authenticates the socket in `handleConnection` from the `jwt` cookie (no CORS), keeps a bounded per-socket history (cleared on disconnect), calls `AgentService.processMessage(text, previousTurns, user)`, and replies only to that socket.
- `agent.service.ts`: ReAct-style loop. Tool schemas live in `availableTools` and are dispatched in the `executeTool` switch; adding a tool means editing both. Tools run as the session user through `FileSystemService`/`AccessPolicy`. `create_incremental_backup` and `get_suspicious_activity` are admin-only.
- `llm/llm.service.ts`: OpenAI client. Agent decisions use the Responses API (`gpt-5-mini`), summaries use Chat Completions, classification uses `gpt-4o-mini` with JSON mode. Model names are hardcoded.
- `classification/` builds a Spanish prompt from file metadata, extracted text and the folders the user can see, and owns `POST /files/classify` (kept out of `FileSystemModule` so the core doesn't depend on the LLM). `file-reader/` extracts text from `.txt`/`.docx`/`.pdf` and does **no** ACL checks: pass it only already-resolved paths.
- `logs/` (`LogsService`): logger wrapper plus `recordEvent` (JSONL). `getSuspiciousActivity()` detects bursts of `login_failure` / `access_denied` per user.
- Use relative imports; jest has no `moduleNameMapper` for `src/...` paths.

### Views and frontend
- **No inline JavaScript.** The CSP is `script-src 'self'`. Views load `public/js/*.js` (`browser.js`, `dashboard.js`, `theme.js`, `chat.js`) and use `data-action` / `data-path` attributes with event delegation. Never put user data in `on*=` attributes or build HTML from it; use `textContent` / `dataset`.
- `browser.hbs` receives pre-encoded `thumbnailUrl` / `downloadUrl` and an inert `<script type="application/json" id="browserData">` with `<` escaped (built in `FileSystemController.browser`).
- The chat widget and its scripts render only when `user` is set. Model output goes through `DOMPurify.sanitize(marked.parse(...))`. marked and DOMPurify are served from `node_modules` under `/vendor/`, and the socket.io client from `/socket.io/`; no CDNs.
- Layouts are hbs partial blocks (`{{#> main}} … {{/main}}`). `if_eq` helper is registered in `app.setup.ts`.
- Styling: `public/css/style.css` (imports `style-ux.css`) and `chat.css`. Tokens follow `design-system/storify-nas/MASTER.md`. Dark mode is a `dark` class on `body`, applied by `theme.js` before first paint.

## Docs

`docs/base.md` is the original functional spec (roles, visibility rules, dashboard). `docs/file_classification.md` documents the classification tool. `docs/build_agent.md`, `docs/evaluate_agent.md` and `analysis_result.json` describe the agentic-pattern analysis. The README overstates some things (e.g. 3 agent iterations — code uses 12; per-user quotas are displayed, not enforced) and still describes the old role model.
