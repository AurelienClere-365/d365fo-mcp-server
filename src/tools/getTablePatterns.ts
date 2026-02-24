/**
 * Get Table Patterns Tool
 * Analyzes common field types, index patterns, and relation structures
 * Used for smart table generation
 */

import type { CallToolRequest } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import type { XppServerContext } from '../types/context.js';

const GetTablePatternsArgsSchema = z.object({
  tableGroup: z.enum(['Main', 'Transaction', 'Parameter', 'Group', 'Reference', 'Miscellaneous', 'WorksheetHeader', 'WorksheetLine'])
    .optional()
    .describe('Table group to analyze (Main, Transaction, Parameter, etc.)'),
  similarTo: z.string().optional().describe('Table name to find similar patterns'),
  limit: z.number().optional().default(10).describe('Maximum number of examples to return'),
});

export interface FieldPattern {
  name: string;
  edt: string;
  frequency: number;
  mandatoryCount: number;
}

export interface IndexPattern {
  fields: string[];
  unique: boolean;
  frequency: number;
}

export interface RelationPattern {
  targetTable: string;
  frequency: number;
  constraints: Array<{ field: string; relatedField: string }>;
}

export async function handleGetTablePatterns(
  args: { tableGroup?: string; similarTo?: string; limit?: number },
  symbolIndex: any
): Promise<any> {
  const { tableGroup, similarTo, limit = 10 } = args;
  let output = `# Table Patterns Analysis\n\n`;

  if (similarTo) {
    output += `## 📊 Patterns Similar to \`${similarTo}\`\n\n`;
    output += await analyzeSimilarTable(symbolIndex, similarTo, limit);
  } else if (tableGroup) {
    output += `## 📊 Common Patterns for ${tableGroup} Tables\n\n`;
    output += await analyzeTableGroup(symbolIndex, tableGroup, limit);
  } else {
    throw new Error('Either tableGroup or similarTo must be provided');
  }

  return {
    content: [{ type: 'text', text: output }],
  };
}

export async function getTablePatternsTool(request: CallToolRequest, context: XppServerContext) {
  try {
    const args = GetTablePatternsArgsSchema.parse(request.params.arguments);
    const { symbolIndex } = context;
    const { tableGroup, similarTo, limit } = args;

    let output = `# Table Patterns Analysis\n\n`;

    if (similarTo) {
      // Find similar table and analyze it
      output += `## 📊 Patterns Similar to \`${similarTo}\`\n\n`;
      output += await analyzeSimilarTable(symbolIndex, similarTo, limit);
    } else if (tableGroup) {
      // Analyze patterns for table group
      output += `## 📊 Common Patterns for ${tableGroup} Tables\n\n`;
      output += await analyzeTableGroup(symbolIndex, tableGroup, limit);
    } else {
      throw new Error('Either tableGroup or similarTo must be provided');
    }

    return {
      content: [{ type: 'text', text: output }],
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `❌ Error analyzing table patterns: ${error instanceof Error ? error.message : 'Unknown error'}`,
        },
      ],
      isError: true,
    };
  }
}

async function analyzeSimilarTable(symbolIndex: any, tableName: string, limit: number): Promise<string> {
  // Get table info
  const tableRow = symbolIndex.db.prepare(`
    SELECT * FROM symbols WHERE type = 'table' AND name = ? LIMIT 1
  `).get(tableName);

  if (!tableRow) {
    throw new Error(`Table "${tableName}" not found`);
  }

  // Get fields
  const fields = symbolIndex.db.prepare(`
    SELECT name, signature FROM symbols 
    WHERE type = 'field' AND parent_name = ?
    ORDER BY name
  `).all(tableName) as Array<{ name: string; signature: string }>;

  // Get relations
  const relations = symbolIndex.db.prepare(`
    SELECT target_table, relation_name, constraint_fields 
    FROM table_relations 
    WHERE source_table = ?
    LIMIT ${limit}
  `).all(tableName) as Array<{ target_table: string; relation_name: string; constraint_fields: string | null }>;

  let output = `**Table:** \`${tableName}\`\n\n`;
  
  output += `### Fields (${fields.length})\n\n`;
  output += `| Field Name | Type/EDT |\n`;
  output += `|------------|----------|\n`;
  for (const field of fields.slice(0, limit)) {
    output += `| ${field.name} | ${field.signature || 'Unknown'} |\n`;
  }
  if (fields.length > limit) {
    output += `\n... (${fields.length - limit} more fields)\n`;
  }

  if (relations.length > 0) {
    output += `\n### Relations (${relations.length})\n\n`;
    output += `| Target Table | Relation Name |\n`;
    output += `|--------------|---------------|\n`;
    for (const rel of relations) {
      output += `| ${rel.target_table} | ${rel.relation_name} |\n`;
    }
  }

  // Find similar tables based on field patterns
  output += `\n### Similar Tables\n\n`;
  const fieldEdts = fields.map(f => f.signature).filter(Boolean);
  if (fieldEdts.length > 0) {
    // Find tables with overlapping EDTs
    const similarTables = symbolIndex.db.prepare(`
      SELECT DISTINCT s.parent_name as table_name, COUNT(*) as match_count
      FROM symbols s
      WHERE s.type = 'field' 
        AND s.signature IN (${fieldEdts.map(() => '?').join(',')})
        AND s.parent_name != ?
      GROUP BY s.parent_name
      ORDER BY match_count DESC
      LIMIT 5
    `).all(...fieldEdts, tableName) as Array<{ table_name: string; match_count: number }>;

    for (const similar of similarTables) {
      output += `- **${similar.table_name}** (${similar.match_count} matching field types)\n`;
    }
  }

  return output;
}

