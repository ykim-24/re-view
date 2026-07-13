# re:view

A local-only PR review tool focused on **traceability** — seeing how a PR's code
connects, comparing full files, and reviewing back to GitHub. Not deployed; runs
on your machine with your own token.

## Setup

1. Put a GitHub token in `.env.local` (already gitignored):

   ```
   GITHUB_TOKEN=ghp_your_token_here
   ```

   Needs **Contents: read** and **Pull requests: read/write** (classic: `repo`).

2. Install & run:

   ```bash
   npm install
   npm run dev
   ```

3. Open http://localhost:3000, paste a PR URL (`https://github.com/owner/repo/pull/123`
   or shorthand `owner/repo#123`).

## What it does

- **Diff** — full-file Monaco diff, target branch (base) vs feature branch (head).
  Toggle split / inline in the header.
- **Trace imports** — the left tree lists changed files; expand one to see the files
  it imports (resolved against the repo's `tsconfig` path aliases).
- **Go to definition** — **⌘/Ctrl + click** a symbol in the diff. It follows the
  import to the source file and opens it in a right-side panel, scrolled to the
  definition. (TS/JS only in v1.)
- **Review** — click a diff's left gutter to comment on a line; pick
  Comment / Approve / Request changes in the bottom bar and submit. It posts a real
  review to GitHub.

## Architecture (DDD)

```
src/
  app/            Next.js routes + /api route handlers (token stays server-side)
  domain/         pure logic: import parsing, symbol index, dependency graph
  infrastructure/ GitHub (Octokit) — the single external seam
  application/    use-cases: resolve-symbol, build-dependency-graph
  features/       UI slices (Zustand stores): workspace, modal, diff-viewer,
                  dependency-tree, code-intel-panel, review
  hooks/          TanStack Query data hooks
```

State decides the view (Zustand): the `workspace` store holds the selected file,
diff mode, and the go-to-definition target; the right panel renders only when a
target is set. Modals use an always-mounted registry (one `ModalRoot`, a
discriminated union of variants).

## v1 limitations (by design)

- Dependency edges are forward only (changed file → what it imports), 1 hop.
  "Who imports this file" would need a repo-wide scan — not built yet.
- Import parsing / go-to-definition is TS/JS only and heuristic (regex-based),
  not a full type-aware language service.
- No AI features yet — this is the data/visibility foundation.
