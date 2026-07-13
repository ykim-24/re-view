#!/usr/bin/env bash
#
# Cut a release: verify the tree, run checks, bump the version, tag, and push.
# The running app polls the remote and offers the update in a modal.
#
# Usage: npm run release -- [patch|minor|major]   (default: patch)
#
set -euo pipefail

bump="${1:-patch}"
case "$bump" in
  patch|minor|major) ;;
  *) echo "usage: npm run release -- [patch|minor|major]"; exit 1 ;;
esac

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

echo "→ bump + tag"
npm version "$bump" -m "release: v%s"

echo "→ push"
git push origin "$branch"
git push origin --tags

new="$(node -p "require('./package.json').version")"
echo "✓ released v$new — the app will offer it on next version check."
