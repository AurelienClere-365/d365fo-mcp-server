/**
 * Tests for get_query_info tool
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { getQueryInfoTool } from '../../src/tools/queryInfo.js';
import type { XppServerContext } from '../../src/types/context.js';
import { XppSymbolIndex } from '../../src/metadata/symbolIndex.js';
import path from 'path';
import { promises as fs } from 'fs';
import os from 'os';
import Database from 'better-sqlite3';

describe('get_query_info tool', () => {
  let context: XppServerContext;
  let tempDbPath: string;
  let tempQueryFile: string;

  beforeAll(async () => {
    // Create temp database and files for testing
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'query-info-test-'));
    tempDbPath = path.join(tempDir, 'test.db');
    tempQueryFile = path.join(tempDir, 'TestQuery.xml');

    // Create test query XML
    const queryXml = `<?xml version="1.0" encoding="utf-8"?>
<AxQuery xmlns:i="http://www.w3.org/2001/XMLSchema-instance">
\t<Name>TestQuery</Name>
\t<Description>Test query for customers</Description>
\t<DataSources>
\t\t<AxQuerySimpleRootDataSource>
\t\t\t<Name>CustTable</Name>
\t\t\t<Table>CustTable</Table>
\t\t\t<FetchMode>1:n</FetchMode>
\t\t\t<Ranges>
\t\t\t\t<AxQuerySimpleDataSourceRange>
\t\t\t\t\t<Field>AccountNum</Field>
\t\t\t\t\t<Value>*</Value>
\t\t\t\t</AxQuerySimpleDataSourceRange>
\t\t\t\t<AxQuerySimpleDataSourceRange>
\t\t\t\t\t<Field>Blocked</Field>
\t\t\t\t\t<Value>No</Value>
\t\t\t\t\t<Operator>Equal</Operator>
\t\t\t\t</AxQuerySimpleDataSourceRange>
\t\t\t</Ranges>
\t\t\t<Fields>
\t\t\t\t<AxQuerySimpleDataSourceField>
\t\t\t\t\t<Field>AccountNum</Field>
\t\t\t\t</AxQuerySimpleDataSourceField>
\t\t\t\t<AxQuerySimpleDataSourceField>
\t\t\t\t\t<Field>Name</Field>
\t\t\t\t</AxQuerySimpleDataSourceField>
\t\t\t</Fields>
\t\t\t<DataSources>
\t\t\t\t<AxQuerySimpleEmbeddedDataSource>
\t\t\t\t\t<Name>CustTrans</Name>
\t\t\t\t\t<Table>CustTrans</Table>
\t\t\t\t\t<FetchMode>1:n</FetchMode>
\t\t\t\t\t<Ranges>
\t\t\t\t\t\t<AxQuerySimpleDataSourceRange>
\t\t\t\t\t\t\t<Field>Open</Field>
\t\t\t\t\t\t\t<Value>Yes</Value>
\t\t\t\t\t\t</AxQuerySimpleDataSourceRange>
\t\t\t\t\t</Ranges>
\t\t\t\t</AxQuerySimpleEmbeddedDataSource>
\t\t\t</DataSources>
\t\t</AxQuerySimpleRootDataSource>
\t</DataSources>
</AxQuery>`;

    await fs.writeFile(tempQueryFile, queryXml, 'utf-8');

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

    // Insert test query
    insert.run('TestQuery', 'query', null, tempQueryFile, 'TestModel');

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

  it('should extract query description', async () => {
    const request = {
      method: 'tools/call',
      params: {
        name: 'get_query_info',
        arguments: {
          queryName: 'TestQuery',
        },
      },
    };

    const result = await getQueryInfoTool(request as any, context);

    expect(result.content).toBeDefined();
    expect(result.content[0].type).toBe('text');
    const text = result.content[0].text;
    
    expect(text).toContain('TestQuery');
    expect(text).toContain('Test query for customers');
  });

  it('should extract root datasources', async () => {
    const request = {
      method: 'tools/call',
      params: {
        name: 'get_query_info',
        arguments: {
          queryName: 'TestQuery',
          includeRanges: false,
          includeJoins: false,
          includeFields: false,
        },
      },
    };

    const result = await getQueryInfoTool(request as any, context);

    expect(result.content).toBeDefined();
    expect(result.content[0].type).toBe('text');
    const text = result.content[0].text;
    
    expect(text).toContain('CustTable');
    expect(text).toContain('**Table:** `CustTable`');
    expect(text).toContain('**Fetch Mode:** 1:n');
  });

  it('should extract query ranges', async () => {
    const request = {
      method: 'tools/call',
      params: {
        name: 'get_query_info',
        arguments: {
          queryName: 'TestQuery',
          includeRanges: true,
          includeJoins: false,
          includeFields: false,
        },
      },
    };

    const result = await getQueryInfoTool(request as any, context);

    expect(result.content).toBeDefined();
    expect(result.content[0].type).toBe('text');
    const text = result.content[0].text;
    
    expect(text).toContain('Ranges:');
    expect(text).toContain('AccountNum');
    expect(text).toContain('Blocked');
    expect(text).toContain('No');
    expect(text).toContain('(Equal)');
  });

  it('should extract query fields', async () => {
    const request = {
      method: 'tools/call',
      params: {
        name: 'get_query_info',
        arguments: {
          queryName: 'TestQuery',
          includeRanges: false,
          includeJoins: false,
          includeFields: true,
        },
      },
    };

    const result = await getQueryInfoTool(request as any, context);

    expect(result.content).toBeDefined();
    expect(result.content[0].type).toBe('text');
    const text = result.content[0].text;
    
    expect(text).toContain('Fields');
    expect(text).toContain('AccountNum');
    expect(text).toContain('Name');
  });

  it('should extract joined datasources', async () => {
    const request = {
      method: 'tools/call',
      params: {
        name: 'get_query_info',
        arguments: {
          queryName: 'TestQuery',
          includeRanges: true,
          includeJoins: true,
          includeFields: false,
        },
      },
    };

    const result = await getQueryInfoTool(request as any, context);

    expect(result.content).toBeDefined();
    expect(result.content[0].type).toBe('text');
    const text = result.content[0].text;
    
    expect(text).toContain('Joined Data Sources:');
    expect(text).toContain('CustTrans');
    expect(text).toContain('Open');
    expect(text).toContain('Yes');
  });

  it('should show datasource hierarchy', async () => {
    const request = {
      method: 'tools/call',
      params: {
        name: 'get_query_info',
        arguments: {
          queryName: 'TestQuery',
          includeRanges: false,
          includeJoins: true,
          includeFields: false,
        },
      },
    };

    const result = await getQueryInfoTool(request as any, context);

    expect(result.content).toBeDefined();
    expect(result.content[0].type).toBe('text');
    const text = result.content[0].text;
    
    // Check hierarchy (CustTrans should be indented under CustTable)
    const lines = text.split('\n');
    const custTableLine = lines.findIndex((l: string) => l.includes('### CustTable'));
    const custTransLine = lines.findIndex((l: string) => l.includes('### CustTrans'));
    expect(custTransLine).toBeGreaterThan(custTableLine);
    
    // CustTrans should be indented (more spaces)
    const custTableIndent = lines[custTableLine].match(/^\s*/)?.[0].length || 0;
    const custTransIndent = lines[custTransLine].match(/^\s*/)?.[0].length || 0;
    expect(custTransIndent).toBeGreaterThan(custTableIndent);
  });

  it('should show summary statistics', async () => {
    const request = {
      method: 'tools/call',
      params: {
        name: 'get_query_info',
        arguments: {
          queryName: 'TestQuery',
          includeRanges: true,
          includeJoins: true,
          includeFields: true,
        },
      },
    };

    const result = await getQueryInfoTool(request as any, context);

    expect(result.content).toBeDefined();
    expect(result.content[0].type).toBe('text');
    const text = result.content[0].text;
    
    expect(text).toContain('Summary');
    expect(text).toContain('**Data Sources:** 2');
    expect(text).toContain('**Total Ranges:** 3');
  });

  it('should handle non-existent query', async () => {
    const request = {
      method: 'tools/call',
      params: {
        name: 'get_query_info',
        arguments: {
          queryName: 'NonExistentQuery',
        },
      },
    };

    const result = await getQueryInfoTool(request as any, context);

    expect(result.content).toBeDefined();
    expect(result.content[0].type).toBe('text');
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('not found');
  });
});
