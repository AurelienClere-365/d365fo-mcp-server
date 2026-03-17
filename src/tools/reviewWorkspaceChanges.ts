import { z } from 'zod';
import { exec } from 'child_process';
import util from 'util';

const execAsync = util.promisify(exec);

export const reviewWorkspaceChangesToolDefinition = {
  name: 'review_workspace_changes',
  description: 'Fetches uncommitted X++ changes (git diff) and processes them into a clean format for AI Code Review against D365 Best Practices.',
  parameters: z.object({
    directoryPath: z.string().describe('The absolute path to the local repository')
  })
};

export const reviewWorkspaceChangesTool = async (params: any, _context: any) => {
  const { directoryPath } = params;
  try {
    const { stdout } = await execAsync('git diff HEAD --unified=3', { cwd: directoryPath });
    if (!stdout.trim()) {
      return { content: [{ type: 'text', text: 'No uncommitted changes found for review.' }] };
    }
    return {
      content: [{ type: 'text', text: 'Code Review Target (Git Diff):\n' + stdout }]
    };
  } catch (error: any) {
    return {
      content: [{ type: 'text', text: 'Error fetching changes: ' + error.message }],
      isError: true
    };
  }
};
