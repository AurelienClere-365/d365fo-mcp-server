/**
 * Form Pattern Templates Tests (Issue #388)
 *
 * Validates that each form pattern template generates structurally correct
 * AxForm XML matching the D365FO form pattern specifications.
 *
 * These are unit tests against FormPatternTemplates directly — no MCP context
 * or bridge needed. Each test parses the generated XML and asserts the
 * control hierarchy matches the D365FO pattern requirements.
 */

import { describe, it, expect } from 'vitest';
import { FormPatternTemplates } from '../../src/utils/formPatternTemplates';

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Simple helper to check XML for element presence and nesting */
const containsElement = (xml: string, tag: string, value?: string): boolean => {
  if (value) return xml.includes(`<${tag}>${value}</${tag}>`) || xml.includes(`<${tag} xmlns="">${value}</${tag}>`);
  return xml.includes(`<${tag}>`) || xml.includes(`<${tag} `);
};

/** Check that an element with given Name appears in the XML */
const hasNamedControl = (xml: string, name: string): boolean =>
  xml.includes(`<Name>${name}</Name>`);

/** Check Design-level property */
const hasDesignProperty = (xml: string, prop: string, value: string): boolean => {
  // Design-level properties use xmlns="" attribute
  return xml.includes(`<${prop} xmlns="">${value}</${prop}>`) || xml.includes(`<${prop}>${value}</${prop}>`);
};

const defaultOpts = {
  formName: 'TestForm',
  dsName: 'TestDS',
  dsTable: 'TestTable',
  caption: 'Test Caption',
  gridFields: ['Field1', 'Field2', 'Field3'],
};

// ─── SimpleList ──────────────────────────────────────────────────────────────

describe('SimpleList pattern', () => {
  const xml = FormPatternTemplates.buildSimpleList(defaultOpts);

  it('generates valid XML with correct pattern', () => {
    expect(xml).toContain('<?xml version="1.0" encoding="utf-8"?>');
    expect(xml).toContain('<AxForm');
    expect(hasDesignProperty(xml, 'Pattern', 'SimpleList')).toBe(true);
    expect(hasDesignProperty(xml, 'PatternVersion', '1.1')).toBe(true);
  });

  it('has DataSource on Design', () => {
    expect(hasDesignProperty(xml, 'DataSource', 'TestDS')).toBe(true);
  });

  it('has TitleDataSource on Design', () => {
    expect(hasDesignProperty(xml, 'TitleDataSource', 'TestDS')).toBe(true);
  });

  it('has ActionPane control', () => {
    expect(hasNamedControl(xml, 'ActionPane')).toBe(true);
    expect(xml).toContain('AxFormActionPaneControl');
  });

  it('has CustomFilterGroup with QuickFilter', () => {
    expect(hasNamedControl(xml, 'CustomFilterGroup')).toBe(true);
    expect(hasNamedControl(xml, 'QuickFilterControl')).toBe(true);
    expect(xml).toContain('targetControlName');
  });

  it('has Grid with field controls', () => {
    expect(hasNamedControl(xml, 'Grid')).toBe(true);
    expect(xml).toContain('AxFormGridControl');
    expect(hasNamedControl(xml, 'Grid_Field1')).toBe(true);
    expect(hasNamedControl(xml, 'Grid_Field2')).toBe(true);
  });

  it('has InsertIfEmpty=No on datasource', () => {
    expect(xml).toContain('<InsertIfEmpty>No</InsertIfEmpty>');
  });

  it('binds grid fields to correct datasource', () => {
    expect(xml).toContain(`<DataSource>TestDS</DataSource>`);
    expect(xml).toContain(`<DataField>Field1</DataField>`);
  });

  it('generates correct classDeclaration', () => {
    expect(xml).toContain('class TestForm extends FormRun');
  });
});

// ─── SimpleListDetails ───────────────────────────────────────────────────────

