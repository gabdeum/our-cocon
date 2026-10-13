#!/usr/bin/env bash
# Runs after every Edit/Write. Silent when clean. On failure prints only the errors and exits 2,
# so Claude fixes them without being asked. Skips until the workspace is installed.
set -u
root="${CLAUDE_PROJECT_DIR:-$(pwd)}"
f=$(node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{try{process.stdout.write(JSON.parse(d).tool_input.file_path||"")}catch(e){}})')
case "$f" in *.ts|*.tsx|*.js|*.jsx|*.mjs) ;; *) exit 0 ;; esac
[ -d "$root/node_modules" ] || exit 0
cd "$root" || exit 0

out=$(pnpm -s exec eslint --quiet "$f" 2>&1) || { echo "$out" | head -40 >&2; exit 2; }

dir=$(dirname "$f")
while [ "$dir" != "$root" ] && [ "$dir" != "/" ] && [ ! -f "$dir/tsconfig.json" ]; do dir=$(dirname "$dir"); done
if [ -f "$dir/tsconfig.json" ]; then
  out=$(pnpm -s exec tsc --noEmit --incremental --pretty false -p "$dir" 2>&1) || { echo "$out" | head -40 >&2; exit 2; }
fi
exit 0
