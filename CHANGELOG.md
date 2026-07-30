# Changelog

## v0.5.0 — 2026-07-30

**Ask Lizard** — the gecko button in the corner of a pull request (or a branch comparison) opens a chat about the code in front of you. It uses tools instead of guessing: **Insight** on a selection (with a *deeper* second hop of definitions), reading any file at the PR's head, looking symbols up in the repo index, and listing the PR's changed files — every call shown in a collapsible trace above the answer. Highlight code and it offers itself as context, or reach it from the selection wheel's new **Ask Question** action. The square grows into the panel and folds back on close, and one conversation is kept per PR — restored on reload, erasable from the panel header.

**Verify a review comment** — from any comment thread, ask whether the reviewer's point actually holds. It gathers the commented code and the definitions its symbols resolve to, streams an assessment, then drafts a reply you can post to the thread in one click.

**Update button** — while the checkout is behind the remote, the tab strip shows an **Update** affordance, so an update dismissed with "Not now" stays reachable.

Insight's context gathering now lives in one place, shared by the chat and the existing ⌘I pipeline, and it prefers the symbols a file actually imports — so asking about JSX no longer spends the budget resolving class names.

## v0.4.0 — 2026-07-20

**Custom Integrations** — build small local automations as apps. Each integration owns *flows* (its capabilities); a flow is a canvas of *components*, starting with a **Button** whose click logic you write in a sandboxed editor with `fetch`, encrypted `secrets`, `log`, a shared `ctx`, and cross-component `components.<key>` calls (`.output` / `.run()`). Includes an encrypted secrets vault, verbose run logs, a categorized component palette, and editor autocomplete of the runtime surface. Reach it from the home page → **Integrations**.

**Unsubmitted reviews persist** — staged inline comments, the summary body, the pending event, and viewed marks now survive a reload or server restart (saved locally per PR).

**Reusable UI primitives** — a portal-based right-click **context menu** and a **confirm dialog** for destructive actions.

## v0.3.1 — 2026-07-15

Added an in-app **What's new** changelog modal (home page + update modal) that shows the latest release notes in a pressed panel. The release script now takes a markdown message and records each release in `CHANGELOG.md`.

## v0.3.0 — 2026-07-15

**Tabs, branding, and review polish.**

- **Browser-style tabs** — drag to reorder (pointer-based, edge-aware hit
  detection, snaps into place), close slides the rest left, new tabs animate in,
  labels reveal per-character.
- **Gecko branding** — pixel gecko as the tab-strip logo (click → home) and the
  favicon.
- **Standardized inputs** — the `Input` and `Textarea` share one box style: gray
  fill, inset shadow, single blue focus outline. Search inputs autofocus.
- **Staged comments** — each row jumps to its line in the diff; the dropdown
  opens with an animation.
- Lifted tab-strip / content styling and a subtle recession between them.

## v0.2.3 — 2026-07-14

- **Right-click context menu** on PR and branch cards — the card lifts, the
  background blurs, and icon actions (bookmark / open on GitHub / copy) slide out
  to the side.

## v0.2.2 — 2026-07-13

- Fixed AI-generated content mis-parsing stray angle brackets (e.g. `<entities>`,
  `Array<Entity>`) as HTML tags.
- Review bar hidden while the summary view is open.

## v0.2.1 — 2026-07-13

- Subtle scrollbar for the summary, and more room for the section-nav rail.

## v0.2.0 — 2026-07-13

- **Summary** — a persisted, sectioned overview of a PR or branch comparison
  with clickable source citations, opened as a full-page mode.
- **Branch compare** — pick any branch and diff it against a base, reusing the
  full review workspace.
- **Self-updater** — the app checks the repo for a newer version and offers an
  in-place update; `npm run release` cuts and pushes it.
- Lazy dependency-graph resolution to avoid rate limits.

## v0.1.0 — 2026-07-13

- Initial: local PR review with traceability — full-file diffs, import-graph
  navigation, go-to-definition, inline review, auto review, and insight.
