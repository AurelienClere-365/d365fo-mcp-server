/**
 * Unit tests for rename_label helper functions and renameLabelInIndex.
 *
 * Tests the pure helper functions (no file I/O, no MCP context needed)
 * and the SQLite index method using an in-memory database.
 */

import { describe, it, expect } from 'vitest';
import { XppSymbolIndex } from '../src/metadata/symbolIndex';
import { join } from 'path';
import os from 'os';

// ── Re-export private helpers for testing via a thin wrapper ─────────────────
// We can't import private functions directly, so we test them through a small
// inline re-implementation that mirrors the production code exactly.

const UTF8_BOM = '\uFEFF';

function stripBom(s: string): string {
  return s.startsWith(UTF8_BOM) ? s.slice(1) : s;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function renameLabelInTxt(content: string, oldId: string, newId: string): string | null {
  const lines = stripBom(content).replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  let found = false;
  const out: string[] = [];
  for (const line of lines) {
    const eqIdx = line.indexOf('=');
    if (eqIdx > 0) {
      const id = line.substring(0, eqIdx).trim();
      if (id === oldId) {
        found = true;
        out.push(newId + line.substring(eqIdx));
        continue;
      }
    }
    out.push(line);
  }
  if (!found) return null;
  return UTF8_BOM + out.join('\n');
}

function replaceReferences(
  content: string,
  labelFileId: string,
  oldId: string,
  newId: string,
): { newContent: string; count: number } {
  const pattern = new RegExp(
    `@${escapeRegex(labelFileId)}:${escapeRegex(oldId)}(?=[^A-Za-z0-9_]|$)`,
    'g',
  );
  let count = 0;
  const newContent = content.replace(pattern, () => {
    count++;
    return `@${labelFileId}:${newId}`;
  });
  return { newContent, count };
}

// ── renameLabelInTxt tests ────────────────────────────────────────────────────

describe('renameLabelInTxt', () => {
  it('renames a label in the middle of the file', () => {
    const content = UTF8_BOM + 'Alpha=First\nMyOld=Old text\nZeta=Last\n';
    const result = renameLabelInTxt(content, 'MyOld', 'MyNew');
    expect(result).toBe(UTF8_BOM + 'Alpha=First\nMyNew=Old text\nZeta=Last\n');
  });

  it('renames a label at the start of file (first entry after BOM)', () => {
    const content = UTF8_BOM + 'OldFirst=text\nOther=other\n';
    const result = renameLabelInTxt(content, 'OldFirst', 'NewFirst');
    expect(result).toBe(UTF8_BOM + 'NewFirst=text\nOther=other\n');
  });

  it('renames a label at the end of file', () => {
    const content = UTF8_BOM + 'Alpha=First\nOldLast=last text\n';
    const result = renameLabelInTxt(content, 'OldLast', 'NewLast');
    expect(result).toBe(UTF8_BOM + 'Alpha=First\nNewLast=last text\n');
  });

  it('preserves comment lines following a renamed label', () => {
    const content = UTF8_BOM + 'MyOld=Text\n ;developer comment\nOther=other\n';
    const result = renameLabelInTxt(content, 'MyOld', 'MyNew');
    expect(result).toBe(UTF8_BOM + 'MyNew=Text\n ;developer comment\nOther=other\n');
  });

  it('preserves text after the = sign (including special chars)', () => {
    const content = UTF8_BOM + 'MyOld=Zákazník / dodavatel\nOther=text\n';
    const result = renameLabelInTxt(content, 'MyOld', 'MyNew');
    expect(result).toBe(UTF8_BOM + 'MyNew=Zákazník / dodavatel\nOther=text\n');
  });

  it('returns null when label is not found', () => {
    const content = UTF8_BOM + 'Alpha=First\nBeta=Second\n';
    const result = renameLabelInTxt(content, 'NotExisting', 'NewId');
    expect(result).toBeNull();
  });

  it('does not match partial label ID (MyOld vs MyOldExtra)', () => {
    const content = UTF8_BOM + 'MyOldExtra=text\nOther=text\n';
    // MyOld is not in the file — MyOldExtra should not match
    const result = renameLabelInTxt(content, 'MyOld', 'MyNew');
    expect(result).toBeNull();
    expect(content).toContain('MyOldExtra'); // untouched
  });

  it('handles Windows line endings (CRLF)', () => {
    const content = UTF8_BOM + 'Alpha=First\r\nMyOld=text\r\nZeta=Last\r\n';
    const result = renameLabelInTxt(content, 'MyOld', 'MyNew');
    // Output normalised to LF (consistent with createLabel.ts behaviour)
    expect(result).toContain('MyNew=text');
    expect(result).not.toContain('MyOld=');
  });

  it('works without BOM', () => {
    const content = 'MyOld=text\nOther=other\n';
    const result = renameLabelInTxt(content, 'MyOld', 'MyNew');
    // Output always gets BOM prepended
    expect(result).toBe(UTF8_BOM + 'MyNew=text\nOther=other\n');
  });
});

// ── replaceReferences tests ───────────────────────────────────────────────────

describe('replaceReferences', () => {
  const fileId = 'AslCore';

  it('replaces a single reference in X++ code', () => {
    const content = `str label = literalStr("@AslCore:OldId");`;
    const { newContent, count } = replaceReferences(content, fileId, 'OldId', 'NewId');
    expect(count).toBe(1);
    expect(newContent).toBe(`str label = literalStr("@AslCore:NewId");`);
  });

  it('replaces a reference in XML metadata', () => {
    const content = `<Label>@AslCore:OldId</Label>`;
    const { newContent, count } = replaceReferences(content, fileId, 'OldId', 'NewId');
    expect(count).toBe(1);
    expect(newContent).toBe(`<Label>@AslCore:NewId</Label>`);
  });

  it('replaces multiple occurrences in one file', () => {
    const content = [
      `<Label>@AslCore:OldId</Label>`,
      `<HelpText>@AslCore:OldId</HelpText>`,
      `<Caption>@AslCore:OldId</Caption>`,
    ].join('\n');
    const { count } = replaceReferences(content, fileId, 'OldId', 'NewId');
    expect(count).toBe(3);
  });

  it('does NOT replace a label that is a prefix of another', () => {
    const content = `literalStr("@AslCore:OldIdExtra")`;
    const { newContent, count } = replaceReferences(content, fileId, 'OldId', 'NewId');
    expect(count).toBe(0);
    expect(newContent).toBe(content); // unchanged
  });

  it('does NOT replace a different label file', () => {
    const content = `<Label>@OtherFile:OldId</Label>`;
    const { newContent, count } = replaceReferences(content, fileId, 'OldId', 'NewId');
    expect(count).toBe(0);
    expect(newContent).toBe(content);
  });

  it('replaces label at end of string (no trailing char)', () => {
    const content = `@AslCore:OldId`;
    const { newContent, count } = replaceReferences(content, fileId, 'OldId', 'NewId');
    expect(count).toBe(1);
    expect(newContent).toBe('@AslCore:NewId');
  });

  it('replaces label followed by newline', () => {
    const content = `<Label>@AslCore:OldId\n</Label>`;
    const { newContent, count } = replaceReferences(content, fileId, 'OldId', 'NewId');
    expect(count).toBe(1);
    expect(newContent).toContain('@AslCore:NewId');
  });

  it('handles label IDs with underscores in both old and new', () => {
    const content = `<Label>@AslCore:My_Old_Field</Label>`;
    const { newContent, count } = replaceReferences(content, fileId, 'My_Old_Field', 'My_New_Field');
    expect(count).toBe(1);
    expect(newContent).toBe(`<Label>@AslCore:My_New_Field</Label>`);
  });

  it('returns 0 count when nothing matches', () => {
    const content = `<Name>NoLabelHere</Name>`;
    const { count } = replaceReferences(content, fileId, 'OldId', 'NewId');
    expect(count).toBe(0);
  });

  it('handles labelFileId with special regex chars (dots)', () => {
    const content = `<Label>@My.Model:OldId</Label>`;
    const { newContent, count } = replaceReferences(content, 'My.Model', 'OldId', 'NewId');
    expect(count).toBe(1);
    expect(newContent).toBe(`<Label>@My.Model:NewId</Label>`);
  });
});

// ── renameLabelInIndex tests ──────────────────────────────────────────────────

describe('XppSymbolIndex.renameLabelInIndex', () => {
  // Each test gets its own unique temp dir to avoid file-lock EPERM between tests
  function makeTmpPaths() {
    const dir = os.tmpdir();
    const stamp = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    return {
      dbPath: join(dir, `test-symbols-${stamp}.db`),
      labelsDbPath: join(dir, `test-labels-${stamp}.db`),
    };
  }

  it('renames label_id in the labels table and updates FTS', { timeout: 30000 }, () => {
    const { dbPath, labelsDbPath } = makeTmpPaths();
    const symbolIndex = new XppSymbolIndex(dbPath, labelsDbPath);

    // Seed the labels DB with some entries
    symbolIndex.bulkAddLabels([
      { labelId: 'OldId', labelFileId: 'AslCore', model: 'AslCore', language: 'en-US', text: 'Old text', filePath: '/fake/AslCore.en-US.label.txt' },
      { labelId: 'OldId', labelFileId: 'AslCore', model: 'AslCore', language: 'cs', text: 'Starý text', filePath: '/fake/AslCore.cs.label.txt' },
      { labelId: 'OtherLabel', labelFileId: 'AslCore', model: 'AslCore', language: 'en-US', text: 'Other', filePath: '/fake/AslCore.en-US.label.txt' },
    ]);

    // Verify seed
    const before = symbolIndex.getLabelById('OldId', 'AslCore', 'AslCore');
    expect(before.length).toBe(2); // en-US + cs

    // Rename
    symbolIndex.renameLabelInIndex('OldId', 'NewId', 'AslCore', 'AslCore');

    // Old ID should be gone
    const oldRows = symbolIndex.getLabelById('OldId', 'AslCore', 'AslCore');
    expect(oldRows.length).toBe(0);

    // New ID should exist with both languages
    const newRows = symbolIndex.getLabelById('NewId', 'AslCore', 'AslCore');
    expect(newRows.length).toBe(2);
    expect(newRows.find(r => r.language === 'en-US')?.text).toBe('Old text');
    expect(newRows.find(r => r.language === 'cs')?.text).toBe('Starý text');

    // Unrelated label should be unaffected
    const other = symbolIndex.getLabelById('OtherLabel', 'AslCore', 'AslCore');
    expect(other.length).toBe(1);

    symbolIndex.close();
  });

  it('does not affect labels in a different model', { timeout: 30000 }, () => {
    const { dbPath, labelsDbPath } = makeTmpPaths();
    const symbolIndex = new XppSymbolIndex(dbPath, labelsDbPath);

    symbolIndex.bulkAddLabels([
      { labelId: 'OldId', labelFileId: 'AslCore', model: 'AslCore', language: 'en-US', text: 'Model A', filePath: '/a/label.txt' },
      { labelId: 'OldId', labelFileId: 'AslCore', model: 'AslFinanceCore', language: 'en-US', text: 'Model B', filePath: '/b/label.txt' },
    ]);

    symbolIndex.renameLabelInIndex('OldId', 'NewId', 'AslCore', 'AslCore');

    // AslCore model should be renamed
    expect(symbolIndex.getLabelById('NewId', 'AslCore', 'AslCore').length).toBe(1);
    // AslFinanceCore should be untouched
    expect(symbolIndex.getLabelById('OldId', 'AslCore', 'AslFinanceCore').length).toBe(1);
    expect(symbolIndex.getLabelById('NewId', 'AslCore', 'AslFinanceCore').length).toBe(0);

    symbolIndex.close();
  });

  it('FTS returns new ID after rename', { timeout: 30000 }, () => {
    const { dbPath, labelsDbPath } = makeTmpPaths();
    const symbolIndex = new XppSymbolIndex(dbPath, labelsDbPath);

    symbolIndex.bulkAddLabels([
      { labelId: 'OldId', labelFileId: 'AslCore', model: 'AslCore', language: 'en-US', text: 'Customer account number', filePath: '/fake.txt' },
    ]);

    symbolIndex.renameLabelInIndex('OldId', 'NewId', 'AslCore', 'AslCore');

    // FTS should find it by new ID (SQLite returns snake_case keys from raw rows)
    const results = symbolIndex.searchLabels('Customer account number');
    expect(results.length).toBeGreaterThan(0);
    const row = results[0] as any;
    expect(row.label_id ?? row.labelId).toBe('NewId');

    symbolIndex.close();
  });
});
