#!/usr/bin/env bash
# Produce a Chrome Web Store-ready zip in dist/.
# Forces DEV=false and strips the local .test host permission so the
# published bundle never carries development-only state.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DIST="$ROOT/dist"
BUILD="$DIST/build"
ZIP="$DIST/remoteproof.zip"

rm -rf "$DIST"
mkdir -p "$BUILD"

rsync -a \
  --exclude='.git' \
  --exclude='.gitignore' \
  --exclude='.claude' \
  --exclude='.DS_Store' \
  --exclude='node_modules' \
  --exclude='dist' \
  --exclude='scripts' \
  --exclude='*.md' \
  "$ROOT/" "$BUILD/"

sed -i.bak -E 's/^const DEV = (true|false);/const DEV = false;/' \
  "$BUILD/background/background.js"
rm -f "$BUILD/background/background.js.bak"

python3 - "$BUILD/manifest.json" <<'PY'
import json, sys
path = sys.argv[1]
with open(path) as f:
    m = json.load(f)
m['host_permissions'] = [h for h in m['host_permissions']
                         if not h.startswith('http://remoteproof-api.test')]
with open(path, 'w') as f:
    json.dump(m, f, indent=2)
    f.write('\n')
PY

(cd "$BUILD" && zip -rq "$ZIP" . -x "*.DS_Store")

echo "Built: $ZIP ($(du -h "$ZIP" | cut -f1))"
echo "Contents:"
unzip -l "$ZIP"
