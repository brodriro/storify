# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary: the owner of a homelab, a technically capable person who runs Storify on their own server and uses it themselves (confirmed 2026-10-17). They value information density and control over hand-holding, and they are also the administrator.

Other accounts exist in the product (members, a read-only guest), configured by that owner. Who those people are in practice is not established; do not design for a specific audience beyond "people the owner chose to give access".

## Product Purpose

A self-hosted, multi-user file manager for a small NAS on the local network: browse, preview and organize files, share a common area between accounts, and keep the server healthy (storage use, per-user usage, backups, suspicious activity). Success: finding and acting on a file is fast and certain, and the state of the server is always readable at a glance.

## Positioning

Storify pairs a plain file manager with a conversational agent that can query and act on the storage, but never changes files without the user confirming the proposed action, and it can run against a local, OpenAI-compatible model so data never leaves the LAN. Everything else works with no Internet access at all.

## Operating Context

- Served on the LAN, often over plain HTTP, from modest NAS hardware; used from a desktop browser and from a phone.
- Content is the owner's own: photos and videos (thumbnails matter), documents (txt, docx, pdf), backups.
- Admin work: storage use against an optional limit, usage per top-level folder, full and incremental ZIP backups, a log of failed logins and access denials.

## Capabilities and Constraints

- Roles: admin (everything under `users/`), member (own folder plus the shared root, not other members' folders), guest (read-only `public/`).
- File operations: upload (drag and drop or picker), new folder, rename, move (folder picker or drag), delete, bulk move/delete, preview images and video, download, sort by name or date, pagination at 200 entries.
- Agent tools: disk usage, recent files, document search, summarize, classify, suspicious activity and backup (admin), move and create folder; mutating tools always need confirmation.
- Technical: NestJS server-rendered Handlebars views with vanilla JS; strict CSP (`script-src 'self'`, `style-src 'self'`, no inline code or styles); every asset self-hosted (no CDNs); UI strings in `src/i18n/es.ts`; WCAG AA contrast enforced by tests.
- Open: whether more languages will be needed (the catalog allows it), and any per-user quota feature.

## Brand Commitments

- Name: Storify (the product's texts are preserved).
- No visual element is binding (confirmed 2026-10-17): logo, colors and typography may all change in a redesign. Functions, content and copy carry over.
- UI language: Spanish, neutral in gender ("Hola, {name}").

## Evidence on Hand

No testimonials, customers, benchmarks or press exist. Do not invent any. The README and `docs/` describe real behavior; `docs/analysis_result.json` describes the agent's real capabilities and gaps.

## Product Principles

1. The owner is in control: nothing changes on disk without an explicit action or confirmation.
2. State is legible: storage, permissions and what an action will do are visible before acting.
3. Local first: works offline on the LAN; the AI provider, if remote, is disclosed.
4. Density without clutter: an expert's tool, fast to scan, never padded.
5. Every action reachable by keyboard and touch, not only by mouse or drag.

## Accessibility & Inclusion

WCAG 2.2 AA is the floor: keyboard operability, visible focus, 4.5:1 text contrast (tested), 24 px minimum targets (44 px on touch), reduced-motion alternatives.
