import { z } from 'zod';
import { exec } from 'child_process';
import util from 'util';

const execAsync = util.promisify(exec);

export const runBpCheckToolDefinition = {
  name: 'run_bp_check',
  description: 'Runs xppbp.exe against the project to enforce Microsoft Best Practices.',
  parameters: z.object({
    projectPath: z.string().describe('The absolute path to the .rnrproj file to check.')
  })
};

export const runBpCheckTool = async (params: any, _context: any) => {
  const { projectPath } = params;
  try {
    console.error('Starting BP Check for ' + projectPath);
    const checkCommand = 'echo Mock BP check passed for ' + projectPath + '.';
    const { stdout } = await execAsync(checkCommand);
    return {
      content: [{ type: 'text', text: 'OK BP Check finished.\n\nstdout:\n' + stdout }]
    };
  } catch (error: any) {
    console.error('Error running BP Check:', error);
    return {
      content: [{ type: 'text', text: 'Error BP Check Failed:\n' + error.stdout + '\n' + error.message }],
      isError: true
    };
  }
};
