import { z } from 'zod';
import { exec } from 'child_process';
import util from 'util';
import fs from 'fs';

const execAsync = util.promisify(exec);

export const undoLastModificationToolDefinition = {
  name: 'undo_last_modification',
  description: 'Undos the latest uncommitted changes or creation of a specific file by running git checkout, reverting it to its last committed state.',
  parameters: z.object({
    filePath: z.string().describe('The absolute path to the file to revert')
  })
};

export const undoLastModificationTool = async (params: any, _context: any) => {
  const { filePath } = params;
  try {
    try {
      await execAsync('git ls-files --error-unmatch "' + filePath + '"');
      await execAsync('git checkout HEAD -- "' + filePath + '"');
      return {
         content: [{ type: 'text', text: 'Successfully reverted tracked file modification: ' + filePath }]
      };
    } catch {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        return {
          content: [{ type: 'text', text: 'Successfully undid file creation (deleted untracked file): ' + filePath }]
        };
      } else {
        return {
          content: [{ type: 'text', text: 'File not found and not tracked by git: ' + filePath }]
        };
      }
    }
  } catch (error: any) {
    return {
      content: [{ type: 'text', text: 'Error undoing modifications: ' + error.message }],
      isError: true
    };
  }
};
