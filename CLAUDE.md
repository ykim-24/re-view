@AGENTS.md

# re-view

A local-only (never deployed, single-user) PR review tool focused on **traceability** —
seeing how a PR's code connects. Run with `npm run dev` (the user runs it on **port 5500**:
`PORT=5500 npm run dev`). Reads GitHub via a `GITHUB_TOKEN` in `.env.local`; AI features
(insight, auto-review) need an `ANTHROPIC_API_KEY` in `.env.local` too.

See `ROADMAP.md` for where this is heading — phase 2 (AI/RAG/CAG) is now partly built (repo
symbol index + insight + auto-review); generation is next.

## Coding rules (the user's — follow exactly)

1. **No ternaries in JSX returns.** For conditional rendering, use `&&`, a helper
   function, or a small component with an early return — not `cond ? <A/> : <B/>`.
   (Value ternaries for a className/string are tolerated, but prefer `cn(..., a && "x", !a && "y")`.)
2. **No anonymous functions as element props.** Define named handlers
   (`const handleX = ...` / `useCallback`). Subscription/query callbacks
   (`gsap`, `ed.onMouseDown`, `mutate(_, { onSuccess })`) are NOT props — those are fine.
3. **Modular & isolatable.** Extract list items / sections into their own components
   that work on their own. Pure logic goes in `domain/`.
4. **Extract complex render into a component.** If a render branch is non-trivial, pull it out.
5. **For big features with deep nesting, lean on a context + provider** instead of prop-drilling
   (e.g. `features/dependency-tree/TreeContext`).
6. **No weird casting.** Use proper types and type guards (e.g. `isSort`, `isFilterMode`).

**Comments:** only a top-of-file JSDoc-style `/** … */` block describing the file. No inline
comments. If a file has none, add the top block. (A `PostToolUse` hook enforces correctness on
every edit — heed its messages; some are false positives mid-multi-edit, verify with `tsc`.)

Always finish a change by running `npx tsc --noEmit` and `npm run lint` (both must be clean),
and `npm run build` for anything substantial.

## Stack & architecture (DDD, layered)

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind v4 · shadcn (base-nova / **Base UI**,
not Radix) · Zustand · TanStack Query · GSAP · Monaco · Octokit · better-sqlite3 · `@anthropic-ai/sdk`.

```
src/
  app/            routes + /api route handlers (the only place the GitHub/Anthropic tokens are used)
  domain/         pure logic, no React/IO (code-intel parsing + symbol index, insight event types, patch parsing, models)
  infrastructure/ github/ (Octokit, server-only), db/ (better-sqlite3, server-only),
                  anthropic/ (Claude client, server-only), archive/ (gzip+tar extractor for repo tarballs)
  application/    server use-cases (resolve-symbol, build-dependency-graph, search-files, type-context, load-*,
                  build-repo-index, generate-insight, generate-pr-review)
  features/       UI slices, each owns its store/components (workspace, diff-viewer, dependency-tree,
                  code-intel-panel, review, dashboard, repo-list, spotlight, modal, changes-list)
  hooks/          TanStack Query hooks (server state) — `use*`; plus stream hooks (useEventStream → useInsight/useAutoReview)
  components/     shared UI (Tooltip, Select, Loader, CollapsibleSection, Markdown, ui/ = shadcn)
  lib/            apiClient, queryClient, pr-key, time, language, monaco, github-url
```

Conventions:
- **Server state → TanStack Query hooks** calling our `/api/*` routes (never call Octokit/DB from client).
- **View/UI state → Zustand** (`features/*/store.ts`). State decides the view (e.g. `workspace` store's
  `definition`/`commitSha`/`reveal`; modal registry = `active: ModalDescriptor | null` + one always-mounted `ModalRoot`).
- **SQLite** (`.data/re-view.db`, gitignored, WAL) holds: review queue (`tracked_pr`), saved repos
  (`saved_repo`), recently-viewed (`recent_pr`), the repo symbol index (`repo_index` save point +
  `indexed_file` blob shas + `repo_symbol` lookup), an immutable-by-sha file cache (`file_cache`), and
  insight thumbs (`insight_feedback`) — all behind `/api` + `use*` hooks with `prKey`/`repoKey`.
- **Custom overlays are portal-based, high z-index, and window-aware** (flip/clamp to viewport):
  `Tooltip`, `Select`, the review-bar comments dropdown, `ThreadPopover`. Don't use native
  `<select>`/`title`; use `Select`/`Tooltip`. No full-screen click-catcher overlays (they block clicks) —
  close on a `document` `mousedown` that excludes the trigger+panel.
- **Loading** uses `components/Loader` (line-art tumbling cube, GSAP). Pass it to Monaco's `loading` prop too.
- **Markdown** via `components/Markdown` (react-markdown + remark-gfm + rehype-raw). Images open the
  artifact modal (`openModal({ type: "artifact", artifact: { kind: "image", ... } })`) — extend `Artifact` for new kinds.

## Domain gotchas (don't regress these)

- **Diff base = merge-base, not `pr.base.sha`.** GitHub diffs/reviews against the merge-base; the base
  branch can move. `getPullRequest` computes `mergeBaseSha`; the diff viewer uses it as `baseRef`.
