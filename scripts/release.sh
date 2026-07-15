#!/usr/bin/env bash
#
# Cut a release: verify the tree, run checks, bump the version, record a
# changelog entry, tag, and push. The running app polls the remote and offers
# the update in a modal; the changelog modal renders CHANGELOG.md.
#
# Usage: npm run release -- <patch|minor|major> "<changelog message (markdown)>"
#
set -euo pipefail

bump="${1:-}"
message="${2:-}"

case "$bump" in
  patch|minor|major) ;;
  *) echo "usage: npm run release -- <patch|minor|major> \"<changelog message>\""; exit 1 ;;
esac

if [ -z "$message" ]; then
  echo "✗ a changelog message is required:"
  echo "  npm run release -- $bump \"what changed (markdown ok)\""
  exit 1
fi

if [ -n "$(git status --porcelain)" ]; then
  echo "✗ working tree is not clean — commit or stash your changes first."
  exit 1
fi

branch="$(git rev-parse --abbrev-ref HEAD)"
echo "→ releasing a $bump bump on '$branch'"

echo "→ typecheck"
npx tsc --noEmit
echo "→ lint"
npm run lint

echo "→ bump"
new="$(npm version "$bump" --no-git-tag-version)"

echo "→ changelog"
tmp="$(mktemp)"
{
  echo "# Changelog"
  echo ""
  echo "## $new — $(date +%Y-%m-%d)"
  echo ""
  printf '%s\n' "$message"
  echo ""
  if [ -f CHANGELOG.md ]; then
    tail -n +3 CHANGELOG.md
  fi
} > "$tmp"
mv "$tmp" CHANGELOG.md

echo "→ commit + tag"
git add package.json package-lock.json CHANGELOG.md
git commit -q -m "release: $new"
git tag "$new"

echo "→ push"
git push origin "$branch"
git push origin --tags

echo "✓ released $new — the app will offer it on next version check."
