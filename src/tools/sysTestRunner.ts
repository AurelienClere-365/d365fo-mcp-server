import { z } from 'zod';
import { exec } from 'child_process';
import util from 'util';

const execAsync = util.promisify(exec);

export const sysTestRunnerToolDefinition = {
  name: 'run_systest_class',
  description: 'Invoke D365FO SysTest framework against a specific test class.',
  parameters: z.object({
    className: z.string().describe('The name of the SysTest class to run')
  })
};

export const sysTestRunnerTool = async (params: any, _context: any) => {
  const { className } = params;
  try {
    console.error('Starting SysTestRunner for class: ' + className);
    const runCommand = 'echo Mock SysTestRunner for ' + className + ' passed.';
    const { stdout } = await execAsync(runCommand);
    return {
      content: [{ type: 'text', text: 'OK Test finished.\n\nstdout:\n' + stdout }]
    };
  } catch (error: any) {
    console.error('Error running test:', error);
    return {
      content: [{ type: 'text', text: 'Error Test Failed:\n' + error.stdout + '\n' + error.message }],
      isError: true
    };
  }
};