describe('SimpleListDetails pattern', () => {
  const xml = FormPatternTemplates.buildSimpleListDetails(defaultOpts);

  it('generates valid XML with correct pattern', () => {
    expect(xml).toContain('<AxForm');
    expect(hasDesignProperty(xml, 'Pattern', 'SimpleListDetails')).toBe(true);
    expect(hasDesignProperty(xml, 'PatternVersion', '1.3')).toBe(true);
  });

  it('has DataSource on Design', () => {
    expect(hasDesignProperty(xml, 'DataSource', 'TestDS')).toBe(true);
  });

  it('has TitleDataSource on Design', () => {
    expect(hasDesignProperty(xml, 'TitleDataSource', 'TestDS')).toBe(true);
  });

  it('has InsertIfEmpty=No on datasource', () => {
    expect(xml).toContain('<InsertIfEmpty>No</InsertIfEmpty>');
  });

  it('has ActionPane control', () => {
    expect(hasNamedControl(xml, 'ActionPane')).toBe(true);
    expect(xml).toContain('AxFormActionPaneControl');
  });

  it('has GridContainer with SidePanel pattern', () => {
    expect(hasNamedControl(xml, 'GridContainer')).toBe(true);
    expect(xml).toContain('<Pattern>SidePanel</Pattern>');
  });

  it('has QuickFilter inside GridContainer', () => {
    expect(hasNamedControl(xml, 'QuickFilterControl')).toBe(true);
  });

  it('has Grid with List style', () => {
    expect(hasNamedControl(xml, 'Grid')).toBe(true);
    expect(xml).toContain('<Style>List</Style>');
  });

  it('has DetailsGroup with Tab', () => {
    expect(hasNamedControl(xml, 'DetailsGroup')).toBe(true);
    expect(hasNamedControl(xml, 'Tab')).toBe(true);
  });

  it('has Overview and General tab pages', () => {
    expect(hasNamedControl(xml, 'TabPageOverview')).toBe(true);
    expect(hasNamedControl(xml, 'TabPageGeneral')).toBe(true);
  });

  it('places detail fields in overview group', () => {
    expect(hasNamedControl(xml, 'Overview_Field1')).toBe(true);
  });
});

// ─── DetailsMaster ───────────────────────────────────────────────────────────

describe('DetailsMaster pattern', () => {
  const xml = FormPatternTemplates.buildDetailsMaster(defaultOpts);

  it('generates valid XML with correct pattern', () => {
    expect(xml).toContain('<AxForm');
    expect(hasDesignProperty(xml, 'Pattern', 'DetailsMaster')).toBe(true);
    expect(hasDesignProperty(xml, 'PatternVersion', '1.1')).toBe(true);
    expect(hasDesignProperty(xml, 'Style', 'DetailsFormMaster')).toBe(true);
  });

  it('has DataSource on Design', () => {
    expect(hasDesignProperty(xml, 'DataSource', 'TestDS')).toBe(true);
  });

  it('has TitleDataSource on Design', () => {
    expect(hasDesignProperty(xml, 'TitleDataSource', 'TestDS')).toBe(true);
  });

  it('has InsertIfEmpty=No on datasource', () => {
    expect(xml).toContain('<InsertIfEmpty>No</InsertIfEmpty>');
  });

  it('has ActionPane control', () => {
    expect(hasNamedControl(xml, 'ActionPane')).toBe(true);
    expect(xml).toContain('AxFormActionPaneControl');
  });

  it('has NavigationFilterGroup with QuickFilter', () => {
    expect(hasNamedControl(xml, 'NavigationFilterGroup')).toBe(true);
    expect(xml).toContain('<Pattern>CustomAndQuickFilters</Pattern>');
    expect(hasNamedControl(xml, 'QuickFilterControl')).toBe(true);
  });

  it('has HeaderGroup', () => {
    expect(hasNamedControl(xml, 'HeaderGroup')).toBe(true);
  });

  it('has Tab with FastTabs style', () => {
    expect(hasNamedControl(xml, 'Tab')).toBe(true);
    expect(xml).toContain('<Style>FastTabs</Style>');
  });

  it('has Overview and General tab pages', () => {
    expect(hasNamedControl(xml, 'TabPageOverview')).toBe(true);
    expect(hasNamedControl(xml, 'TabPageGeneral')).toBe(true);
  });

  it('places fields in Overview tab page', () => {
    expect(hasNamedControl(xml, 'Overview_Field1')).toBe(true);
    expect(hasNamedControl(xml, 'Overview_Field2')).toBe(true);
  });

  it('generates correct control hierarchy order: ActionPane → Filter → Header → Tab', () => {
    const actionPaneIdx = xml.indexOf('<Name>ActionPane</Name>');
    const filterIdx = xml.indexOf('<Name>NavigationFilterGroup</Name>');
    const headerIdx = xml.indexOf('<Name>HeaderGroup</Name>');
    const tabIdx = xml.indexOf('<Name>Tab</Name>');
    expect(actionPaneIdx).toBeLessThan(filterIdx);
    expect(filterIdx).toBeLessThan(headerIdx);
    expect(headerIdx).toBeLessThan(tabIdx);
  });
});

// ─── DetailsTransaction ──────────────────────────────────────────────────────

