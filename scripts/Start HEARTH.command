#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
if ! command -v node >/dev/null 2>&1; then
  echo 'Install Node.js 24 LTS from nodejs.org, then open this file again.'
  read -r -p 'Press Return to close.'
  exit 1
fi
if [ ! -d node_modules ]; then npm ci --no-audit --no-fund; fi
if [ ! -f dist/index.html ]; then npm run build; fi
npm run desktop
