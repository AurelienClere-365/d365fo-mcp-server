/**
 * Get Enum Info Tool
 * Extract enum values and Extended Data Type (EDT) properties
 * Returns enum values with labels, EDT configuration
 */

import type { CallToolRequest } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import type { XppServerContext } from '../types/context.js';
import { promises as fs } from 'fs';
import { parseStringPromise } from 'xml2js';

const GetEnumInfoArgsSchema = z.object({
  enumName: z.string().describe('Name of the enum or EDT'),
  modelName: z.string().optional().describe('Model name (auto-detected if not provided)'),
  includeLabels: z.boolean().optional().default(true).describe('Include enum value labels'),
  includeWorkspace: z.boolean().optional().default(false).describe('Include workspace files'),
  workspacePath: z.string().optional().describe('Path to workspace'),
});

interface EnumValue {
  name: string;
  value: number;
  label?: string;
}

interface EnumInfo {
  name: string;
  model: string;
  type: 'enum' | 'edt';
  isExtensible: boolean;
  useEnumValue: boolean;
  values: EnumValue[];
  baseType?: string;
  edtProperties?: Record<string, string>;
}

export async function getEnumInfoTool(request: CallToolRequest, context: XppServerContext) {
  try {
    const args = GetEnumInfoArgsSchema.parse(request.params.arguments);
    const { symbolIndex } = context;
    const { 
      enumName, 
      modelName, 
      includeLabels
    } = args;

    // 1. Try to find as enum first
    let stmt;
    if (modelName) {
      stmt = symbolIndex.db.prepare(`
        SELECT file_path, model, name, type
        FROM symbols
        WHERE (type = 'enum' OR type = 'edt') AND name = ? AND model = ?
        LIMIT 1
      `);
      var enumRow = stmt.get(enumName, modelName) as any;
    } else {
      stmt = symbolIndex.db.prepare(`
        SELECT file_path, model, name, type
        FROM symbols
        WHERE (type = 'enum' OR type = 'edt') AND name = ?
        ORDER BY model
        LIMIT 1
      `);
      var enumRow = stmt.get(enumName) as any;
    }

    if (!enumRow) {
      throw new Error(`Enum or EDT "${enumName}" not found. Make sure it's indexed.`);
    }

    // 2. Parse XML
    const xmlContent = await fs.readFile(enumRow.file_path, 'utf-8');
    const xmlObj = await parseStringPromise(xmlContent);

    // 3. Extract enum/EDT info
    const enumInfo: EnumInfo = {
      name: enumName,
      model: enumRow.model,
      type: enumRow.type === 'edt' ? 'edt' : 'enum',
      isExtensible: false,
      useEnumValue: false,
      values: [],
    };

    // Check if it's an enum
    if (xmlObj.AxEnum) {
      extractEnumInfo(xmlObj.AxEnum, enumInfo, includeLabels);
    }
    // Check if it's an EDT
    else if (xmlObj.AxEdt) {
      extractEdtInfo(xmlObj.AxEdt, enumInfo);
    } else {
      throw new Error('Invalid enum or EDT XML structure');
    }

    // 4. Format output
    return formatEnumOutput(enumInfo, includeLabels);

  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `❌ Error getting enum info: ${error instanceof Error ? error.message : 'Unknown error'}`,
        },
      ],
      isError: true,
    };
  }
}

/**
 * Extract enum information
 */
function extractEnumInfo(axEnum: any, enumInfo: EnumInfo, includeLabels: boolean): void {
  // Extract properties
  if (axEnum.IsExtensible) {
    enumInfo.isExtensible = axEnum.IsExtensible[0] === 'Yes';
  }

  if (axEnum.UseEnumValue) {
    enumInfo.useEnumValue = axEnum.UseEnumValue[0] === 'Yes';
  }

  // Extract enum values
  if (axEnum.EnumValues && axEnum.EnumValues[0] && axEnum.EnumValues[0].AxEnumValue) {
    for (const valueNode of axEnum.EnumValues[0].AxEnumValue) {
      const value: EnumValue = {
        name: valueNode.Name ? valueNode.Name[0] : 'Unknown',
        value: valueNode.Value ? parseInt(valueNode.Value[0], 10) : 0,
      };

      if (includeLabels && valueNode.Label) {
        value.label = valueNode.Label[0];
      }

      enumInfo.values.push(value);
    }
  }
}