describe('DetailsTransaction pattern', () => {
  const opts = {
    ...defaultOpts,
    linesDsName: 'TestLines',
    linesDsTable: 'TestLineTable',
  };
  const xml = FormPatternTemplates.buildDetailsTransaction(opts);

  it('generates valid XML with correct pattern', () => {
    expect(xml).toContain('<AxForm');
    expect(hasDesignProperty(xml, 'Pattern', 'DetailsTransaction')).toBe(true);
    expect(hasDesignProperty(xml, 'PatternVersion', '1.1')).toBe(true);
    expect(hasDesignProperty(xml, 'Style', 'DetailsFormTransaction')).toBe(true);
  });

  it('has DataSource on Design', () => {
    expect(hasDesignProperty(xml, 'DataSource', 'TestDS')).toBe(true);
  });

  it('has TitleDataSource on Design', () => {
    expect(hasDesignProperty(xml, 'TitleDataSource', 'TestDS')).toBe(true);
  });

  it('has InsertIfEmpty=No on both datasources', () => {
    // Count occurrences of InsertIfEmpty
    const matches = xml.match(/<InsertIfEmpty>No<\/InsertIfEmpty>/g);
    expect(matches).not.toBeNull();
    expect(matches!.length).toBeGreaterThanOrEqual(2);
  });

  it('uses Active LinkType for lines datasource (not InnerJoin)', () => {
    expect(xml).toContain('<LinkType>Active</LinkType>');
    expect(xml).not.toContain('<LinkType>InnerJoin</LinkType>');
  });

  it('has header and lines datasources', () => {
    expect(xml).toContain(`<Name>TestDS</Name>`);
    expect(xml).toContain(`<Table>TestTable</Table>`);
    expect(xml).toContain(`<Name>TestLines</Name>`);
    expect(xml).toContain(`<Table>TestLineTable</Table>`);
  });

  it('has ActionPane control', () => {
    expect(hasNamedControl(xml, 'ActionPane')).toBe(true);
  });

  it('has NavigationFilterGroup with QuickFilter', () => {
    expect(hasNamedControl(xml, 'NavigationFilterGroup')).toBe(true);
    expect(hasNamedControl(xml, 'QuickFilterControl')).toBe(true);
  });

  it('has Tab with FastTabs style', () => {
    expect(hasNamedControl(xml, 'Tab')).toBe(true);
    expect(xml).toContain('<Style>FastTabs</Style>');
  });

  it('has Header and Lines tab pages', () => {
    expect(hasNamedControl(xml, 'TabPageHeader')).toBe(true);
    expect(hasNamedControl(xml, 'TabPageLines')).toBe(true);
  });

  it('has LinesGrid bound to lines datasource', () => {
    expect(hasNamedControl(xml, 'LinesGrid')).toBe(true);
    expect(xml).toContain(`<DataSource>TestLines</DataSource>`);
  });

  it('has LinesActionPane for line-level actions', () => {
    expect(hasNamedControl(xml, 'LinesActionPane')).toBe(true);
  });

  it('HeaderGeneralGroup does not have redundant Pattern attribute', () => {
    // The group inside TabPageHeader should not have its own Pattern=FieldsFieldGroups
    const headerGroupIdx = xml.indexOf('<Name>HeaderGeneralGroup</Name>');
    expect(headerGroupIdx).toBeGreaterThan(-1);
    // Check the ~200 chars after HeaderGeneralGroup name — should have Type but not Pattern
    const after = xml.substring(headerGroupIdx, headerGroupIdx + 200);
    expect(after).toContain('<Type>Group</Type>');
    expect(after).not.toContain('<Pattern>FieldsFieldGroups</Pattern>');
  });
});

// ─── Dialog ──────────────────────────────────────────────────────────────────

