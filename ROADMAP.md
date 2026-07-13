# Roadmap

re-view's trajectory. Build current work with these next phases in mind.

## 1. Foundation (current)

The data & visibility layer: PR review with traceability — dependency graph, go-to-definition,
references, full-file diffs, inline comments + approvals, commit history, review queue, saved repos,
recently viewed. This is the substrate everything else builds on.

## 2. AI + RAG + CAG (in progress)

Make the review smart:

- **Repo symbol index** ✅ — per-repo index of exported symbols at default-branch HEAD (tarball build +
  incremental blob-sha diff), powering repo-wide go-to-definition and the RAG context.
- **Insight** ✅ — `⌘I` / selection wheel / per-file button: a stepped pipeline that resolves the
  selection's dependencies through the index, then has Claude explain it + flag risks. "Dig Deeper" adds a
  second hop. Thumbs feedback is captured (`insight_feedback`) for evals.
- **Smarter PR reviews** ✅ (v1) — "Auto review" reviews the whole diff with full-file + cross-file
  definition context (`generate-pr-review`). Next: per-finding deep-dive + inline comments.
- **Smarter grouping** — group changed files/PRs by intent, not just folders (the current folder
  grouping is the placeholder for an AI-assisted grouping).
- **Smarter suggestions** — surface what to look at, likely issues, related code.

RAG/CAG over the data we already produce: the dependency graph, symbol index, captured comment
selections (`selectedText` on drafts), diffs, and commit history.

## 3. Generation

- Migrate the user's existing workflow styles into the app.
- Make re-view the user's **primary place to code** — review, navigate, and generate in one place.
