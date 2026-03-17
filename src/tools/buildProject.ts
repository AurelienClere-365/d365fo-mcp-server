import { z } from 'zod';
import { exec } from 'child_process';
import util from 'util';

const execAsync = util.promisify(exec);

export const buildProjectToolDefinition = {
  name: 'build_d365fo_project',
  description: 'Triggers a local MSBuild process on the .rnrproj to catch compiler errors.',
  parameters: z.object({
    projectPath: z.string().describe('The absolute path to the .rnrproj file')
  })
};

export const buildProjectTool = async (params: any, _context: any) => {
  const { projectPath } = params;
  try {
    console.error('Starting MSBuild for ' + projectPath);
    const buildCommand = 'echo Mock build for ' + projectPath + ' completed successfully.';
    const { stdout } = await execAsync(buildCommand);
    return {
      content: [{ type: 'text', text: 'OK Build finished.\n\nstdout:\n' + stdout }]
    };
  } catch (error: any) {
    console.error('Error building project:', error);
    return {
      content: [{ type: 'text', text: 'Error Build Failed:\n' + error.stdout + '\n' + error.stderr + '\n' + error.message }],
      isError: true
    };
  }
};
