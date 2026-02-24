/**
 * Generate Smart Form Tool
 * AI-driven form generation using indexed metadata patterns
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { XppSymbolIndex } from '../metadata/symbolIndex.js';
import { SmartXmlBuilder, FormDataSourceSpec, FormControlSpec } from '../utils/smartXmlBuilder.js';
import { handleGetFormPatterns } from './getFormPatterns.js';
import path from 'path';
import fs from 'fs';
import { getConfigManager } from '../utils/configManager.js';

interface GenerateSmartFormArgs {
  name: string;
  label?: string;
  caption?: string;
  dataSource?: string;
  formPattern?: string;
  copyFrom?: string;
  generateControls?: boolean;
  modelName?: string;
  projectPath?: string;
  solutionPath?: string;
}

export const generateSmartFormTool: Tool = {
  name: 'generate_smart_form',
  description: 'Generate AxForm XML with AI-driven datasource/control suggestions based on indexed patterns. Can copy structure from existing forms, analyze form patterns, or auto-generate grid from table.',
  inputSchema: {
    type: 'object',
    properties: {
      name: {
        type: 'string',
        description: 'Form name (e.g., "MyCustomForm")',
      },
      label: {
        type: 'string',
        description: 'Optional label for the form',
      },
      caption: {
        type: 'string',
        description: 'Optional caption/title datasource',
      },
      dataSource: {
        type: 'string',
        description: 'Optional: Table name for primary datasource. Tool will auto-generate grid with fields.',
      },
      formPattern: {
        type: 'string',
        description: 'Optional: Form pattern (e.g., "SimpleList", "DetailsTransaction"). Tool will analyze similar forms.',
      },
      copyFrom: {
        type: 'string',
        description: 'Optional: Copy structure from existing form (name)',
      },
      generateControls: {
        type: 'boolean',
        description: 'If true, auto-generate grid controls for datasource fields',
      },
      modelName: {
        type: 'string',
        description: 'Model name for file creation (auto-detected from projectPath)',
      },
      projectPath: {
        type: 'string',
        description: 'Path to .rnrproj file (used to extract correct ModelName)',
      },
      solutionPath: {
        type: 'string',
        description: 'Path to solution directory (alternative to projectPath)',
      },
    },
    required: ['name'],
  },
};

export async function handleGenerateSmartForm(
  args: GenerateSmartFormArgs,
  symbolIndex: XppSymbolIndex
): Promise<any> {
  const {
    name,
    label,
    caption,
    dataSource,
    formPattern,
    copyFrom,
    generateControls,
    modelName,
    projectPath,
    solutionPath,
  } = args;

  console.log(`[generateSmartForm] Generating form: ${name}, dataSource=${dataSource}, pattern=${formPattern}, copyFrom=${copyFrom}`);

  const builder = new SmartXmlBuilder();
  let dataSources: FormDataSourceSpec[] = [];
  let controls: FormControlSpec[] = [];

  // Strategy 1: Copy from existing form
  if (copyFrom) {
    console.log(`[generateSmartForm] Copying structure from: ${copyFrom}`);
    try {
      const db = symbolIndex.db;

      // Copy datasources directly from form_datasources DB
      const dbDataSources = db.prepare(`
        SELECT datasource_name, table_name, allow_edit, allow_create, allow_delete
        FROM form_datasources
        WHERE form_name = ?
        ORDER BY datasource_name
      `).all(copyFrom) as Array<{
        datasource_name: string;
        table_name: string;
        allow_edit: number;
        allow_create: number;
        allow_delete: number;
      }>;

      if (dbDataSources.length === 0) {
        // Fall back: check if form exists at all
        const formExists = db.prepare(`
          SELECT name FROM symbols WHERE type = 'form' AND name = ? LIMIT 1
        `).get(copyFrom);

        if (!formExists) {
          throw new Error(`Form "${copyFrom}" not found in index`);
        }
        console.warn(`[generateSmartForm] Form "${copyFrom}" found but has no indexed datasources`);
      }

      dataSources = dbDataSources.map((ds) => ({
        name: ds.datasource_name,
        table: ds.table_name,
        allowEdit: ds.allow_edit === 1,
        allowCreate: ds.allow_create === 1,
        allowDelete: ds.allow_delete === 1,
      }));

      console.log(`[generateSmartForm] Copied ${dataSources.length} datasources from ${copyFrom}`);
    } catch (error) {
      console.error(`[generateSmartForm] Failed to copy from ${copyFrom}:`, error);
      throw new Error(`Failed to copy structure from ${copyFrom}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // Strategy 2: Create datasource from table and analyze patterns
  if (dataSource && !copyFrom) {
    console.log(`[generateSmartForm] Creating datasource for table: ${dataSource}`);
    
    dataSources.push({
      name: dataSource,
      table: dataSource,
      allowEdit: true,
      allowCreate: true,
      allowDelete: true,
    });

    // Analyze similar forms using this table
    if (formPattern) {
      try {
        await handleGetFormPatterns(
          { formPattern },
          symbolIndex
        );
        console.log(`[generateSmartForm] Analyzed pattern: ${formPattern}`);
      } catch (error) {
        console.warn(`[generateSmartForm] Pattern analysis failed:`, error);
      }
    }
  }

  // Strategy 3: Generate controls for datasource fields
  if (generateControls && dataSource && dataSources.length > 0) {
    console.log(`[generateSmartForm] Generating controls for datasource: ${dataSource}`);

    try {
      const db = symbolIndex.db;

      // Query fields directly from symbols DB
      const dbFields = db.prepare(`
        SELECT name FROM symbols
        WHERE type = 'field' AND parent_name = ?
        ORDER BY name
      `).all(dataSource) as Array<{ name: string }>;

      if (dbFields.length > 0) {
        // Generate grid with all fields excluding RecId
        const fieldNames = dbFields
          .map((f: { name: string }) => f.name)
          .filter((n: string) => n !== 'RecId');

        const gridControl = builder.buildGridControl(
          `${dataSource}Grid`,
          dataSource,
          fieldNames
        );

        controls.push(gridControl);
        console.log(`[generateSmartForm] Generated grid with ${fieldNames.length} fields`);
      }
    } catch (error) {
      console.warn(`[generateSmartForm] Failed to generate controls:`, error);
    }
  }

  // Fallback: At least one datasource needed
  if (dataSources.length === 0) {
    console.warn(`[generateSmartForm] No datasource configured, form will be empty`);
  }

  // Generate XML
  const xml = builder.buildFormXml({
    name,
    label: label || name,
    caption,
    dataSources,
    controls,
  });

  console.log(`[generateSmartForm] Generated XML (${xml.length} bytes)`);

  // Determine package path
  const packagePath = getConfigManager().getPackagePath() || 'K:\\AosService\\PackagesLocalDirectory';

  // Write to file
  let targetPath: string;

  if (modelName) {
    targetPath = path.join(packagePath, modelName, modelName, 'AxForm', `${name}.xml`);
  } else if (projectPath) {
    const model = extractModelFromProject(projectPath);
    targetPath = path.join(packagePath, model, model, 'AxForm', `${name}.xml`);
  } else if (solutionPath) {
    const project = findProjectInSolution(solutionPath);
    if (project) {
      const model = extractModelFromProject(project);
      targetPath = path.join(packagePath, model, model, 'AxForm', `${name}.xml`);
    } else {
      throw new Error('No .rnrproj file found in solution');
    }
  } else {
    throw new Error('Must provide modelName, projectPath, or solutionPath');
  }

  // Create directory if needed
  const dir = path.dirname(targetPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Write file
  fs.writeFileSync(targetPath, xml, 'utf-8');
  console.log(`[generateSmartForm] Created file: ${targetPath}`);

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify({
          success: true,
          formName: name,
          filePath: targetPath,
          dataSourcesGenerated: dataSources.length,
          controlsGenerated: controls.length,
          strategy: copyFrom ? 'copy' : dataSource ? 'datasource' : formPattern ? 'pattern' : 'default',
          xml,
        }, null, 2),
      },
    ],
  };
}

/**
 * Extract model name from .rnrproj file
 */
function extractModelFromProject(projectPath: string): string {
  try {
    const content = fs.readFileSync(projectPath, 'utf-8');
    const match = content.match(/<ModelName>(.*?)<\/ModelName>/);
    if (match && match[1]) {
      return match[1];
    }
  } catch (error) {
    console.error(`Failed to extract model from ${projectPath}:`, error);
  }
  throw new Error(`Could not extract ModelName from ${projectPath}`);
}

/**
 * Find .rnrproj file in solution directory
 */
function findProjectInSolution(solutionPath: string): string | null {
  try {
    const files = fs.readdirSync(solutionPath, { recursive: true }) as string[];
    const projectFile = files.find(f => f.endsWith('.rnrproj'));
    return projectFile ? path.join(solutionPath, projectFile) : null;
  } catch (error) {
    console.error(`Failed to find project in ${solutionPath}:`, error);
    return null;
  }
}