async function analyzeTableGroup(symbolIndex: any, tableGroup: string, limit: number): Promise<string> {
  let output = '';

  // Get sample tables from this group
  // Note: We don't have tableGroup in symbols table, so we'll use heuristics
  // Transaction tables often have "Trans" in name
  // Parameter tables often have "Parameters" suffix
  let namePattern = '';
  if (tableGroup === 'Transaction') {
    namePattern = '%Trans%';
  } else if (tableGroup === 'Parameter') {
    namePattern = '%Parameters';
  } else if (tableGroup === 'Main') {
    namePattern = '%Table';
  }

  const sampleTables = symbolIndex.db.prepare(`
    SELECT DISTINCT name, model 
    FROM symbols 
    WHERE type = 'table' 
      ${namePattern ? `AND name LIKE ?` : ''}
    LIMIT ${limit}
  `).all(...(namePattern ? [namePattern] : [])) as Array<{ name: string; model: string }>;

  if (sampleTables.length === 0) {
    output += `No sample tables found for ${tableGroup} group.\n\n`;
    output += `**Recommendation:** Provide a \`similarTo\` table name for better pattern analysis.\n`;
    return output;
  }

  output += `**Sample Tables Found:** ${sampleTables.length}\n\n`;

  // Analyze common field patterns
  const fieldPatternMap = new Map<string, { edt: string; count: number }>();

  for (const table of sampleTables) {
    const fields = symbolIndex.db.prepare(`
      SELECT name, signature FROM symbols 
      WHERE type = 'field' AND parent_name = ?
    `).all(table.name) as Array<{ name: string; signature: string }>;

    for (const field of fields) {
      if (!field.signature) continue;
      const key = `${field.name}:${field.signature}`;
      const existing = fieldPatternMap.get(key);
      if (existing) {
        existing.count++;
      } else {
        fieldPatternMap.set(key, { edt: field.signature, count: 1 });
      }
    }
  }

  // Sort by frequency
  const commonFields = Array.from(fieldPatternMap.entries())
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 15);

  output += `### Common Fields\n\n`;
  output += `| Field Name | EDT/Type | Frequency |\n`;
  output += `|------------|----------|----------|\n`;
  for (const [key, data] of commonFields) {
    const fieldName = key.split(':')[0];
    const frequency = `${data.count}/${sampleTables.length}`;
    output += `| ${fieldName} | ${data.edt} | ${frequency} |\n`;
  }

  // Analyze common relations
  const relationMap = new Map<string, number>();
  for (const table of sampleTables) {
    const relations = symbolIndex.db.prepare(`
      SELECT target_table FROM table_relations WHERE source_table = ?
    `).all(table.name) as Array<{ target_table: string }>;

    for (const rel of relations) {
      relationMap.set(rel.target_table, (relationMap.get(rel.target_table) || 0) + 1);
    }
  }

  if (relationMap.size > 0) {
    const commonRelations = Array.from(relationMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    output += `\n### Common Relations\n\n`;
    output += `| Target Table | Frequency |\n`;
    output += `|--------------|----------|\n`;
    for (const [targetTable, count] of commonRelations) {
      output += `| ${targetTable} | ${count}/${sampleTables.length} |\n`;
    }
  }

  output += `\n### 💡 Recommendations\n\n`;
  output += `Based on analysis of ${sampleTables.length} ${tableGroup} tables:\n\n`;
  if (commonFields.length > 0) {
    output += `**Common Fields to Consider:**\n`;
    for (const [key, data] of commonFields.slice(0, 5)) {
      const fieldName = key.split(':')[0];
      output += `- \`${fieldName}\` (${data.edt})\n`;
    }
  }

  return output;
}

export const getTablePatternsToolDefinition = {
  name: 'get_table_patterns',
  description: '📊 Analyze common field types, index patterns, and relation structures for table groups. Helps generate smart table structures based on existing patterns. Use tableGroup for general patterns or similarTo for specific table analysis.',
  inputSchema: GetTablePatternsArgsSchema,
};
