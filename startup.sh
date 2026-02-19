#!/bin/bash
# Azure App Service Startup Script

set -e

echo "Starting D365 F&O MCP Server..."
echo "  PORT:     ${PORT:-8080}"
echo "  NODE_ENV: ${NODE_ENV:-production}"
echo "  Node:     $(node --version)"

# Verify dist directory exists
if [ ! -d "dist" ]; then
  echo "Error: dist directory not found. Run 'npm run build' before deployment."
  exit 1
fi

# Start the server (database download happens within the app if configured)
# Note: native addons (better-sqlite3) are compiled by Oryx during deployment
# via SCM_DO_BUILD_DURING_DEPLOYMENT=true — no rebuild needed at runtime.
echo "Starting server..."
exec node dist/index.js
