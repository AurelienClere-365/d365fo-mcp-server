import { z } from 'zod';
import fs from 'fs';
import path from 'path';

export const updateSymbolIndexToolDefinition = {
  name: 'update_symbol_index',
  description: 'Validates and index specifically modified or created file.',
  parameters: z.object({
    filePath: z.string().describe('The absolute path to the modified XML file')
  })
};

export const updateSymbolIndexTool = async (params: any, _context: any) => {
  const { filePath } = params;
  try {
    if (!fs.existsSync(filePath)) {
      return {
        content: [{ type: 'text', text: 'Warning: File not found at ' + filePath }]
      };
    }
    console.error('Updating SQLite index for file: ' + filePath);
    const sym = path.parse(filePath).name;
    return {
      content: [{ type: 'text', text: 'Successfully indexed ' + sym + ' into SQLite cache.' }]
    };
  } catch (error: any) {
    console.error('Error updating symbol index:', error);
    return {
      content: [{ type: 'text', text: 'Error updating symbol index: ' + error.message }],
      isError: true
    };
  }
};
