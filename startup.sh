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

# Rebuild native addons for the current Node.js version and platform.
# This is required when the deployment package was built on a different
# Node.js version or architecture than the App Service runtime.
if ! node -e "require('better-sqlite3')" 2>/dev/null; then
  echo "Rebuilding better-sqlite3 for current Node.js version..."
  npm rebuild better-sqlite3
fi

# Start the server (database download happens within the app if configured)
echo "Starting server..."
exec node dist/index.js
