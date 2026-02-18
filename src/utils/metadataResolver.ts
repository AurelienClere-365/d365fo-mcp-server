/**
 * Metadata Resolver
 *
 * Resolves D365FO object metadata from the local extracted-metadata/ folder.
 * The SQLite DB stores file_path values that point to the Azure DevOps build-agent
 * (e.g. C:\home\vsts\work\1\...) which is never accessible at runtime.
 * Instead, this module reads the pre-extracted JSON/XML from extracted-metadata/.
 *
 * Folder layout:
 *   extracted-metadata/{ModelName}/classes/{ClassName}.json   → { name, model, methods[], ... }
 *   extracted-metadata/{ModelName}/enums/{EnumName}.json      → { raw: "<xml>..." }
 *   extracted-metadata/{ModelName}/tables/{TableName}.json    → { name, model, fields[], ... }
 */

import { promises as fs } from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

// Resolve path relative to this file, not to process.cwd()
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EXTRACTED_METADATA_BASE = path.resolve(__dirname, '../../extracted-metadata');

export type ExtractedObjectType = 'classes' | 'enums' | 'tables';

// ─────────────────────────────────────────────────────────────────────────────
// Path helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build the absolute path to an extracted-metadata JSON file.
 * Returns null if the file doesn't exist (no throw).
 */
export async function resolveMetadataJsonPath(
  model: string,
  objectType: ExtractedObjectType,
  name: string
): Promise<string | null> {
  const filePath = path.join(EXTRACTED_METADATA_BASE, model, objectType, `${name}.json`);
  try {
    await fs.access(filePath);
    return filePath;
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Class metadata
// ─────────────────────────────────────────────────────────────────────────────

export interface ExtractedMethodParam {
  type: string;
  name: string;
  defaultValue?: string;
}

export interface ExtractedMethod {
  name: string;
  visibility: string;
  returnType: string;
  parameters: ExtractedMethodParam[];
  isStatic: boolean;
  source?: string;
  sourceSnippet?: string;
}

export interface ExtractedClassMetadata {
  name: string;
  model: string;
  sourcePath: string;
  declaration?: string;
  extends?: string;
  implements?: string[];
  isAbstract?: boolean;
  isFinal?: boolean;
  methods: ExtractedMethod[];
}

/**
 * Read class metadata from extracted-metadata JSON.
 * Returns null if the file is not available.
 */
export async function readClassMetadata(
  model: string,
  className: string
): Promise<ExtractedClassMetadata | null> {
  const filePath = await resolveMetadataJsonPath(model, 'classes', className);
  if (!filePath) return null;

  try {
    const raw = await fs.readFile(filePath, 'utf-8');
    const data = JSON.parse(raw) as ExtractedClassMetadata;

    // Normalise parameter format: parameters may be stored as raw "@{type=X; name=Y}" strings
    for (const method of data.methods ?? []) {
      method.parameters = (method.parameters ?? []).map((p: any) => {
        if (typeof p === 'string') {
          // Parse "@{type=RecId; name=_legalEntityRecId}" PowerShell serialization
          const typeMatch = p.match(/type=([^;}\s]+)/);
          const nameMatch = p.match(/name=([^;}\s]+)/);
          return {
            type: typeMatch?.[1] ?? 'var',
            name: nameMatch?.[1] ?? '_param',
          } as ExtractedMethodParam;
        }
        return p as ExtractedMethodParam;
      });
    }

    return data;
  } catch {
    return null;
  }
}

/**
 * Read a specific method from extracted class metadata.
 */
export async function readMethodMetadata(
  model: string,
  className: string,
  methodName: string
): Promise<ExtractedMethod | null> {
  const classData = await readClassMetadata(model, className);
  if (!classData) return null;

  return classData.methods.find(m => m.name === methodName) ?? null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Enum metadata (raw XML embedded in JSON)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Read the raw XML string from an extracted-metadata enum JSON file.
 * Returns null if not available.
 */
export async function readEnumRawXml(
  model: string,
  enumName: string
): Promise<string | null> {
  const filePath = await resolveMetadataJsonPath(model, 'enums', enumName);
  if (!filePath) return null;

  try {
    const raw = await fs.readFile(filePath, 'utf-8');
    const data = JSON.parse(raw);
    return typeof data.raw === 'string' ? data.raw : null;
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Generic "not available" message for objects without extracted metadata
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build a friendly error explaining that the XML for this object type
 * is not available in the current deployment (no D365FO installation).
 */
export function buildXmlNotAvailableMessage(
  objectType: string,
  objectName: string,
  dbFilePath: string
): string {
  return (
    `❌ Cannot read ${objectType} metadata for "${objectName}".\n\n` +
    `The metadata database was built on an Azure DevOps build agent and stores file paths\n` +
    `that are not accessible in the current environment:\n` +
    `  ${dbFilePath}\n\n` +
    `To use this tool you need either:\n` +
    `1. Run the MCP server locally on a D365FO Windows VM where that path exists, OR\n` +
    `2. Ensure the ${objectType} XML files are accessible at the path above.\n\n` +
    `Note: ${objectType}s are not included in the pre-extracted JSON metadata (only classes, tables, enums are).`
  );
}
