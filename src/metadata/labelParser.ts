/**
 * AxLabelFile Parser
 * Parses D365FO .label.txt files from PackagesLocalDirectory
 * and indexes them into the SQLite labels table.
 *
 * Label file format (one per line):
 *   LabelId=Label text
 *    ;Optional comment line (leading space + semicolon)
 *
 * File locations on K: drive:
 *   {pkg}\{Model}\{Model}\AxLabelFile\LabelResources\{locale}\{LabelFileId}.{locale}.label.txt
 *   {pkg}\{Model}\{Model}\AxLabelFile\{LabelFileId}_{locale}.xml  (metadata descriptor)
 */

import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as path from 'path';
import type { XppSymbolIndex } from './symbolIndex.js';

export interface ParsedLabel {
  labelId: string;
  text: string;
  comment?: string;
  labelFileId: string;
  model: string;
  language: string;
  filePath: string;
}

/**
 * Parse a single .label.txt file into ParsedLabel records.
 */
export function parseLabelFile(
  content: string,
  labelFileId: string,
  model: string,
  language: string,
  filePath: string,
): ParsedLabel[] {
  const labels: ParsedLabel[] = [];
  // Normalise line endings
  const lines = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');

  let current: ParsedLabel | null = null;

  for (const line of lines) {
    if (line === '') continue;

    if (line.startsWith(' ;') || line.startsWith('\t;')) {
      // Comment line for the previous label
      if (current) {
        const commentText = line.replace(/^[ \t];/, '').trim();
        current.comment = current.comment ? `${current.comment} ${commentText}` : commentText;
      }
      continue;
    }

    const eqIdx = line.indexOf('=');
    if (eqIdx > 0) {
      // Flush previous label
      if (current) labels.push(current);

      const labelId = line.substring(0, eqIdx).trim();
      const text = line.substring(eqIdx + 1);

      // Skip empty or obviously malformed ids
      if (!labelId || /\s/.test(labelId)) {
        current = null;
        continue;
      }

      current = { labelId, text, comment: undefined, labelFileId, model, language, filePath };
    }
    // Any other line (continuation) — ignore; D365FO labels are single-line
  }

  if (current) labels.push(current);
  return labels;
}

/**
 * Discover all AxLabelFile resources for a model.
 * Returns an array of { labelFileId, language, filePath }.
 */
export async function discoverLabelFiles(
  modelDir: string,  // e.g. K:\AosService\PackagesLocalDirectory\AslCore\AslCore
): Promise<Array<{ labelFileId: string; language: string; filePath: string }>> {
  const results: Array<{ labelFileId: string; language: string; filePath: string }> = [];
  const axLabelDir = path.join(modelDir, 'AxLabelFile', 'LabelResources');

  let locales: string[];
  try {
    locales = await fs.readdir(axLabelDir);
  } catch {
    return results; // No AxLabelFile folder
  }

  for (const locale of locales) {
    const localeDir = path.join(axLabelDir, locale);
    let files: string[];
    try {
      files = await fs.readdir(localeDir);
    } catch {
      continue;
    }

    for (const file of files) {
      if (!file.endsWith('.label.txt')) continue;
      // Filename pattern: {LabelFileId}.{locale}.label.txt
      // e.g. AslCore.en-US.label.txt
      const withoutSuffix = file.replace(/\.label\.txt$/, '');
      const dotIdx = withoutSuffix.lastIndexOf('.');
      if (dotIdx < 0) continue;
      const labelFileId = withoutSuffix.substring(0, dotIdx);
      const fileLang = withoutSuffix.substring(dotIdx + 1);

      // Sanity-check: locale from directory should match lang in filename
      if (fileLang !== locale) continue;

      results.push({
        labelFileId,
        language: locale,
        filePath: path.join(localeDir, file),
      });
    }
  }

  return results;
}

/**
 * Index all label files for a single model into the symbol index.
 * Returns the number of label entries inserted.
 *
 * Pass `{ skipFtsRebuild: true }` when calling in a loop over many models;
 * the caller is responsible for calling `symbolIndex.rebuildLabelsFts()` once
 * after all models have been indexed.
 */
export async function indexModelLabels(
  symbolIndex: XppSymbolIndex,
  modelDir: string,
  model: string,
  opts?: { skipFtsRebuild?: boolean },
): Promise<number> {
  const labelFiles = await discoverLabelFiles(modelDir);
  if (labelFiles.length === 0) return 0;

  const allEntries: Parameters<XppSymbolIndex['bulkAddLabels']>[0] = [];

  for (const { labelFileId, language, filePath } of labelFiles) {
    let content: string;
    try {
      content = await fs.readFile(filePath, 'utf-8');
    } catch {
      continue;
    }

    const labels = parseLabelFile(content, labelFileId, model, language, filePath);
    for (const lbl of labels) {
      allEntries.push({
        labelId: lbl.labelId,
        labelFileId: lbl.labelFileId,
        model: lbl.model,
        language: lbl.language,
        text: lbl.text,
        comment: lbl.comment,
        filePath: lbl.filePath,
      });
    }
  }

  if (allEntries.length > 0) {
    symbolIndex.bulkAddLabels(allEntries, opts);
  }

  return allEntries.length;
}

/**
 * Index ALL labels from PackagesLocalDirectory into the symbol index.
 * Scans all model folders.
 */
export async function indexAllLabels(
  symbolIndex: XppSymbolIndex,
  packagesPath: string,
  modelFilter?: (modelName: string) => boolean,
): Promise<{ totalLabels: number; modelsIndexed: number }> {
  let totalLabels = 0;
  let modelsIndexed = 0;

  let models: string[];
  try {
    const entries = fsSync.readdirSync(packagesPath, { withFileTypes: true });
    // Include both real directories AND symbolic links / junction points.
    // On Windows, D365FO PackagesLocalDirectory model folders are often NTFS
    // junction points, which readdirSync reports as isSymbolicLink()=true
    // rather than isDirectory()=true.
    models = entries.filter(e => e.isDirectory() || e.isSymbolicLink()).map(e => e.name);
  } catch {
    console.error(`[LabelParser] Cannot read packages path: ${packagesPath}`);
    return { totalLabels, modelsIndexed };
  }

  for (const model of models) {
    if (modelFilter && !modelFilter(model)) continue;

    // The inner model source dir has the same name as the outer package dir
    const modelDir = path.join(packagesPath, model, model);
    if (!fsSync.existsSync(modelDir)) continue;

    // Skip per-model FTS rebuild; do a single rebuild after all models are indexed
    const count = await indexModelLabels(symbolIndex, modelDir, model, { skipFtsRebuild: true });
    if (count > 0) {
      totalLabels += count;
      modelsIndexed++;
    }
  }

  // Single FTS rebuild after all models — avoids O(N²) cost of rebuilding per model
  if (totalLabels > 0) {
    symbolIndex.rebuildLabelsFts();
  }

  return { totalLabels, modelsIndexed };
}