- **Inline-comment lines must be in the diff.** GitHub's per-file `patch` is omitted/truncated for large
  files, so the guard (`commentableHeadLines`) is lenient when the patch is absent and lets GitHub be the
  final word; submit errors are surfaced clearly and drafts preserved.
- **Import resolution** (`domain/code-intel/resolve-import`) handles relative + tsconfig `paths` **and
  `baseUrl`-relative** imports (e.g. `domains/x`, `interfaces/types`); only true packages are "external".
- Go-to-definition/references/type-context are TS/JS, regex-heuristic (not a full language service).
- Comments staged in the review store are **transactional** — only POSTed on Submit; viewed marks persist.

## AI features (phase 2 — index + insight + auto-review)

- **Repo symbol index.** `build-repo-index` indexes the **default-branch HEAD** (one shared index per
  repo; the commit sha is the save point). Full build downloads the repo **tarball** (1 request →
  `archive/untar`) + the git tree (for per-file blob shas); incremental re-scans only files whose blob sha
  changed, falling back to a full tarball rebuild past `LARGE_DELTA`. Stores exported symbols only.
  Kicked in the background on workspace open (`/api/index/ensure`, polled via `useRepoIndex`); shown by the
  header `RepoIndexIndicator`. It powers **repo-wide go-to-definition**: `resolveSymbol` falls back to the
  index when import-following comes up empty.
- **Insight** (`⌘I` / selection wheel / file button). A **stepped pipeline** (`generate-insight`):
  read file → resolve dependencies (follow imports) → map usages → analyze with Claude. "Dig Deeper"
  re-runs with a second resolution hop + full definition files. The file-level button runs whole-file mode.
- **Auto review** (top-right `Bot` button). `generate-pr-review`: gathers each changed file's full content +
  the diff + index-resolved cross-file definitions, then one Claude review (Summary · Findings · Verdict).
- **Chat** ("Ask Lizard" — gecko button, bottom-right, `features/chat`, mounted via `ChatRoot`;
  the square morphs into the panel and back with GSAP, and only appears on the diff-bearing
  routes — `scopeHasCode`: a PR or a compare).
  A tool-loop agent (`chat-agent`) rather than a fixed pipeline: `insight` (with `deep` =
  Dig Deeper), `read_file`, `find_symbol` (repo index), `list_changed_files`. The route +
  the workspace write `scope` into `chat.store` (owner/repo/number/head ref/open file) so
  tools read the right blobs; a live Monaco selection shows as attachable context and the
  selection wheel's **Ask Question** opens the chat with it attached. Streams
  `ChatEvent`s (`domain/chat/events.ts`) — tool_start/tool_log/tool_end + token — which
  `useChat` folds into the store (revealed via `lib/typewriter`, the same pace as insight),
  so each answer carries its own tool trace. **One saved thread per PR** (`chat_thread`,
  keyed by `prKey`): `useChatHistorySync` hydrates on open and debounce-saves after,
  `useEraseChat` (the panel's eraser) drops the row. Compare views chat but don't persist —
  their base…head isn't in the route, so threads would collide.
- **Streaming protocol.** Both stream **newline-delimited `InsightEvent`s** (`domain/insight/events.ts`:
  plan/step_start/log/step_end/files/token). `useEventStream(url)` parses them into a live step list +
  gathered-file list + a typewriter-revealed answer; `useInsight`/`useAutoReview` are thin wrappers.
  Shared UI: `StreamedAnswer` (blinking cursor while waiting, `DigLoader` for deep), `StepLogs`
  (collapsible "Logs" container). Model: `claude-opus-4-8`, adaptive thinking. Insight requests flow
  through `insight.store`; the selection wheel through `selection-menu.store`.
- **Caching/limits.** File content is cached in SQLite by `path@sha` (immutable) — fetched once, ever.
  Octokit uses retry + throttling plugins (exponential backoff) for GitHub rate limits.
- **Feedback for evals.** Insight 👍/👎 persists to `insight_feedback` (selection + generated text + rating).

## Dev niceties

- Append `?loading` to any PR URL to preview the loading state.
- Editors disable Monaco's built-in peek/go-to-def; navigation is our right-side drawer.

## Releases & self-update

Single-user, git-clone-run tool, so updates are git-based (no deploy):

- **Cut a release:** `npm run release -- <patch|minor|major> "<changelog message (markdown)>"`
  (`scripts/release.sh`). It requires a clean tree + a message, runs `tsc`/`lint`,
  bumps `package.json`, prepends the entry to `CHANGELOG.md`, commits `release: vX.Y.Z`,
  tags, and pushes. The message is markdown and becomes the changelog entry.
- **Self-updater:** `/api/version` compares the local checkout against the remote
  default branch; `useVersionCheck` polls it and `UpdateChecker` opens the `update`
  modal when behind. `/api/update` fast-forwards (+ `npm install` on dep changes).
- **Changelog:** `CHANGELOG.md` (newest-first) is served by `/api/changelog` and
  rendered (markdown, `allowHtml={false}`) in the `changelog` modal —
  `openModal({ type: "changelog" })`, reachable from the update modal and the home
  "What's new" link.
- The tab bar (`features/tabs`) is browser-style: persisted, drag-reorder
  (`useTabReorder`, pointer-based + FLIP), gecko logo → home. `Input`/`Textarea`
  share one box style (gray fill, inset shadow, single blue focus).
