#!/bin/bash
set -eu
cd /workspace/bigback777
node -e 'const major=Number(process.versions.node.split(".")[0]);if(major!==24)throw new Error("HEARTH setup requires Node.js 24")'
export NODE_USE_SYSTEM_CA=1
export ELECTRON_GET_USE_PROXY=1
if [ -n "${HTTPS_PROXY:-}" ]; then
  export GLOBAL_AGENT_HTTP_PROXY="$HTTPS_PROXY"
fi
npm ci --no-audit --no-fund
npm run build
npm run build:server
npm test
