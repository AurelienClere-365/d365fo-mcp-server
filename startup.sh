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

# Verify better-sqlite3 native addon is loadable.
# If this fails, the deployment was done without pre-compiled node_modules.
# Fix: run the d365fo-mcp-app-deploy pipeline which compiles on ubuntu-latest
# and ships pre-built binaries — App Service has no make/gcc to rebuild here.
if ! node -e "require('better-sqlite3')" 2>/dev/null; then
  echo "FATAL: better-sqlite3 binary is incompatible with Node $(node --version)."
  echo "Deploy using the d365fo-mcp-app-deploy pipeline to ship pre-built binaries."
  exit 1
fi

# Start the server (database download happens within the app if configured)
echo "Starting server..."
exec node dist/index.js