describe('Dialog pattern', () => {
  const xml = FormPatternTemplates.buildDialog(defaultOpts);

  it('generates valid XML with correct pattern', () => {
    expect(xml).toContain('<AxForm');
    expect(hasDesignProperty(xml, 'Pattern', 'Dialog')).toBe(true);
    expect(hasDesignProperty(xml, 'PatternVersion', '1.2')).toBe(true);
    expect(hasDesignProperty(xml, 'Frame', 'Dialog')).toBe(true);
  });

  it('has DialogBody group with DialogContent style', () => {
    expect(hasNamedControl(xml, 'DialogBody')).toBe(true);
    expect(xml).toContain('<Style>DialogContent</Style>');
  });

  it('has OK and Cancel buttons', () => {
    expect(hasNamedControl(xml, 'OkButton')).toBe(true);
    expect(hasNamedControl(xml, 'CloseButton')).toBe(true);
    expect(xml).toContain('<Command>OK</Command>');
    expect(xml).toContain('<Command>Cancel</Command>');
  });

  it('has ButtonGroup with DialogCommitContainer style', () => {
    expect(xml).toContain('<Style>DialogCommitContainer</Style>');
  });

  it('binds body fields to datasource when dsName is provided', () => {
    expect(xml).toContain(`<DataSource>TestDS</DataSource>`);
    expect(xml).toContain(`<DataField>Field1</DataField>`);
  });

  it('supports unbound dialog (no datasource)', () => {
    const unboundXml = FormPatternTemplates.buildDialog({
      formName: 'UnboundDialog',
      gridFields: ['Param1'],
    });
    expect(unboundXml).toContain('<DataSources />');
    expect(hasNamedControl(unboundXml, 'Param1')).toBe(true);
  });

  it('supports sections as tab pages', () => {
    const sectionXml = FormPatternTemplates.buildDialog({
      formName: 'SectionDialog',
      sections: [
        { name: 'General', caption: 'General' },
        { name: 'Advanced', caption: 'Advanced' },
      ],
    });
    expect(hasNamedControl(sectionXml, 'General')).toBe(true);
    expect(hasNamedControl(sectionXml, 'Advanced')).toBe(true);
    expect(sectionXml).toContain('<Caption>Advanced</Caption>');
  });
});

// ─── TableOfContents ─────────────────────────────────────────────────────────

describe('TableOfContents pattern', () => {
  const xml = FormPatternTemplates.buildTableOfContents({
    ...defaultOpts,
    sections: [
      { name: 'TabPageGeneral', caption: 'General' },
      { name: 'TabPageSetup', caption: 'Setup' },
    ],
  });

  it('generates valid XML with correct pattern', () => {
    expect(xml).toContain('<AxForm');
    expect(hasDesignProperty(xml, 'Pattern', 'TableOfContents')).toBe(true);
    expect(hasDesignProperty(xml, 'PatternVersion', '1.1')).toBe(true);
  });

  it('has ActionPane control', () => {
    expect(hasNamedControl(xml, 'ActionPane')).toBe(true);
    expect(xml).toContain('AxFormActionPaneControl');
  });

  it('has DataSource on Design when dsName is provided', () => {
    expect(hasDesignProperty(xml, 'DataSource', 'TestDS')).toBe(true);
  });

  it('has InsertIfEmpty=No on datasource', () => {
    expect(xml).toContain('<InsertIfEmpty>No</InsertIfEmpty>');
  });

  it('has Tab with TOCList style', () => {
    expect(hasNamedControl(xml, 'Tab')).toBe(true);
    expect(xml).toContain('<Style>TOCList</Style>');
  });

  it('generates tab pages from sections', () => {
    expect(hasNamedControl(xml, 'TabPageGeneral')).toBe(true);
    expect(hasNamedControl(xml, 'TabPageSetup')).toBe(true);
    expect(xml).toContain('<Caption>General</Caption>');
    expect(xml).toContain('<Caption>Setup</Caption>');
  });

  it('generates correct control order: ActionPane before Tab', () => {
    const apIdx = xml.indexOf('<Name>ActionPane</Name>');
    const tabIdx = xml.indexOf('<Name>Tab</Name>');
    expect(apIdx).toBeLessThan(tabIdx);
  });

  it('works without datasource', () => {
    const noDsXml = FormPatternTemplates.buildTableOfContents({
      formName: 'NoDsForm',
    });
    expect(noDsXml).toContain('<DataSources />');
    expect(noDsXml).not.toContain('DataSource xmlns="">undefined');
  });

  it('generates default sections when none provided', () => {
    const defaultXml = FormPatternTemplates.buildTableOfContents({
      formName: 'DefaultTOC',
      dsName: 'Params',
      dsTable: 'ParamsTable',
    });
    expect(hasNamedControl(defaultXml, 'TabPageGeneral')).toBe(true);
    expect(hasNamedControl(defaultXml, 'TabPageSetup')).toBe(true);
  });
});

// ─── Lookup ──────────────────────────────────────────────────────────────────

describe('Lookup pattern', () => {
  const xml = FormPatternTemplates.buildLookup(defaultOpts);

  it('generates valid XML with correct pattern', () => {
    expect(hasDesignProperty(xml, 'Pattern', 'Lookup')).toBe(true);
    expect(hasDesignProperty(xml, 'PatternVersion', '1.2')).toBe(true);
    expect(hasDesignProperty(xml, 'Style', 'Lookup')).toBe(true);
  });

  it('has CustomFilterGroup with QuickFilter', () => {
    expect(hasNamedControl(xml, 'CustomFilterGroup')).toBe(true);
    expect(hasNamedControl(xml, 'QuickFilterControl')).toBe(true);
  });

  it('has Grid with fields', () => {
    expect(hasNamedControl(xml, 'Grid')).toBe(true);
    expect(hasNamedControl(xml, 'Grid_Field1')).toBe(true);
  });
});

