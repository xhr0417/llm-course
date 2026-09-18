# Agent notes

This repository is a personal Chinese LLM course site: static HTML, CSS and JS, no frontend build step. The site is being reorganized around one learning spine. Product requirements are in [`docs/PERSONAL_LEARNING_OS.md`](docs/PERSONAL_LEARNING_OS.md). Phased work is in [`docs/IMPLEMENTATION_PLAN.md`](docs/IMPLEMENTATION_PLAN.md). Visual and accessibility rules are in [`DESIGN.md`](DESIGN.md). The first feature phase updates the identity, navigation and verification rows listed in [`docs/PERSONAL_LEARNING_OS.md`](docs/PERSONAL_LEARNING_OS.md) section 10.

## Source vs generated

Edit source, then regenerate. Do not hand-edit build output.

- Source: `content/` (Markdown and JSON), `js/`, `css/`, `index.html` shell, `tools/`, `projects/` (until a later deletion pass), `docs/`.
- Generated: `chapters/*.html`, `sitemap.xml`, `robots.txt`, `llms.txt`, `dist/`, and the static catalog block that `tools/build-static.js` writes into `index.html`.

After changing Markdown or catalog JSON, run `node tools/build-static.js` (and `node tools/build-dist.js` if assembling a publish tree). Do not publish unless asked.

## Learning records

Plan definitions belong in published data under `content/`. Personal completion lives in browser storage, separate from the plan. Do not prefill mastery. Do not treat “read” (`llm-course-progress`) as “implemented”, “verified”, or “can explain”. Do not label a manual checkbox as an automated test pass. Task completion uses only that task’s required criteria; concept dimensions are not a second gate. `user_reported` is a source, not a pass.

## Scope discipline

Keep the existing static architecture. Keep theory chapters, demos and useful references. Do not treat the six current homework projects as the main line. Do not delete `projects/` until the implementation plan’s dependency pass is done.
