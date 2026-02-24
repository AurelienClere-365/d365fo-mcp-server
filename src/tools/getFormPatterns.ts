/**
 * Get Form Patterns Tool
 * Analyzes common datasource configurations, control hierarchies, and form patterns
 * Used for smart form generation
 */

import type { CallToolRequest } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import type { XppServerContext } from '../types/context.js';

const GetFormPatternsArgsSchema = z.object({
  formPattern: z.enum(['DetailsTransaction', 'ListPage', 'SimpleList', 'SimpleListDetails', 'Dialog', 'DropDialog', 'FormPart', 'Lookup'])
    .optional()
    .describe('D365FO form pattern to analyze'),
  similarTo: z.string().optional().describe('Form name to find similar patterns'),
  dataSource: z.string().optional().describe('Table name - find forms using this table'),
  limit: z.number().optional().default(10).describe('Maximum number of examples to return'),
});

export async function handleGetFormPatterns(
  args: { formPattern?: string; dataSource?: string; tableName?: string; limit?: number },
  symbolIndex: any
): Promise<any> {
  const { formPattern, limit = 10 } = args;
  const tableName = args.dataSource || args.tableName;
  let output = `# Form Patterns Analysis\n\n`;

  if (tableName) {
    output += `## 📋 Forms Using Table: \`${tableName}\`\n\n`;
    output += await analyzeFormsUsingTable(symbolIndex, tableName, limit);
  } else if (formPattern) {
    output += `## 📋 Forms with Pattern: \`${formPattern}\`\n\n`;
    output += await analyzeFormPattern(symbolIndex, formPattern, limit);
  } else {
    throw new Error('Must provide either formPattern or tableName');
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

export async function getFormPatternsTool(request: CallToolRequest, context: XppServerContext) {
  try {
    const args = GetFormPatternsArgsSchema.parse(request.params.arguments);
    const { symbolIndex } = context;
    const { formPattern, similarTo, dataSource, limit } = args;

    let output = `# Form Patterns Analysis\n\n`;

    if (similarTo) {
      // Find similar form and analyze it
      output += `## 📋 Patterns Similar to Form \`${similarTo}\`\n\n`;
      output += await analyzeSimilarForm(symbolIndex, similarTo, limit);
    } else if (dataSource) {
      // Find forms using this table
      output += `## 📋 Forms Using Table \`${dataSource}\`\n\n`;
      output += await analyzeFormsUsingTable(symbolIndex, dataSource, limit);
    } else if (formPattern) {
      // Analyze patterns for form pattern type
      output += `## 📋 Common Patterns for ${formPattern} Forms\n\n`;
      output += await analyzeFormPattern(symbolIndex, formPattern, limit);
    } else {
      throw new Error('Either formPattern, similarTo, or dataSource must be provided');
    }

    return {
      content: [{ type: 'text', text: output }],
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `❌ Error analyzing form patterns: ${error instanceof Error ? error.message : 'Unknown error'}`,
        },
      ],
      isError: true,
    };
  }
}

