#!/bin/bash
# git-autopush.sh
# Auto-commit and push any changes in the Local Host Journal project.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR" || exit 1

# Check for git
if ! command -v git &>/dev/null; then
  echo "git not found — skipping auto-push" >&2
  exit 0
fi

# Only act if something changed
if git diff --quiet && git diff --staged --quiet; then
  exit 0
fi

git add -A
git commit -m "Auto-save: $(date '+%Y-%m-%d %H:%M:%S')"
git push origin main

echo "Local Journal: changes pushed to GitHub at $(date '+%H:%M:%S')"
