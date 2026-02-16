/**
 * Tests for get_form_info tool
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { getFormInfoTool } from '../../src/tools/formInfo.js';
import type { XppServerContext } from '../../src/types/context.js';
import { XppSymbolIndex } from '../../src/metadata/symbolIndex.js';
import path from 'path';
import { promises as fs } from 'fs';
import os from 'os';
import Database from 'better-sqlite3';

describe('get_form_info tool', () => {
  let context: XppServerContext;
  let tempDbPath: string;
  let tempFormFile: string;

  beforeAll(async () => {
    // Create temp database and files for testing
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'form-info-test-'));
    tempDbPath = path.join(tempDir, 'test.db');
    tempFormFile = path.join(tempDir, 'TestForm.xml');

    // Create test form XML
    const formXml = `<?xml version="1.0" encoding="utf-8"?>
<AxForm xmlns:i="http://www.w3.org/2001/XMLSchema-instance">
\t<Name>TestForm</Name>
\t<DataSources>
\t\t<AxFormDataSourceRoot>
\t\t\t<Name>CustTable</Name>
\t\t\t<Table>CustTable</Table>
\t\t\t<AllowEdit>Yes</AllowEdit>
\t\t\t<AllowCreate>Yes</AllowCreate>
\t\t\t<AllowDelete>No</AllowDelete>
\t\t\t<Fields>
\t\t\t\t<AxFormDataSourceField>
\t\t\t\t\t<DataField>AccountNum</DataField>
\t\t\t\t</AxFormDataSourceField>
\t\t\t\t<AxFormDataSourceField>
\t\t\t\t\t<DataField>Name</DataField>
\t\t\t\t</AxFormDataSourceField>
\t\t\t</Fields>
\t\t\t<Methods>
\t\t\t\t<Method>
\t\t\t\t\t<Name>active</Name>
\t\t\t\t</Method>
\t\t\t\t<Method>
\t\t\t\t\t<Name>validateWrite</Name>
\t\t\t\t</Method>
\t\t\t</Methods>
\t\t</AxFormDataSourceRoot>
\t</DataSources>
\t<Design>
\t\t<AxFormDesign>
\t\t\t<Name>Design</Name>
\t\t\t<AxFormGroupControl>
\t\t\t\t<Name>MainGroup</Name>
\t\t\t\t<AxFormButtonControl>
\t\t\t\t\t<Name>SaveButton</Name>
\t\t\t\t\t<Caption>Save</Caption>
\t\t\t\t\t<Enabled>Yes</Enabled>
\t\t\t\t</AxFormButtonControl>
\t\t\t\t<AxFormStringControl>
\t\t\t\t\t<Name>AccountNum</Name>
\t\t\t\t\t<DataSource>CustTable</DataSource>
\t\t\t\t\t<DataField>AccountNum</DataField>
\t\t\t\t</AxFormStringControl>
\t\t\t</AxFormGroupControl>
\t\t</AxFormDesign>
\t</Design>
\t<Methods>
\t\t<Method>
\t\t\t<Name>init</Name>
\t\t\t<Source>public void init()</Source>
\t\t</Method>
\t\t<Method>
\t\t\t<Name>run</Name>
\t\t\t<Source>public void run()</Source>
\t\t</Method>
\t</Methods>
</AxForm>`;

    await fs.writeFile(tempFormFile, formXml, 'utf-8');

    const db = new Database(tempDbPath);
    
    // Create schema matching symbolIndex.ts
    db.exec(`
      CREATE TABLE IF NOT EXISTS symbols (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        parent_name TEXT,
        signature TEXT,
        file_path TEXT NOT NULL,
        model TEXT NOT NULL,
        description TEXT,
        tags TEXT,
        source_snippet TEXT,
        complexity INTEGER,
        used_types TEXT,
        method_calls TEXT,
        inline_comments TEXT,
        extends_class TEXT,
        implements_interfaces TEXT,
        usage_example TEXT,
        usage_frequency INTEGER DEFAULT 0,
        pattern_type TEXT,
        typical_usages TEXT,
        called_by_count INTEGER DEFAULT 0,
        related_methods TEXT,
        api_patterns TEXT
      );
      
      CREATE INDEX idx_symbols_name ON symbols(name);
      CREATE INDEX idx_symbols_type ON symbols(type);
    `);

    // Insert test data
    const insert = db.prepare(`
      INSERT INTO symbols (name, type, parent_name, file_path, model)
      VALUES (?, ?, ?, ?, ?)
    `);

    // Insert test form
    insert.run('TestForm', 'form', null, tempFormFile, 'TestModel');

    const symbolIndex = new XppSymbolIndex(tempDbPath);

    context = {
      symbolIndex,
      parser: {} as any,
      cache: undefined as any,
      workspaceScanner: {} as any,
      hybridSearch: {} as any,
      termRelationshipGraph: {} as any,
    };
  });

  it('should extract form datasources', async () => {
    const request = {
      method: 'tools/call',
      params: {
        name: 'get_form_info',
        arguments: {
          formName: 'TestForm',
          includeDataSources: true,
          includeControls: false,
          includeMethods: false,
        },
      },
    };

    const result = await getFormInfoTool(request as any, context);

    expect(result.content).toBeDefined();
    expect(result.content[0].type).toBe('text');
    const text = result.content[0].text;
    
    expect(text).toContain('TestForm');
    expect(text).toContain('Data Sources');
    expect(text).toContain('CustTable');
    expect(text).toContain('Allow Edit: ✅');
    expect(text).toContain('Allow Create: ✅');
    expect(text).toContain('Allow Delete: ❌');
  });

  it('should extract form controls', async () => {
    const request = {
      method: 'tools/call',
      params: {
        name: 'get_form_info',
        arguments: {
          formName: 'TestForm',
          includeDataSources: false,
          includeControls: true,
          includeMethods: false,
        },
      },
    };

    const result = await getFormInfoTool(request as any, context);

    expect(result.content).toBeDefined();
    expect(result.content[0].type).toBe('text');
    const text = result.content[0].text;
    
    expect(text).toContain('Design (Controls)');
    expect(text).toContain('SaveButton');
    expect(text).toContain('AccountNum');
    expect(text).toContain('ButtonControl');
    expect(text).toContain('StringControl');
  });

  it('should extract datasource fields', async () => {
    const request = {
      method: 'tools/call',
      params: {
        name: 'get_form_info',
        arguments: {
          formName: 'TestForm',
          includeDataSources: true,
          includeControls: false,
          includeMethods: false,
        },
      },
    };

    const result = await getFormInfoTool(request as any, context);

    expect(result.content).toBeDefined();
    expect(result.content[0].type).toBe('text');
    const text = result.content[0].text;
    
    expect(text).toContain('Fields');
    expect(text).toContain('AccountNum');
    expect(text).toContain('Name');
  });

  it('should extract datasource methods', async () => {
    const request = {
      method: 'tools/call',
      params: {
        name: 'get_form_info',
        arguments: {
          formName: 'TestForm',
          includeDataSources: true,
          includeControls: false,
          includeMethods: false,
        },
      },
    };

    const result = await getFormInfoTool(request as any, context);

    expect(result.content).toBeDefined();
    expect(result.content[0].type).toBe('text');
    const text = result.content[0].text;
    
    expect(text).toContain('Methods');
    expect(text).toContain('active');
    expect(text).toContain('validateWrite');
  });

  it('should extract form methods', async () => {
    const request = {
      method: 'tools/call',
      params: {
        name: 'get_form_info',
        arguments: {
          formName: 'TestForm',
          includeDataSources: false,
          includeControls: false,
          includeMethods: true,
        },
      },
    };

    const result = await getFormInfoTool(request as any, context);

    expect(result.content).toBeDefined();
    expect(result.content[0].type).toBe('text');
    const text = result.content[0].text;
    
    expect(text).toContain('Form Methods');
    expect(text).toContain('init');
    expect(text).toContain('run');
  });

  it('should extract control hierarchy', async () => {
    const request = {
      method: 'tools/call',
      params: {
        name: 'get_form_info',
        arguments: {
          formName: 'TestForm',
          includeDataSources: false,
          includeControls: true,
          includeMethods: false,
        },
      },
    };

    const result = await getFormInfoTool(request as any, context);

    expect(result.content).toBeDefined();
    expect(result.content[0].type).toBe('text');
    const text = result.content[0].text;
    
    expect(text).toContain('MainGroup');
    expect(text).toContain('SaveButton');
    // Check hierarchy (indentation)
    const lines = text.split('\n');
    const mainGroupLine = lines.findIndex((l: string) => l.includes('MainGroup'));
    const saveButtonLine = lines.findIndex((l: string) => l.includes('SaveButton'));
    expect(saveButtonLine).toBeGreaterThan(mainGroupLine);
  });

  it('should show summary statistics', async () => {
    const request = {
      method: 'tools/call',
      params: {
        name: 'get_form_info',
        arguments: {
          formName: 'TestForm',
          includeDataSources: true,
          includeControls: true,
          includeMethods: true,
        },
      },
    };

    const result = await getFormInfoTool(request as any, context);

    expect(result.content).toBeDefined();
    expect(result.content[0].type).toBe('text');
    const text = result.content[0].text;
    
    expect(text).toContain('Summary');
    expect(text).toContain('**Data Sources:** 1');
    expect(text).toContain('Controls:');
    expect(text).toContain('**Methods:** 2');
  });

  it('should handle non-existent form', async () => {
    const request = {
      method: 'tools/call',
      params: {
        name: 'get_form_info',
        arguments: {
          formName: 'NonExistentForm',
        },
      },
    };

    const result = await getFormInfoTool(request as any, context);

    expect(result.content).toBeDefined();
    expect(result.content[0].type).toBe('text');
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('not found');
  });
});