// ─── ListPage ────────────────────────────────────────────────────────────────

describe('ListPage pattern', () => {
  const xml = FormPatternTemplates.buildListPage(defaultOpts);

  it('generates valid XML with correct pattern', () => {
    expect(hasDesignProperty(xml, 'Pattern', 'ListPage')).toBe(true);
    expect(hasDesignProperty(xml, 'PatternVersion', '1.1')).toBe(true);
    expect(hasDesignProperty(xml, 'Style', 'ListPage')).toBe(true);
  });

  it('has DataSource and TitleDataSource on Design', () => {
    expect(hasDesignProperty(xml, 'DataSource', 'TestDS')).toBe(true);
    expect(hasDesignProperty(xml, 'TitleDataSource', 'TestDS')).toBe(true);
  });

  it('has ActionPane with ActionPaneTab structure', () => {
    expect(hasNamedControl(xml, 'ActionPane')).toBe(true);
    expect(hasNamedControl(xml, 'ActionPaneTab')).toBe(true);
    expect(hasNamedControl(xml, 'NewButtonGroup')).toBe(true);
  });

  it('has CustomFilterGroup with QuickFilter', () => {
    expect(hasNamedControl(xml, 'CustomFilterGroup')).toBe(true);
    expect(hasNamedControl(xml, 'QuickFilterControl')).toBe(true);
  });

  it('has Grid with read-only datasource', () => {
    expect(hasNamedControl(xml, 'Grid')).toBe(true);
    expect(xml).toContain('<AllowCreate>No</AllowCreate>');
    expect(xml).toContain('<AllowEdit>No</AllowEdit>');
    expect(xml).toContain('<AllowDelete>No</AllowDelete>');
    expect(xml).toContain('<InsertIfEmpty>No</InsertIfEmpty>');
  });
});

// ─── Edge cases ──────────────────────────────────────────────────────────────

describe('Form pattern edge cases', () => {
  it('SimpleList works with empty gridFields', () => {
    const xml = FormPatternTemplates.buildSimpleList({
      formName: 'EmptyForm', dsName: 'DS', dsTable: 'T',
    });
    expect(xml).toContain('<AxForm');
    expect(hasNamedControl(xml, 'Grid')).toBe(true);
  });

  it('DetailsMaster works with empty gridFields', () => {
    const xml = FormPatternTemplates.buildDetailsMaster({
      formName: 'EmptyMaster', dsName: 'DS', dsTable: 'T',
    });
    expect(xml).toContain('<AxForm');
    expect(hasNamedControl(xml, 'Tab')).toBe(true);
  });

  it('DetailsTransaction uses default linesDsName when not provided', () => {
    const xml = FormPatternTemplates.buildDetailsTransaction({
      formName: 'OrderForm', dsName: 'Order', dsTable: 'OrderTable',
    });
    // Default: dsName + "Lines"
    expect(xml).toContain('<Name>OrderLines</Name>');
  });

  it('caption is optional and omitted correctly', () => {
    const xml = FormPatternTemplates.buildSimpleList({
      formName: 'NoCaptionForm', dsName: 'DS', dsTable: 'T',
    });
    expect(xml).not.toContain('<Caption');
  });

  it('all patterns generate well-formed XML declarations', () => {
    const patterns = [
      FormPatternTemplates.buildSimpleList(defaultOpts),
      FormPatternTemplates.buildSimpleListDetails(defaultOpts),
      FormPatternTemplates.buildDetailsMaster(defaultOpts),
      FormPatternTemplates.buildDetailsTransaction({ ...defaultOpts, linesDsName: 'Lines', linesDsTable: 'LineT' }),
      FormPatternTemplates.buildDialog(defaultOpts),
      FormPatternTemplates.buildTableOfContents({ ...defaultOpts, sections: [{ name: 'S1', caption: 'S1' }] }),
      FormPatternTemplates.buildLookup(defaultOpts),
      FormPatternTemplates.buildListPage(defaultOpts),
    ];
    for (const xml of patterns) {
      expect(xml).toContain('<?xml version="1.0" encoding="utf-8"?>');
      expect(xml).toContain('<AxForm');
      expect(xml).toContain('</AxForm>');
    }
  });
});
