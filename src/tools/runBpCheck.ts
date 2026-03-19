import { z } from 'zod';
import { execFile } from 'child_process';
import util from 'util';
import path from 'path';
import fs from 'fs/promises';
import os from 'os';
import { getConfigManager } from '../utils/configManager.js';

const execFileAsync = util.promisify(execFile);

// Keyword that xppbp.exe prints when it doesn't recognise the arguments
const HELP_TEXT_PATTERN = /^usage:|BPCheck Tool|^xppbp\.exe|unrecognized|missing required/im;

export const runBpCheckToolDefinition = {
  name: 'run_bp_check',
  description: 'Runs xppbp.exe against the project to enforce Microsoft Best Practices.',
  parameters: z.object({
    projectPath: z.string().optional().describe('The absolute path to the .rnrproj file to check. Auto-detected from .mcp.json if omitted.'),
    targetFilter: z.string().optional().describe('Optional: filter results to a specific class, table, or object name'),
    modelName: z.string().optional().describe('Model name to check. Auto-detected from .mcp.json if omitted.'),
    packagePath: z.string().optional().describe('PackagesLocalDirectory root. Auto-detected if omitted.')
  })
};

/**
 * Attempt to run xppbp.exe with a given set of args.
 * Returns { stdout, stderr } or throws on non-zero exit / timeout.
 */
async function tryXppbp(xppbpPath: string, args: string[]): Promise<{ stdout: string; stderr: string }> {
  return execFileAsync(xppbpPath, args, {
    maxBuffer: 10 * 1024 * 1024,
    timeout: 300_000 // 5 minutes
  });
}

export const runBpCheckTool = async (params: any, _context: any) => {
  const { targetFilter } = params;
  try {
    const configManager = getConfigManager();
    await configManager.ensureLoaded();

    // Resolve package path
    const packagesRoot = params.packagePath
      || configManager.getPackagePath()
      || 'K:\\AosService\\PackagesLocalDirectory';

    // Resolve model name
    const modelName = params.modelName || configManager.getModelName();
    if (!modelName) {
      return {
        content: [{ type: 'text', text: '❌ Cannot determine model name.\n\nProvide modelName parameter or set it in .mcp.json.' }],
        isError: true
      };
    }

    // Resolve project path — required by most xppbp.exe versions
    const resolvedProjectPath = params.projectPath || await configManager.getProjectPath();
    if (!resolvedProjectPath) {
      return {
        content: [{
          type: 'text',
          text: '❌ Cannot determine project path.\n\nProvide projectPath parameter or set it in .mcp.json:\n```json\n{ "servers": { "context": { "projectPath": "C:\\\\path\\\\to\\\\MyProject.rnrproj" } } }\n```'
        }],
        isError: true
      };
    }

    // Locate xppbp.exe
    const xppbpPath = path.join(packagesRoot, 'Bin', 'xppbp.exe');
    try {
      await fs.access(xppbpPath);
    } catch {
      return {
        content: [{ type: 'text', text: `❌ xppbp.exe not found at: ${xppbpPath}\n\nMake sure PackagesLocalDirectory is correctly configured in .mcp.json (packagePath).` }],
        isError: true
      };
    }

    // Temp XML log file — xppbp writes structured results here
    const logFile = path.join(os.tmpdir(), `xppbp_${Date.now()}.xml`);

    /**
     * Build the args array for one invocation attempt.
     * D365FO 10.0.20+ uses  -metadata:<path>  (preferred).
     * Older builds used      -packagesroot:<path>.
     * We try the modern flag first and fall back on the legacy flag when
     * the output looks like the xppbp help/usage text.
     */
    const buildArgs = (metadataFlag: '-metadata:' | '-packagesroot:'): string[] => {
      const a: string[] = [
        `${metadataFlag}${packagesRoot}`,
        `-model:${modelName}`,
        `-vsproj:${resolvedProjectPath}`,
        `-xmlLog:${logFile}`
      ];
      if (targetFilter) a.push(`-filter:${targetFilter}`);
      return a;
    };

    let stdout = '';
    let stderr = '';

    // --- First attempt: modern -metadata: flag ---
    const args = buildArgs('-metadata:');
    console.error(`[run_bp_check] Attempt 1: "${xppbpPath}" ${args.join(' ')}`);
    try {
      ({ stdout, stderr } = await tryXppbp(xppbpPath, args));
    } catch (e: any) {
      stdout = e.stdout ?? '';
      stderr = e.stderr ?? '';
    }

    let combined = [stdout, stderr].filter(Boolean).join('\n').trim();

    // --- Fallback: legacy -packagesroot: flag ---
    if (HELP_TEXT_PATTERN.test(combined) || combined === '') {
      const fallbackArgs = buildArgs('-packagesroot:');
      console.error(`[run_bp_check] Attempt 2 (legacy flag): "${xppbpPath}" ${fallbackArgs.join(' ')}`);
      try {
        ({ stdout, stderr } = await tryXppbp(xppbpPath, fallbackArgs));
      } catch (e: any) {
        stdout = e.stdout ?? '';
        stderr = e.stderr ?? '';
      }
      combined = [stdout, stderr].filter(Boolean).join('\n').trim();

      // If still showing help text, report a useful diagnostic
      if (HELP_TEXT_PATTERN.test(combined)) {
        return {
          content: [{
            type: 'text',
            text: `❌ xppbp.exe returned its help text for both -metadata: and -packagesroot: flags.\n\nThis usually means the installed xppbp.exe version uses a different CLI.\n\nRaw output:\n\n${combined}`
          }],
          isError: true
        };
      }
    }

    // --- Read XML log file if xppbp wrote one ---
    let logContent = '';
    try {
      logContent = await fs.readFile(logFile, 'utf-8');
      await fs.unlink(logFile).catch(() => { /* best-effort cleanup */ });
    } catch {
      // xppbp didn't write a log file — fall back to stdout/stderr
      logContent = combined;
    }

    // Detect violations in XML log or plain text output
    const hasErrors = /BPError|BPCheck|<Diagnostic|severity="error"/i.test(logContent)
      || /BPError|BPCheck/i.test(combined);

    const summary = hasErrors ? '⚠️ BP Check completed with issues' : '✅ BP Check passed';
    const details = logContent || combined || '(no output)';

    return {
      content: [{
        type: 'text',
        text: `${summary}\n\nModel: ${modelName}\nProject: ${resolvedProjectPath}` +
          (targetFilter ? `\nFilter: ${targetFilter}` : '') +
          `\n\n${details}`
      }]
    };
  } catch (error: any) {
    console.error('Error running BP Check:', error);
    const output = [error.stdout, error.stderr, error.message].filter(Boolean).join('\n');
    return {
      content: [{ type: 'text', text: '❌ BP Check failed:\n\n' + output }],
      isError: true
    };
  }
};