async function analyzeSimilarForm(symbolIndex: any, formName: string, limit: number): Promise<string> {
  // Get form info
  const formRow = symbolIndex.db.prepare(`
    SELECT * FROM symbols WHERE type = 'form' AND name = ? LIMIT 1
  `).get(formName);

  if (!formRow) {
    throw new Error(`Form "${formName}" not found`);
  }

  // Get datasources
  const datasources = symbolIndex.db.prepare(`
    SELECT datasource_name, table_name, allow_edit, allow_create, allow_delete
    FROM form_datasources
    WHERE form_name = ?
    LIMIT ${limit}
  `).all(formName) as Array<{
    datasource_name: string;
    table_name: string;
    allow_edit: number;
    allow_create: number;
    allow_delete: number;
  }>;

  let output = `**Form:** \`${formName}\`\n`;
  output += `**Model:** ${formRow.model}\n\n`;

  if (datasources.length > 0) {
    output += `### DataSources (${datasources.length})\n\n`;
    output += `| DataSource Name | Table | Edit | Create | Delete |\n`;
    output += `|-----------------|-------|------|--------|--------|\n`;
    for (const ds of datasources) {
      const edit = ds.allow_edit ? '✅' : '❌';
      const create = ds.allow_create ? '✅' : '❌';
      const del = ds.allow_delete ? '✅' : '❌';
      output += `| ${ds.datasource_name} | ${ds.table_name} | ${edit} | ${create} | ${del} |\n`;
    }
  } else {
    output += `**No datasources indexed** (form may need re-extraction with enhanced parser)\n\n`;
  }

  // Find similar forms based on datasource tables
  if (datasources.length > 0) {
    output += `\n### Similar Forms (Using Same Tables)\n\n`;
    const tables = datasources.map(ds => ds.table_name);
    const similarForms = symbolIndex.db.prepare(`
      SELECT DISTINCT form_name, COUNT(DISTINCT table_name) as match_count
      FROM form_datasources
      WHERE table_name IN (${tables.map(() => '?').join(',')})
        AND form_name != ?
      GROUP BY form_name
      ORDER BY match_count DESC
      LIMIT 5
    `).all(...tables, formName) as Array<{ form_name: string; match_count: number }>;

    for (const similar of similarForms) {
      output += `- **${similar.form_name}** (${similar.match_count} matching datasources)\n`;
    }
  }

  return output;
}

async function analyzeFormsUsingTable(symbolIndex: any, tableName: string, limit: number): Promise<string> {
  // Find forms using this table
  const forms = symbolIndex.db.prepare(`
    SELECT DISTINCT form_name, datasource_name, allow_edit, allow_create, allow_delete
    FROM form_datasources
    WHERE table_name = ?
    LIMIT ${limit}
  `).all(tableName) as Array<{
    form_name: string;
    datasource_name: string;
    allow_edit: number;
    allow_create: number;
    allow_delete: number;
  }>;

  let output = `**Table:** \`${tableName}\`\n\n`;

  if (forms.length === 0) {
    output += `No forms found using this table. This could mean:\n`;
    output += `- Table is new and not yet used in forms\n`;
    output += `- Forms need re-extraction with enhanced parser\n`;
    output += `- Table is used only in code, not in form datasources\n\n`;
    return output;
  }

  output += `**Forms Found:** ${forms.length}\n\n`;
  output += `| Form Name | DataSource Name | Edit | Create | Delete |\n`;
  output += `|-----------|-----------------|------|--------|--------|\n`;

  for (const form of forms) {
    const edit = form.allow_edit ? '✅' : '❌';
    const create = form.allow_create ? '✅' : '❌';
    const del = form.allow_delete ? '✅' : '❌';
    output += `| ${form.form_name} | ${form.datasource_name} | ${edit} | ${create} | ${del} |\n`;
  }

  // Analyze common permission patterns
  const editableCount = forms.filter(f => f.allow_edit).length;
  const creatableCount = forms.filter(f => f.allow_create).length;
  const deletableCount = forms.filter(f => f.allow_delete).length;

  output += `\n### 💡 Common Patterns\n\n`;
  output += `- **Allow Edit:** ${editableCount}/${forms.length} forms\n`;
  output += `- **Allow Create:** ${creatableCount}/${forms.length} forms\n`;
  output += `- **Allow Delete:** ${deletableCount}/${forms.length} forms\n`;

  return output;
}