/**
 * Extract EDT information
 */
function extractEdtInfo(axEdt: any, enumInfo: EnumInfo): void {
  enumInfo.edtProperties = {};

  // Extract base type
  if (axEdt.Extends) {
    enumInfo.baseType = axEdt.Extends[0];
  }

  // Extract common EDT properties
  const edtProps = [
    'StringSize',
    'DisplayLength',
    'Label',
    'HelpText',
    'FormHelp',
    'Alignment',
    'DecimalSeparator',
    'SignDisplay',
    'NoOfDecimals',
    'EnumType',
  ];

  for (const prop of edtProps) {
    if (axEdt[prop]) {
      enumInfo.edtProperties[prop] = axEdt[prop][0];
    }
  }

  // If EDT is based on enum, get enum reference
  if (axEdt.EnumType) {
    enumInfo.baseType = axEdt.EnumType[0];
  }
}

/**
 * Format enum output
 */
function formatEnumOutput(enumInfo: EnumInfo, includeLabels: boolean): any {
  let output = `# ${enumInfo.type === 'edt' ? 'Extended Data Type' : 'Enum'}: \`${enumInfo.name}\`\n\n`;
  output += `**Model:** ${enumInfo.model}\n`;

  if (enumInfo.type === 'enum') {
    output += `**Extensible:** ${enumInfo.isExtensible ? '✅' : '❌'}\n`;
    output += `**Use Enum Value:** ${enumInfo.useEnumValue ? '✅' : '❌'}\n`;
    output += `\n`;

    // Enum values
    if (enumInfo.values.length > 0) {
      output += `## 📋 Enum Values (${enumInfo.values.length})\n\n`;
      output += `| Name | Value${includeLabels ? ' | Label' : ''} |\n`;
      output += `|------|-------${includeLabels ? '|-------' : ''}|\n`;

      for (const value of enumInfo.values) {
        output += `| ${value.name} | ${value.value}`;
        if (includeLabels) {
          output += ` | ${value.label || '-'}`;
        }
        output += ` |\n`;
      }
      output += `\n`;
    }

    // Usage example
    output += `## 💡 Usage Example\n\n`;
    output += `\`\`\`xpp\n`;
    output += `// Assign enum value\n`;
    output += `${enumInfo.name} myEnum = ${enumInfo.name}::${enumInfo.values[0]?.name || 'Value'};\n\n`;
    output += `// Compare enum value\n`;
    output += `if (myEnum == ${enumInfo.name}::${enumInfo.values[0]?.name || 'Value'})\n`;
    output += `{\n`;
    output += `    // Do something\n`;
    output += `}\n`;
    output += `\`\`\`\n`;

  } else {
    // EDT
    output += `\n`;

    if (enumInfo.baseType) {
      output += `**Base Type:** \`${enumInfo.baseType}\`\n\n`;
    }

    if (enumInfo.edtProperties && Object.keys(enumInfo.edtProperties).length > 0) {
      output += `## 🔧 Properties\n\n`;
      output += `| Property | Value |\n`;
      output += `|----------|-------|\n`;

      for (const [key, value] of Object.entries(enumInfo.edtProperties)) {
        output += `| ${key} | ${value} |\n`;
      }
      output += `\n`;
    }

    // Usage example
    output += `## 💡 Usage Example\n\n`;
    output += `\`\`\`xpp\n`;
    output += `// Declare variable\n`;
    output += `${enumInfo.name} myValue;\n\n`;
    output += `// Assign value\n`;
    output += `myValue = "example";\n`;
    output += `\`\`\`\n`;
  }

  return {
    content: [
      {
        type: 'text',
        text: output,
      },
    ],
  };
}

export const getEnumInfoToolDefinition = {
  name: 'get_enum_info',
  description: '🏷️ Extract enum values and Extended Data Type (EDT) properties. Returns enum values with labels and numeric values, or EDT configuration (StringSize, Label, etc.). Essential for understanding enum options and EDT constraints.',
  inputSchema: GetEnumInfoArgsSchema,
};
