---
version: 1
slug: "views-browser-hbs"
primary_target: "views/browser.hbs"
related_targets: ["views/layouts/main.hbs","views/partials/header.hbs"]
---

# File browser (views/browser.hbs) and the shared shell

Scope: the redesign's first surface; login and dashboard inherit the world afterwards. Visitor mode: Operate.

Audience and job: the homelab owner finds, previews, organizes and shares files and reads server state at a glance (PRODUCT.md). Views: grid with thumbnails and list with columns (size, date, type), switchable. Must not feel cluttered or heavily animated. Preserved: every function, all copy (src/i18n/es.ts), keyboard/touch patterns, CSP without inline code or styles.

## Direction contract

THESIS: each folder is a component datasheet: its contents and state measured and tabulated. Refuses the category default of a dark card dashboard with a neon accent.

OWN-WORLD: white paper, one near-black ink, 1 px hairline rules, a grey for secondary ink; blue only for "where you are / what is selected", red only inside CAUTION boxes. Archivo variable, condensed widths for masthead, references and type codes, normal width for body, tabular numerals everywhere. Square corners, no shadows, no blur. Dark theme is the negative print.

STORY: the owner reads the sheet (where, how full, what is inside), acts through ruled rows, and signs off any agent change in a CAUTION box.

FIRST VIEWPORT: masthead band: wordmark, document title = folder name, Ref. = path, revision block (user, role, date) with account controls; below, a capacity table and the action row; then the folder as a sortable specification table (type code, name, size with a fixed log scale bar, modified) or, in grid view, numbered figures (Fig. n · name). Primary actions Upload / New folder sit on the action row, right.

FORM: Hoja de datos, position 3 of 7 on my ordered list; seed f2baea04; raises: fixed size scale (star atlas), blue reserved for location (wayfinding), fixed type code (Saville), two values + tabular figures (Ikeda).

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