async function analyzeFormPattern(symbolIndex: any, formPattern: string, limit: number): Promise<string> {
  let output = `**Pattern:** ${formPattern}\n\n`;

  // Get sample forms (heuristic based on naming conventions)
  // DetailsTransaction forms often end with simple table names
  // ListPage forms often end with "ListPage"
  let namePattern = '';
  if (formPattern === 'ListPage') {
    namePattern = '%ListPage';
  } else if (formPattern === 'Dialog') {
    namePattern = '%Dialog';
  } else if (formPattern === 'Lookup') {
    namePattern = '%Lookup';
  }

  const sampleForms = symbolIndex.db.prepare(`
    SELECT DISTINCT name, model 
    FROM symbols 
    WHERE type = 'form'
      ${namePattern ? `AND name LIKE ?` : ''}
    LIMIT ${limit}
  `).all(...(namePattern ? [namePattern] : [])) as Array<{ name: string; model: string }>;

  if (sampleForms.length === 0) {
    output += `No sample forms found for ${formPattern} pattern.\n\n`;
    output += `**Recommendation:**\n`;
    output += `- Use \`similarTo\` parameter with a known form name\n`;
    output += `- Or use \`dataSource\` parameter to find forms using a specific table\n`;
    return output;
  }

  output += `**Sample Forms Found:** ${sampleForms.length}\n\n`;

  // Analyze datasource patterns
  const dsPatternMap = new Map<string, { count: number; permissions: { edit: number; create: number; delete: number } }>();

  for (const form of sampleForms) {
    const datasources = symbolIndex.db.prepare(`
      SELECT table_name, allow_edit, allow_create, allow_delete
      FROM form_datasources
      WHERE form_name = ?
    `).all(form.name) as Array<{
      table_name: string;
      allow_edit: number;
      allow_create: number;
      allow_delete: number;
    }>;

    for (const ds of datasources) {
      const existing = dsPatternMap.get(ds.table_name);
      if (existing) {
        existing.count++;
        existing.permissions.edit += ds.allow_edit;
        existing.permissions.create += ds.allow_create;
        existing.permissions.delete += ds.allow_delete;
      } else {
        dsPatternMap.set(ds.table_name, {
          count: 1,
          permissions: {
            edit: ds.allow_edit,
            create: ds.allow_create,
            delete: ds.allow_delete,
          },
        });
      }
    }
  }

  const commonTables = Array.from(dsPatternMap.entries())
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 10);

  if (commonTables.length > 0) {
    output += `### Common DataSource Tables\n\n`;
    output += `| Table Name | Frequency | Typical Permissions |\n`;
    output += `|------------|-----------|---------------------|\n`;
    for (const [tableName, data] of commonTables) {
      const freq = `${data.count}/${sampleForms.length}`;
      const editPct = Math.round((data.permissions.edit / data.count) * 100);
      const createPct = Math.round((data.permissions.create / data.count) * 100);
      const deletePct = Math.round((data.permissions.delete / data.count) * 100);
      const perms = `E:${editPct}% C:${createPct}% D:${deletePct}%`;
      output += `| ${tableName} | ${freq} | ${perms} |\n`;
    }
  }

  output += `\n### 💡 Recommendations for ${formPattern}\n\n`;
  
  if (formPattern === 'ListPage') {
    output += `- Typically read-only with grid control\n`;
    output += `- Single datasource with filtered fields\n`;
    output += `- Action buttons for navigation to detail forms\n`;
  } else if (formPattern === 'DetailsTransaction') {
    output += `- Editable with header/lines pattern\n`;
    output += `- Multiple datasources (header + line items)\n`;
    output += `- FastTabs for grouping fields\n`;
  } else if (formPattern === 'Dialog') {
    output += `- Simple input form with OK/Cancel buttons\n`;
    output += `- Limited fields, focused on specific task\n`;
    output += `- No datasource or temporary table datasource\n`;
  }

  return output;
}

export const getFormPatternsToolDefinition = {
  name: 'get_form_patterns',
  description: '📋 Analyze common datasource configurations, control hierarchies, and form patterns. Helps generate smart forms based on D365FO patterns. Use formPattern for general patterns, similarTo for specific form analysis, or dataSource to find forms using a table.',
  inputSchema: GetFormPatternsArgsSchema,
};
