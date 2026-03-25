import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { LOCAL_TOOLS } from '../../src/server/serverMode';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '../..');

function readRepoFile(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

function extractSingleQuotedToolNames(source: string): string[] {
  const names = [...source.matchAll(/name:\s*'([^']+)'/g)].map(match => match[1]);
  return [...new Set(names)];
}

describe('tool inventory contract', () => {
  const mcpServerSource = readRepoFile('src/server/mcpServer.ts');
  const startupCatalogSource = readRepoFile('src/index.ts');

  const mcpServerToolNames = extractSingleQuotedToolNames(mcpServerSource);
  const startupCatalogToolNames = extractSingleQuotedToolNames(startupCatalogSource);

  it('keeps mcpServer tools and startup catalog in sync', () => {
    expect(new Set(startupCatalogToolNames)).toEqual(new Set(mcpServerToolNames));
  });

  it('exposes the expected total tool count', () => {
    expect(mcpServerToolNames).toHaveLength(54);
    expect(startupCatalogToolNames).toHaveLength(54);
  });

  it('keeps local-only tool set aligned with the published tool inventory', () => {
    const publishedTools = new Set(mcpServerToolNames);
    for (const toolName of LOCAL_TOOLS) {
      expect(publishedTools.has(toolName)).toBe(true);
    }

    expect(LOCAL_TOOLS.size).toBe(25);
    expect(mcpServerToolNames.filter(name => !LOCAL_TOOLS.has(name))).toHaveLength(29);
  });

  it('includes critical diagnostics and SDLC tools in both inventories', () => {
    const criticalTools = [
      'get_workspace_info',
      'get_d365fo_error_help',
      'update_symbol_index',
      'build_d365fo_project',
      'run_bp_check',
      'run_systest_class',
    ];

    for (const toolName of criticalTools) {
      expect(mcpServerToolNames).toContain(toolName);
      expect(startupCatalogToolNames).toContain(toolName);
    }
  });
});
