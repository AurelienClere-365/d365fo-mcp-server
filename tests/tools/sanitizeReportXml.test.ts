/**
 * Unit tests for XmlTemplateGenerator.sanitizeReportXml()
 *
 * These tests guard against regressions where AxReport XML written by
 * create_d365fo_file is missing structural elements required by the
 * D365FO Visual Studio Designer metadata loader.
 *
 * Required invariants:
 *  1. xmlns="Microsoft.Dynamics.AX.Metadata.V2" on <AxReport> root
 *  2. <DataMethods /> directly after <Name>…</Name>
 *  3. xmlns="" on every <AxReportDataSet> element
 *  4. </AxReport> closing tag present
 */

import { describe, it, expect } from 'vitest';
import { XmlTemplateGenerator } from '../../src/tools/createD365File';

// Minimal well-formed report XML (matches what the current generator produces)
const CORRECT_XML = `<?xml version="1.0" encoding="utf-8"?>
<AxReport xmlns:i="http://www.w3.org/2001/XMLSchema-instance" xmlns="Microsoft.Dynamics.AX.Metadata.V2">
\t<Name>MyReport</Name>
\t<DataMethods />
\t<DataSets>
\t\t<AxReportDataSet xmlns="">
\t\t\t<Name>MyReportTmp</Name>
\t\t</AxReportDataSet>
\t</DataSets>
\t<Designs>
\t\t<AxReportDesign xmlns=""
\t\t\t\ti:type="AxReportPrecisionDesign">
\t\t\t<Name>Report</Name>
\t\t</AxReportDesign>
\t</Designs>
\t<EmbeddedImages />
</AxReport>`;

// Broken XML simulating a pre-fix manually-created or old-generator file
const BROKEN_XML = `<?xml version="1.0" encoding="utf-8"?>
<AxReport xmlns:i="http://www.w3.org/2001/XMLSchema-instance">
\t<Name>MyReport</Name>
\t<DataSets>
\t\t<AxReportDataSet>
\t\t\t<Name>MyReportTmp</Name>
\t\t</AxReportDataSet>
\t</DataSets>
\t<Designs>
\t\t<AxReportDesign>
\t\t\t<Name>Report</Name>
\t\t</AxReportDesign>
\t</Designs>
\t<EmbeddedImages />
</AxReport>`;

// Truncated XML — closing tag missing
const TRUNCATED_XML = `<?xml version="1.0" encoding="utf-8"?>
<AxReport xmlns:i="http://www.w3.org/2001/XMLSchema-instance" xmlns="Microsoft.Dynamics.AX.Metadata.V2">
\t<Name>MyReport</Name>
\t<DataMethods />
\t<DataSets>
\t\t<AxReportDataSet xmlns="">
\t\t\t<Name>MyReportTmp</Name>
\t\t</AxReportDataSet>
\t</DataSets>`;

describe('XmlTemplateGenerator.sanitizeReportXml()', () => {
  // ─────────────────────────────────────────────────────────────
  // Idempotency — correct XML must not be changed
  // ─────────────────────────────────────────────────────────────
  describe('idempotency', () => {
    it('should not modify already-correct XML', () => {
      const result = XmlTemplateGenerator.sanitizeReportXml(CORRECT_XML);
      expect(result).toBe(CORRECT_XML);
    });

    it('should be idempotent — applying twice gives same result as once', () => {
      const once = XmlTemplateGenerator.sanitizeReportXml(BROKEN_XML);
      const twice = XmlTemplateGenerator.sanitizeReportXml(once);
      expect(twice).toBe(once);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Fix 1 — xmlns="Microsoft.Dynamics.AX.Metadata.V2"
  // ─────────────────────────────────────────────────────────────
  describe('fix 1: xmlns on <AxReport>', () => {
    it('should add xmlns="Microsoft.Dynamics.AX.Metadata.V2" when missing', () => {
      const xml = `<AxReport xmlns:i="http://www.w3.org/2001/XMLSchema-instance">\n\t<Name>X</Name>\n</AxReport>`;
      const result = XmlTemplateGenerator.sanitizeReportXml(xml);
      expect(result).toContain('xmlns="Microsoft.Dynamics.AX.Metadata.V2"');
    });

    it('should not duplicate xmlns when already present', () => {
      const xml = `<AxReport xmlns:i="..." xmlns="Microsoft.Dynamics.AX.Metadata.V2">\n\t<Name>X</Name>\n</AxReport>`;
      const result = XmlTemplateGenerator.sanitizeReportXml(xml);
      const count = (result.match(/xmlns="Microsoft\.Dynamics\.AX\.Metadata\.V2"/g) || []).length;
      expect(count).toBe(1);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Fix 2 — <DataMethods />
  // ─────────────────────────────────────────────────────────────
  describe('fix 2: <DataMethods />', () => {
    it('should insert <DataMethods /> after top-level <Name> when missing', () => {
      const xml = `<AxReport xmlns="Microsoft.Dynamics.AX.Metadata.V2">\n\t<Name>MyReport</Name>\n\t<DataSets />\n</AxReport>`;
      const result = XmlTemplateGenerator.sanitizeReportXml(xml);
      expect(result).toContain('<DataMethods');
      // Must appear after <Name>
      const nameIdx = result.indexOf('<Name>MyReport</Name>');
      const dmIdx = result.indexOf('<DataMethods');
      expect(dmIdx).toBeGreaterThan(nameIdx);
    });

    it('should not add duplicate <DataMethods />', () => {
      const xml = `<AxReport xmlns="Microsoft.Dynamics.AX.Metadata.V2">\n\t<Name>X</Name>\n\t<DataMethods />\n</AxReport>`;
      const result = XmlTemplateGenerator.sanitizeReportXml(xml);
      const count = (result.match(/<DataMethods/g) || []).length;
      expect(count).toBe(1);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Fix 3 — xmlns="" on <AxReportDataSet>
  // ─────────────────────────────────────────────────────────────
  describe('fix 3: xmlns="" on <AxReportDataSet>', () => {
    it('should add xmlns="" to bare <AxReportDataSet>', () => {
      const xml = `<AxReport xmlns="Microsoft.Dynamics.AX.Metadata.V2">\n\t<Name>X</Name>\n\t<DataMethods />\n\t<DataSets>\n\t\t<AxReportDataSet>\n\t\t</AxReportDataSet>\n\t</DataSets>\n</AxReport>`;
      const result = XmlTemplateGenerator.sanitizeReportXml(xml);
      expect(result).toContain('<AxReportDataSet xmlns="">');
      expect(result).not.toContain('<AxReportDataSet>');
    });

    it('should not duplicate xmlns="" when already present', () => {
      const xml = `<AxReport xmlns="Microsoft.Dynamics.AX.Metadata.V2">\n\t<Name>X</Name>\n\t<DataMethods />\n\t<DataSets>\n\t\t<AxReportDataSet xmlns="">\n\t\t</AxReportDataSet>\n\t</DataSets>\n</AxReport>`;
      const result = XmlTemplateGenerator.sanitizeReportXml(xml);
      const count = (result.match(/<AxReportDataSet/g) || []).length;
      const withNs = (result.match(/<AxReportDataSet xmlns=""/g) || []).length;
      expect(count).toBe(withNs);
    });

    it('should fix multiple <AxReportDataSet> elements in one pass', () => {
      const xml = `<AxReport xmlns="Microsoft.Dynamics.AX.Metadata.V2">\n\t<Name>X</Name>\n\t<DataMethods />\n\t<DataSets>\n\t\t<AxReportDataSet>\n\t\t</AxReportDataSet>\n\t\t<AxReportDataSet>\n\t\t</AxReportDataSet>\n\t</DataSets>\n</AxReport>`;
      const result = XmlTemplateGenerator.sanitizeReportXml(xml);
      const count = (result.match(/<AxReportDataSet xmlns=""/g) || []).length;
      expect(count).toBe(2);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Fix 4 — </AxReport> closing tag
  // ─────────────────────────────────────────────────────────────
  describe('fix 4: </AxReport> closing tag', () => {
    it('should append </AxReport> when missing', () => {
      const result = XmlTemplateGenerator.sanitizeReportXml(TRUNCATED_XML);
      expect(result.trimEnd()).toMatch(/<\/AxReport>$/);
    });

    it('should not add extra closing tag when already present', () => {
      const xml = `<AxReport xmlns="Microsoft.Dynamics.AX.Metadata.V2">\n\t<Name>X</Name>\n\t<DataMethods />\n</AxReport>`;
      const result = XmlTemplateGenerator.sanitizeReportXml(xml);
      const count = (result.match(/<\/AxReport>/g) || []).length;
      expect(count).toBe(1);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Fix 5 — <AxReportDesign> xmlns="" and i:type attributes
  // ─────────────────────────────────────────────────────────────
  describe('fix 5: <AxReportDesign> attributes', () => {
    it('should add xmlns="" and i:type to bare <AxReportDesign>', () => {
      const xml = `<AxReport xmlns="Microsoft.Dynamics.AX.Metadata.V2">\n\t<Name>X</Name>\n\t<DataMethods />\n\t<Designs>\n\t\t<AxReportDesign>\n\t\t\t<Name>Report</Name>\n\t\t</AxReportDesign>\n\t</Designs>\n</AxReport>`;
      const result = XmlTemplateGenerator.sanitizeReportXml(xml);
      expect(result).toContain('xmlns=""');
      expect(result).toContain('i:type="AxReportPrecisionDesign"');
    });

    it('should not duplicate attributes when already present', () => {
      const xml = `<AxReport xmlns="Microsoft.Dynamics.AX.Metadata.V2">\n\t<Name>X</Name>\n\t<DataMethods />\n\t<Designs>\n\t\t<AxReportDesign xmlns=""\n\t\t\t\ti:type="AxReportPrecisionDesign">\n\t\t\t<Name>Report</Name>\n\t\t</AxReportDesign>\n\t</Designs>\n</AxReport>`;
      const result = XmlTemplateGenerator.sanitizeReportXml(xml);
      const xnsCount = (result.match(/xmlns=""/g) || []).length;
      // xmlns="" appears on AxReportDataSet (0 here) and AxReportDesign (1)
      expect(xnsCount).toBeGreaterThanOrEqual(1);
      const typeCount = (result.match(/i:type="AxReportPrecisionDesign"/g) || []).length;
      expect(typeCount).toBe(1);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Full broken XML — all 5 fixes applied together
  // ─────────────────────────────────────────────────────────────
  describe('combined fix on fully broken XML', () => {
    it('should fix all 5 issues in BROKEN_XML in one call', () => {
      const result = XmlTemplateGenerator.sanitizeReportXml(BROKEN_XML);
      expect(result).toContain('xmlns="Microsoft.Dynamics.AX.Metadata.V2"');
      expect(result).toContain('<DataMethods');
      expect(result).toContain('<AxReportDataSet xmlns="">');
      expect(result.trimEnd()).toMatch(/<\/AxReport>$/);
      expect(result).toContain('i:type="AxReportPrecisionDesign"');
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Template generator output — verify it's already correct
  // ─────────────────────────────────────────────────────────────
  describe('template generator output', () => {
    it('generateAxReportXml() output passes sanitize without any changes', () => {
      const generated = XmlTemplateGenerator.generateAxReportXml('TestReport', {
        tmpTableName: 'TestReportTmp',
        dpClassName: 'TestReportDP',
        datasetName: 'TestReportTmp',
      });
      const sanitized = XmlTemplateGenerator.sanitizeReportXml(generated);
      expect(sanitized).toBe(generated);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Fix 6 — <Parameters> inside <AxReportDataSet>
  // ─────────────────────────────────────────────────────────────
  describe('fix 6: <Parameters> in <AxReportDataSet>', () => {
    const XML_WITH_DS_NO_PARAMS = `<?xml version="1.0" encoding="utf-8"?>
<AxReport xmlns:i="http://www.w3.org/2001/XMLSchema-instance" xmlns="Microsoft.Dynamics.AX.Metadata.V2">
\t<Name>TestRep</Name>
\t<DataMethods />
\t<DataSets>
\t\t<AxReportDataSet xmlns="">
\t\t\t<Name>TestRepTmp</Name>
\t\t\t<DataSourceType>ReportDataProvider</DataSourceType>
\t\t\t<Query>SELECT * FROM TestRepDP.TestRepTmp</Query>
\t\t\t<FieldGroups />
\t\t\t<Fields />
\t\t</AxReportDataSet>
\t</DataSets>
\t<Designs>
\t\t<AxReportDesign xmlns=""
\t\t\t\ti:type="AxReportPrecisionDesign">
\t\t\t<Name>Report</Name>
\t\t</AxReportDesign>
\t</Designs>
\t<EmbeddedImages />
</AxReport>`;

    it('should add <Parameters> after <Fields /> when DataSourceType present', () => {
      const result = XmlTemplateGenerator.sanitizeReportXml(XML_WITH_DS_NO_PARAMS);
      expect(result).toContain('<Parameters>');
      expect(result).toContain('<Name>AX_PartitionKey</Name>');
      expect(result).toContain('<Name>AX_RdpPreProcessedId</Name>');
      // Must be inside the dataset, after Fields
      const fieldsIdx = result.indexOf('<Fields />');
      const paramsIdx = result.indexOf('<Parameters>');
      expect(paramsIdx).toBeGreaterThan(fieldsIdx);
    });

    it('should NOT add <Parameters> to datasets without <DataSourceType> (minimal stub)', () => {
      const result = XmlTemplateGenerator.sanitizeReportXml(CORRECT_XML);
      expect(result).toBe(CORRECT_XML); // no change to minimal XML
    });

    it('should not duplicate <Parameters> when already present', () => {
      const xml = XML_WITH_DS_NO_PARAMS;
      const once = XmlTemplateGenerator.sanitizeReportXml(xml);
      const twice = XmlTemplateGenerator.sanitizeReportXml(once);
      expect(twice).toBe(once);
      const count = (once.match(/<Parameters>/g) || []).length;
      expect(count).toBe(1);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Fix 7 — <DefaultParameterGroup> before <Designs>
  // ─────────────────────────────────────────────────────────────
  describe('fix 7: <DefaultParameterGroup>', () => {
    const XML_WITH_DS_NO_DPG = `<?xml version="1.0" encoding="utf-8"?>
<AxReport xmlns:i="http://www.w3.org/2001/XMLSchema-instance" xmlns="Microsoft.Dynamics.AX.Metadata.V2">
\t<Name>TestRep</Name>
\t<DataMethods />
\t<DataSets>
\t\t<AxReportDataSet xmlns="">
\t\t\t<Name>TestRepTmp</Name>
\t\t\t<DataSourceType>ReportDataProvider</DataSourceType>
\t\t\t<Query>SELECT * FROM TestRepDP.TestRepTmp</Query>
\t\t\t<FieldGroups />
\t\t\t<Fields />
\t\t</AxReportDataSet>
\t</DataSets>
\t<Designs>
\t\t<AxReportDesign xmlns=""
\t\t\t\ti:type="AxReportPrecisionDesign">
\t\t\t<Name>Report</Name>
\t\t</AxReportDesign>
\t</Designs>
\t<EmbeddedImages />
</AxReport>`;

    it('should add <DefaultParameterGroup> before <Designs> when DataSourceType present', () => {
      const result = XmlTemplateGenerator.sanitizeReportXml(XML_WITH_DS_NO_DPG);
      expect(result).toContain('<DefaultParameterGroup>');
      expect(result).toContain('<Name xmlns="">Parameters</Name>');
      // Must appear before <Designs>
      const dpgIdx = result.indexOf('<DefaultParameterGroup>');
      const designIdx = result.indexOf('<Designs>');
      expect(dpgIdx).toBeGreaterThan(0);
      expect(dpgIdx).toBeLessThan(designIdx);
    });

    it('should NOT add <DefaultParameterGroup> without <DataSourceType>', () => {
      const result = XmlTemplateGenerator.sanitizeReportXml(CORRECT_XML);
      expect(result).toBe(CORRECT_XML);
    });

    it('should not duplicate <DefaultParameterGroup> when already present', () => {
      const once = XmlTemplateGenerator.sanitizeReportXml(XML_WITH_DS_NO_DPG);
      const twice = XmlTemplateGenerator.sanitizeReportXml(once);
      expect(twice).toBe(once);
      const count = (once.match(/<DefaultParameterGroup>/g) || []).length;
      expect(count).toBe(1);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Fix 8 — RDL schema-aware structural repair (2008 and 2010)
  // ─────────────────────────────────────────────────────────────
  describe('fix 8: RDL schema-aware structural repair', () => {
    const NS_2008 = 'http://schemas.microsoft.com/sqlserver/reporting/2008/01/reportdefinition';
    const NS_2010 = 'http://schemas.microsoft.com/sqlserver/reporting/2010/01/reportdefinition';
    const NS_2016 = 'http://schemas.microsoft.com/sqlserver/reporting/2016/01/reportdefinition';

    // 2008: PageHeader as direct child of Report (wrong — must be inside Page)
    const RDL_2008_WRONG = `<?xml version="1.0"?><Report xmlns="${NS_2008}"><PageHeader><Height>1cm</Height></PageHeader><Body><Height>10cm</Height></Body></Report>`;
    // 2008: Real-world scenario — <Page> already exists (page dimensions) but <PageHeader> is still a stray direct child
    const RDL_2008_WRONG_WITH_PAGE = `<?xml version="1.0"?><Report xmlns="${NS_2008}"><DataSources><DataSource Name="AX"><DataSourceReference>AX</DataSourceReference></DataSource></DataSources><PageHeader><Height>1cm</Height></PageHeader><Body><Height>10cm</Height></Body><Page><PageWidth>21cm</PageWidth><PageHeight>29cm</PageHeight><TopMargin>2cm</TopMargin><BottomMargin>2cm</BottomMargin><LeftMargin>2cm</LeftMargin><RightMargin>2cm</RightMargin></Page></Report>`;
    // 2008: PageHeader already inside Page (correct for 2008)
    const RDL_2008_CORRECT = `<?xml version="1.0"?><Report xmlns="${NS_2008}"><DataSources><DataSource Name="AX"><DataSourceReference>AX</DataSourceReference></DataSource></DataSources><Body><Height>10cm</Height></Body><Page><PageHeader><Height>1cm</Height></PageHeader><PageWidth>21cm</PageWidth></Page></Report>`;
    // 2010: Body and Page as direct children of Report (wrong — must be inside ReportSections)
    const RDL_2010_WRONG_PAGE = `<?xml version="1.0"?><Report xmlns="${NS_2010}"><DataSources><DataSource Name="AX"><DataSourceReference>AX</DataSourceReference></DataSource></DataSources><Body><Height>10cm</Height></Body><Page><PageHeader><Height>1cm</Height></PageHeader></Page></Report>`;
    // 2010: PageHeader as stray direct child (must end up inside ReportSections/ReportSection/Page)
    const RDL_2010_WRONG_PH = `<?xml version="1.0"?><Report xmlns="${NS_2010}"><PageHeader><Height>1cm</Height></PageHeader><Body><Height>10cm</Height></Body></Report>`;
    // 2010: already correct — ReportSections present
    const RDL_2010_CORRECT = `<?xml version="1.0"?><Report xmlns="${NS_2010}"><DataSources><DataSource Name="AX"><DataSourceReference>AX</DataSourceReference></DataSource></DataSources><ReportSections><ReportSection><Body><Height>10cm</Height></Body><Page><PageHeader><Height>1cm</Height></PageHeader></Page></ReportSection></ReportSections></Report>`;

    const makeAxReport = (rdl: string) =>
      `<AxReport xmlns="Microsoft.Dynamics.AX.Metadata.V2"><Name>R</Name><DataMethods /><Designs><AxReportDesign xmlns="" i:type="AxReportPrecisionDesign"><Name>Report</Name><Text><![CDATA[${rdl}]]></Text></AxReportDesign></Designs></AxReport>`;

    // ── 2008 tests ────────────────────────────────────────────
    it('2008: moves <PageHeader> inside <Page> when it is a direct child of <Report>', () => {
      const xml = makeAxReport(RDL_2008_WRONG);
      const result = XmlTemplateGenerator.sanitizeReportXml(xml);
      expect(result).toContain('<Page>');
      expect(result).toContain('<PageHeader>');
      const pageIdx = result.indexOf('<Page>');
      const phIdx = result.indexOf('<PageHeader>');
      expect(phIdx).toBeGreaterThan(pageIdx);
    });

    it('2008: does not modify RDL when <PageHeader> is already inside <Page>', () => {
      const xml = makeAxReport(RDL_2008_CORRECT);
      const result = XmlTemplateGenerator.sanitizeReportXml(xml);
      const cdataMatch = result.match(/<!\[CDATA\[([\s\S]*?)\]\]>/);
      expect(cdataMatch).toBeTruthy();
      expect(cdataMatch![1]).toBe(RDL_2008_CORRECT);
    });

    it('2008: fix is idempotent', () => {
      const xml = makeAxReport(RDL_2008_WRONG);
      const once = XmlTemplateGenerator.sanitizeReportXml(xml);
      const twice = XmlTemplateGenerator.sanitizeReportXml(once);
      expect(twice).toBe(once);
    });

    it('2008: moves stray <PageHeader> into existing <Page> when <Page> has page-dimension settings', () => {
      // Real-world case: RDL already has <Page> for PageWidth/Height/Margins, yet <PageHeader>
      // is still a direct child of <Report>. The old guard `!rdl.match(/<Page...>/)` blocked this.
      const xml = makeAxReport(RDL_2008_WRONG_WITH_PAGE);
      const result = XmlTemplateGenerator.sanitizeReportXml(xml);
      const cdataMatch = result.match(/<!\[CDATA\[([\s\S]*?)\]\]>/);
      expect(cdataMatch).toBeTruthy();
      const fixed = cdataMatch![1];
      // PageHeader must be inside the Page element
      expect(fixed).toContain('<Page>');
      expect(fixed).toContain('<PageHeader>');
      const pageStart = fixed.indexOf('<Page>');
      const pageEnd   = fixed.indexOf('</Page>');
      const phIdx     = fixed.indexOf('<PageHeader>');
      expect(phIdx).toBeGreaterThan(pageStart);
      expect(phIdx).toBeLessThan(pageEnd);
      // PageHeader must no longer be a direct child of Report (not before <Body>)
      const bodyIdx = fixed.indexOf('<Body>');
      expect(phIdx).toBeGreaterThan(bodyIdx);
    });

    it('2008: fix with existing <Page> is idempotent', () => {
      const xml = makeAxReport(RDL_2008_WRONG_WITH_PAGE);
      const once = XmlTemplateGenerator.sanitizeReportXml(xml);
      const twice = XmlTemplateGenerator.sanitizeReportXml(once);
      expect(twice).toBe(once);
    });

    // ── 2010 tests ────────────────────────────────────────────
    it('2010: wraps Body+Page in <ReportSections>/<ReportSection> when they are direct children of <Report>', () => {
      const xml = makeAxReport(RDL_2010_WRONG_PAGE);
      const result = XmlTemplateGenerator.sanitizeReportXml(xml);
      expect(result).toContain('<ReportSections>');
      expect(result).toContain('<ReportSection>');
      // Body and Page must be INSIDE ReportSection
      const sectionIdx = result.indexOf('<ReportSection>');
      const bodyIdx    = result.indexOf('<Body>');
      const pageIdx    = result.indexOf('<Page>');
      expect(bodyIdx).toBeGreaterThan(sectionIdx);
      expect(pageIdx).toBeGreaterThan(sectionIdx);
      // Page must NOT be a direct child of Report
      const reportOpenEnd = result.indexOf('>',  result.indexOf('<Report '));
      expect(pageIdx).toBeGreaterThan(reportOpenEnd + 1); // not immediately after <Report>
    });

    it('2010: wraps stray <PageHeader> (direct child of <Report>) inside ReportSections/ReportSection/Page', () => {
      const xml = makeAxReport(RDL_2010_WRONG_PH);
      const result = XmlTemplateGenerator.sanitizeReportXml(xml);
      expect(result).toContain('<ReportSections>');
      expect(result).toContain('<Page>');
      expect(result).toContain('<PageHeader>');
      const sectionIdx = result.indexOf('<ReportSection>');
      const phIdx      = result.indexOf('<PageHeader>');
      expect(phIdx).toBeGreaterThan(sectionIdx);
    });

    it('2010: does not modify RDL when <ReportSections> already present', () => {
      const xml = makeAxReport(RDL_2010_CORRECT);
      const result = XmlTemplateGenerator.sanitizeReportXml(xml);
      const cdataMatch = result.match(/<!\[CDATA\[([\s\S]*?)\]\]>/);
      expect(cdataMatch).toBeTruthy();
      expect(cdataMatch![1]).toBe(RDL_2010_CORRECT);
    });

    it('2010: fix is idempotent', () => {
      const xml = makeAxReport(RDL_2010_WRONG_PAGE);
      const once = XmlTemplateGenerator.sanitizeReportXml(xml);
      const twice = XmlTemplateGenerator.sanitizeReportXml(once);
      expect(twice).toBe(once);
    });

    // ── 2016 tests ────────────────────────────────────────────
    it('2016: wraps Body+Page in <ReportSections>/<ReportSection>', () => {
      const RDL_2016_WRONG = `<?xml version="1.0"?><Report xmlns="${NS_2016}"><DataSources><DataSource Name="AX"><DataSourceReference>AX</DataSourceReference></DataSource></DataSources><Body><Height>10cm</Height></Body><Page><PageHeader><Height>1cm</Height></PageHeader></Page></Report>`;
      const xml = makeAxReport(RDL_2016_WRONG);
      const result = XmlTemplateGenerator.sanitizeReportXml(xml);
      expect(result).toContain('<ReportSections>');
      expect(result).toContain('<ReportSection>');
      const sectionIdx = result.indexOf('<ReportSection>');
      const bodyIdx    = result.indexOf('<Body>');
      const pageIdx    = result.indexOf('<Page>');
      expect(bodyIdx).toBeGreaterThan(sectionIdx);
      expect(pageIdx).toBeGreaterThan(sectionIdx);
    });

    it('2016: fix is idempotent', () => {
      const RDL_2016_WRONG = `<?xml version="1.0"?><Report xmlns="${NS_2016}"><DataSources><DataSource Name="AX"><DataSourceReference>AX</DataSourceReference></DataSource></DataSources><Body><Height>10cm</Height></Body><Page><PageHeader><Height>1cm</Height></PageHeader></Page></Report>`;
      const xml = makeAxReport(RDL_2016_WRONG);
      const once  = XmlTemplateGenerator.sanitizeReportXml(xml);
      const twice = XmlTemplateGenerator.sanitizeReportXml(once);
      expect(twice).toBe(once);
    });

    it('should not modify XML when no <Text><![CDATA[ present', () => {
      const result = XmlTemplateGenerator.sanitizeReportXml(CORRECT_XML);
      expect(result).toBe(CORRECT_XML);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Fix 9 — wrong margin element names (MarginTop → TopMargin, etc.)
  // ─────────────────────────────────────────────────────────────
  describe('fix 9: wrong margin element names in embedded RDL', () => {
    const makeWithMarginTop = (ns: string) =>
      `<AxReport xmlns="Microsoft.Dynamics.AX.Metadata.V2"><Name>R</Name><DataMethods /><Designs><AxReportDesign xmlns="" i:type="AxReportPrecisionDesign"><Name>Report</Name><Text><![CDATA[<?xml version="1.0"?><Report xmlns="${ns}"><Body /><Page><PageHeight>11in</PageHeight><MarginTop>0.5in</MarginTop><MarginBottom>0.5in</MarginBottom><MarginLeft>0.5in</MarginLeft><MarginRight>0.5in</MarginRight></Page></Report>]]></Text></AxReportDesign></Designs></AxReport>`;

    it('renames MarginTop/Bottom/Left/Right to TopMargin/BottomMargin/LeftMargin/RightMargin (2008 ns)', () => {
      const xml = makeWithMarginTop('http://schemas.microsoft.com/sqlserver/reporting/2008/01/reportdefinition');
      const result = XmlTemplateGenerator.sanitizeReportXml(xml);
      expect(result).toContain('<TopMargin>');
      expect(result).toContain('<BottomMargin>');
      expect(result).toContain('<LeftMargin>');
      expect(result).toContain('<RightMargin>');
      expect(result).not.toContain('<MarginTop>');
      expect(result).not.toContain('<MarginBottom>');
      expect(result).not.toContain('<MarginLeft>');
      expect(result).not.toContain('<MarginRight>');
    });

    it('renames MarginX elements regardless of RDL namespace', () => {
      const xml = makeWithMarginTop('http://schemas.microsoft.com/sqlserver/reporting/2016/01/reportdefinition');
      const result = XmlTemplateGenerator.sanitizeReportXml(xml);
      expect(result).toContain('<TopMargin>');
      expect(result).not.toContain('<MarginTop>');
    });

    it('fix 9 is idempotent', () => {
      const xml = makeWithMarginTop('http://schemas.microsoft.com/sqlserver/reporting/2008/01/reportdefinition');
      const once  = XmlTemplateGenerator.sanitizeReportXml(xml);
      const twice = XmlTemplateGenerator.sanitizeReportXml(once);
      expect(twice).toBe(once);
    });

    it('does not modify XML that already uses correct TopMargin names', () => {
      const rdl = `<?xml version="1.0"?><Report xmlns="http://schemas.microsoft.com/sqlserver/reporting/2008/01/reportdefinition"><Body /><Page><TopMargin>0.5in</TopMargin><BottomMargin>0.5in</BottomMargin><LeftMargin>0.5in</LeftMargin><RightMargin>0.5in</RightMargin></Page></Report>`;
      const xml = `<AxReport xmlns="Microsoft.Dynamics.AX.Metadata.V2"><Name>R</Name><DataMethods /><Designs><AxReportDesign xmlns="" i:type="AxReportPrecisionDesign"><Name>Report</Name><Text><![CDATA[${rdl}]]></Text></AxReportDesign></Designs></AxReport>`;
      const result = XmlTemplateGenerator.sanitizeReportXml(xml);
      expect(result).toBe(xml);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Fix 11 — doubled closing tags inside embedded RDL
  // ─────────────────────────────────────────────────────────────
  describe('fix 11: doubled closing tags in embedded RDL', () => {
    const NS = 'http://schemas.microsoft.com/sqlserver/reporting/2016/01/reportdefinition';
    const wrap = (rdl: string) =>
      `<AxReport xmlns="Microsoft.Dynamics.AX.Metadata.V2"><Name>R</Name><DataMethods /><Designs><AxReportDesign xmlns="" i:type="AxReportPrecisionDesign"><Name>Report</Name><Text><![CDATA[${rdl}]]></Text></AxReportDesign></Designs></AxReport>`;

    it('removes doubled closing tag </BorderWidth></BorderWidth>', () => {
      const rdl = `<?xml version="1.0"?><Report xmlns="${NS}"><ReportSections><ReportSection><Body><ReportItems /><Height>1in</Height></Body><Width>7.5in</Width><Page><Style><Border><Style>None</Style><Width>1pt</Width></BorderWidth></BorderWidth></Border></Style></Page></ReportSection></ReportSections></Report>`;
      const xml = wrap(rdl);
      const result = XmlTemplateGenerator.sanitizeReportXml(xml);
      expect(result).not.toContain('</BorderWidth></BorderWidth>');
      expect(result).toContain('</BorderWidth>');
    });

    it('removes multiple doubled closing tags in one pass', () => {
      const rdl = `<?xml version="1.0"?><Report xmlns="${NS}"><ReportSections><ReportSection><Body><ReportItems /><Height>1in</Height></Body><Width>7.5in</Width><Page><Style><Border><Color>#000000</Color></Color><Width>1pt</Width></BorderWidth></BorderWidth></Border></Style></Page></ReportSection></ReportSections></Report>`;
      const xml = wrap(rdl);
      const result = XmlTemplateGenerator.sanitizeReportXml(xml);
      expect(result).not.toContain('</Color></Color>');
      expect(result).not.toContain('</BorderWidth></BorderWidth>');
    });

    it('fix 11 is idempotent', () => {
      const rdl = `<?xml version="1.0"?><Report xmlns="${NS}"><ReportSections><ReportSection><Body><ReportItems /><Height>1in</Height></Body><Width>7.5in</Width><Page><Style><Border><Width>1pt</Width></BorderWidth></BorderWidth></Border></Style></Page></ReportSection></ReportSections></Report>`;
      const xml = wrap(rdl);
      const once  = XmlTemplateGenerator.sanitizeReportXml(xml);
      const twice = XmlTemplateGenerator.sanitizeReportXml(once);
      expect(twice).toBe(once);
    });

    it('does not modify XML without doubled closing tags', () => {
      const rdl = `<?xml version="1.0"?><Report xmlns="${NS}"><ReportSections><ReportSection><Body><ReportItems /><Height>1in</Height><Style /></Body><Width>7.5in</Width><Page><Style /></Page></ReportSection></ReportSections></Report>`;
      const xml = wrap(rdl);
      const result = XmlTemplateGenerator.sanitizeReportXml(xml);
      expect(result).toBe(xml);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Fix 12 — bare <Value> as direct child of <Textbox>
  // ─────────────────────────────────────────────────────────────
  describe('fix 12: bare <Value> as direct child of <Textbox>', () => {
    const NS = 'http://schemas.microsoft.com/sqlserver/reporting/2016/01/reportdefinition';
    const wrap = (rdl: string) =>
      `<AxReport xmlns="Microsoft.Dynamics.AX.Metadata.V2"><Name>R</Name><DataMethods /><Designs><AxReportDesign xmlns="" i:type="AxReportPrecisionDesign"><Name>Report</Name><Text><![CDATA[${rdl}]]></Text></AxReportDesign></Designs></AxReport>`;

    it('wraps bare <Value> in <Paragraphs> structure', () => {
      const rdl = `<?xml version="1.0"?><Report xmlns="${NS}"><ReportSections><ReportSection><Body><ReportItems><Textbox Name="Txt1"><Value>Hello world</Value><Height>0.25in</Height></Textbox></ReportItems><Height>1in</Height></Body><Width>7.5in</Width><Page><Style /></Page></ReportSection></ReportSections></Report>`;
      const xml = wrap(rdl);
      const result = XmlTemplateGenerator.sanitizeReportXml(xml);
      expect(result).toContain('<Paragraphs>');
      expect(result).toContain('<TextRun>');
      expect(result).toContain('<Value>Hello world</Value>');
      expect(result).not.toMatch(/<Textbox[^>]*>\s*<Value>/);
    });

    it('does not modify <Textbox> that already has <Paragraphs>', () => {
      const rdl = `<?xml version="1.0"?><Report xmlns="${NS}"><ReportSections><ReportSection><Body><ReportItems><Textbox Name="Txt1"><Paragraphs><Paragraph><TextRuns><TextRun><Value>Hello</Value><Style /></TextRun></TextRuns><Style /></Paragraph></Paragraphs><Height>0.25in</Height></Textbox></ReportItems><Height>1in</Height></Body><Width>7.5in</Width><Page><Style /></Page></ReportSection></ReportSections></Report>`;
      const xml = wrap(rdl);
      const result = XmlTemplateGenerator.sanitizeReportXml(xml);
      expect(result).toBe(xml);
    });

    it('fix 12 is idempotent', () => {
      const rdl = `<?xml version="1.0"?><Report xmlns="${NS}"><ReportSections><ReportSection><Body><ReportItems><Textbox Name="Txt1"><Value>Hello world</Value><Height>0.25in</Height></Textbox></ReportItems><Height>1in</Height></Body><Width>7.5in</Width><Page><Style /></Page></ReportSection></ReportSections></Report>`;
      const xml = wrap(rdl);
      const once  = XmlTemplateGenerator.sanitizeReportXml(xml);
      const twice = XmlTemplateGenerator.sanitizeReportXml(once);
      expect(twice).toBe(once);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Fix 13 — ColSpan/RowSpan as direct children of TablixCell
  // ─────────────────────────────────────────────────────────────
  describe('fix 13: ColSpan/RowSpan as direct child of TablixCell', () => {
    const NS = 'http://schemas.microsoft.com/sqlserver/reporting/2016/01/reportdefinition';
    const wrap = (rdl: string) =>
      `<AxReport xmlns="Microsoft.Dynamics.AX.Metadata.V2"><Name>R</Name><DataMethods /><Designs><AxReportDesign xmlns="" i:type="AxReportPrecisionDesign"><Name>Report</Name><Text><![CDATA[${rdl}]]></Text></AxReportDesign></Designs></AxReport>`;

    const tbxInner = `<Paragraphs><Paragraph><TextRuns><TextRun><Value>X</Value><Style/></TextRun></TextRuns><Style/></Paragraph></Paragraphs><Height>0.25in</Height>`;
    const cc       = (tbx: string) => `<CellContents><Textbox Name="T1">${tbx}</Textbox></CellContents>`;

    it('moves <ColSpan> from before <CellContents> into <CellContents>', () => {
      const rdl = `<?xml version="1.0"?><Report xmlns="${NS}"><TablixCell><ColSpan>2</ColSpan>${cc(tbxInner)}</TablixCell></Report>`;
      const xml = wrap(rdl);
      const result = XmlTemplateGenerator.sanitizeReportXml(xml);
      // ColSpan must be inside CellContents now
      expect(result).toContain('<CellContents>');
      expect(result).toContain('<ColSpan>2</ColSpan>');
      // Must not be a DIRECT child of TablixCell (only whitespace allowed between them)
      expect(result).not.toMatch(/<TablixCell>\s*<ColSpan>/);
      expect(result).toMatch(/<CellContents>[\s\S]*?<ColSpan>2<\/ColSpan>[\s\S]*?<\/CellContents>/);
    });

    it('moves <ColSpan> from AFTER </CellContents> into <CellContents>', () => {
      const rdl = `<?xml version="1.0"?><Report xmlns="${NS}"><TablixCell>${cc(tbxInner)}<ColSpan>3</ColSpan></TablixCell></Report>`;
      const xml = wrap(rdl);
      const result = XmlTemplateGenerator.sanitizeReportXml(xml);
      expect(result).not.toMatch(/<\/CellContents>[\s\S]*?<ColSpan>/);
      expect(result).toMatch(/<CellContents>[\s\S]*?<ColSpan>3<\/ColSpan>[\s\S]*?<\/CellContents>/);
    });

    it('moves <RowSpan> from before <CellContents> into <CellContents>', () => {
      const rdl = `<?xml version="1.0"?><Report xmlns="${NS}"><TablixCell><RowSpan>2</RowSpan>${cc(tbxInner)}</TablixCell></Report>`;
      const xml = wrap(rdl);
      const result = XmlTemplateGenerator.sanitizeReportXml(xml);
      expect(result).toMatch(/<CellContents>[\s\S]*?<RowSpan>2<\/RowSpan>[\s\S]*?<\/CellContents>/);
      expect(result).not.toMatch(/<TablixCell>\s*<RowSpan>/);
    });

    it('moves both <ColSpan> and <RowSpan> from before <CellContents>', () => {
      const rdl = `<?xml version="1.0"?><Report xmlns="${NS}"><TablixCell><ColSpan>2</ColSpan><RowSpan>3</RowSpan>${cc(tbxInner)}</TablixCell></Report>`;
      const xml = wrap(rdl);
      const result = XmlTemplateGenerator.sanitizeReportXml(xml);
      expect(result).toMatch(/<CellContents>[\s\S]*?<ColSpan>2<\/ColSpan>[\s\S]*?<\/CellContents>/);
      expect(result).toMatch(/<CellContents>[\s\S]*?<RowSpan>3<\/RowSpan>[\s\S]*?<\/CellContents>/);
    });

    it('does not modify TablixCell where ColSpan is already inside CellContents', () => {
      const rdl = `<?xml version="1.0"?><Report xmlns="${NS}"><TablixCell><CellContents><Textbox Name="T1">${tbxInner}</Textbox><ColSpan>2</ColSpan></CellContents></TablixCell></Report>`;
      const xml = wrap(rdl);
      const result = XmlTemplateGenerator.sanitizeReportXml(xml);
      expect(result).toBe(xml);
    });

    it('fix 13 is idempotent', () => {
      const rdl = `<?xml version="1.0"?><Report xmlns="${NS}"><TablixCell><ColSpan>2</ColSpan>${cc(tbxInner)}</TablixCell></Report>`;
      const xml = wrap(rdl);
      const once  = XmlTemplateGenerator.sanitizeReportXml(xml);
      const twice = XmlTemplateGenerator.sanitizeReportXml(once);
      expect(twice).toBe(once);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Fix 14 — flat BorderStyle/BorderColor/BorderWidth in <Style>
  // ─────────────────────────────────────────────────────────────
  describe('fix 14: flat border properties as direct child of <Style>', () => {
    const NS = 'http://schemas.microsoft.com/sqlserver/reporting/2016/01/reportdefinition';
    const wrap = (rdl: string) =>
      `<AxReport xmlns="Microsoft.Dynamics.AX.Metadata.V2"><Name>R</Name><DataMethods /><Designs><AxReportDesign xmlns="" i:type="AxReportPrecisionDesign"><Name>Report</Name><Text><![CDATA[${rdl}]]></Text></AxReportDesign></Designs></AxReport>`;

    it('wraps <BorderStyle> into <Border><Style>', () => {
      const rdl = `<?xml version="1.0"?><Report xmlns="${NS}"><Style><BorderStyle>Solid</BorderStyle></Style></Report>`;
      const xml = wrap(rdl);
      const result = XmlTemplateGenerator.sanitizeReportXml(xml);
      expect(result).toContain('<Border><Style>Solid</Style></Border>');
      expect(result).not.toContain('<BorderStyle>');
    });

    it('wraps <BorderStyle>, <BorderColor>, <BorderWidth> all into one <Border>', () => {
      const rdl = `<?xml version="1.0"?><Report xmlns="${NS}"><Style><BorderStyle>Solid</BorderStyle><BorderColor>#000000</BorderColor><BorderWidth>1pt</BorderWidth></Style></Report>`;
      const xml = wrap(rdl);
      const result = XmlTemplateGenerator.sanitizeReportXml(xml);
      expect(result).toContain('<Border>');
      expect(result).toContain('<Style>Solid</Style>');
      expect(result).toContain('<Color>#000000</Color>');
      expect(result).toContain('<Width>1pt</Width>');
      expect(result).not.toContain('<BorderStyle>');
      expect(result).not.toContain('<BorderColor>');
      expect(result).not.toContain('<BorderWidth>');
    });

    it('wraps <TopBorderStyle> into <TopBorder><Style>', () => {
      const rdl = `<?xml version="1.0"?><Report xmlns="${NS}"><Style><TopBorderStyle>Solid</TopBorderStyle><TopBorderColor>Red</TopBorderColor></Style></Report>`;
      const xml = wrap(rdl);
      const result = XmlTemplateGenerator.sanitizeReportXml(xml);
      expect(result).toContain('<TopBorder>');
      expect(result).toContain('<Style>Solid</Style>');
      expect(result).toContain('<Color>Red</Color>');
      expect(result).not.toContain('<TopBorderStyle>');
    });

    it('does not modify <Style> that already uses <Border> wrapper', () => {
      const rdl = `<?xml version="1.0"?><Report xmlns="${NS}"><Style><Border><Style>Solid</Style><Color>#000</Color></Border></Style></Report>`;
      const xml = wrap(rdl);
      const result = XmlTemplateGenerator.sanitizeReportXml(xml);
      expect(result).toBe(xml);
    });

    it('fix 14 is idempotent', () => {
      const rdl = `<?xml version="1.0"?><Report xmlns="${NS}"><Style><BorderStyle>Solid</BorderStyle><BorderColor>#000</BorderColor></Style></Report>`;
      const xml = wrap(rdl);
      const once  = XmlTemplateGenerator.sanitizeReportXml(xml);
      const twice = XmlTemplateGenerator.sanitizeReportXml(once);
      expect(twice).toBe(once);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Fix 15 — absorbed TablixCells must be empty after ColSpan > 1
  // ─────────────────────────────────────────────────────────────
  describe('fix 15: absorbed TablixCells must be empty after ColSpan > 1', () => {
    const NS = 'http://schemas.microsoft.com/sqlserver/reporting/2016/01/reportdefinition';
    const wrap = (rdl: string) =>
      `<AxReport xmlns="Microsoft.Dynamics.AX.Metadata.V2"><Name>R</Name><DataMethods /><Designs><AxReportDesign xmlns="" i:type="AxReportPrecisionDesign"><Name>Report</Name><Text><![CDATA[${rdl}]]></Text></AxReportDesign></Designs></AxReport>`;

    const tbxInner = `<Paragraphs><Paragraph><TextRuns><TextRun><Value>X</Value><Style/></TextRun></TextRuns><Style/></Paragraph></Paragraphs><Height>0.25in</Height>`;
    const fullCell = (name: string) =>
      `<TablixCell><CellContents><Textbox Name="${name}">${tbxInner}</Textbox></CellContents></TablixCell>`;
    const spanCell = (name: string, span: number) =>
      `<TablixCell><CellContents><Textbox Name="${name}">${tbxInner}</Textbox><ColSpan>${span}</ColSpan></CellContents></TablixCell>`;

    it('empties the absorbed cell after ColSpan=2', () => {
      const rdl = `<?xml version="1.0"?><Report xmlns="${NS}"><TablixCells>${spanCell('H1', 2)}${fullCell('H2')}</TablixCells></Report>`;
      const xml = wrap(rdl);
      const result = XmlTemplateGenerator.sanitizeReportXml(xml);
      expect(result).toContain('<TablixCell />');
      // The ColSpan cell itself must remain intact
      expect(result).toContain('<ColSpan>2</ColSpan>');
      expect(result).toContain('Name="H1"');
      // The absorbed cell must be empty
      expect(result).not.toContain('Name="H2"');
    });

    it('empties two absorbed cells after ColSpan=3', () => {
      const rdl = `<?xml version="1.0"?><Report xmlns="${NS}"><TablixCells>${spanCell('H1', 3)}${fullCell('H2')}${fullCell('H3')}${fullCell('H4')}</TablixCells></Report>`;
      const xml = wrap(rdl);
      const result = XmlTemplateGenerator.sanitizeReportXml(xml);
      // H1 spans 3 → H2 and H3 absorbed; H4 is a real cell
      expect(result).toContain('Name="H1"');
      expect(result).not.toContain('Name="H2"');
      expect(result).not.toContain('Name="H3"');
      expect(result).toContain('Name="H4"');
    });

    it('does not modify already-empty absorbed cells', () => {
      const rdl = `<?xml version="1.0"?><Report xmlns="${NS}"><TablixCells>${spanCell('H1', 2)}<TablixCell /></TablixCells></Report>`;
      const xml = wrap(rdl);
      const result = XmlTemplateGenerator.sanitizeReportXml(xml);
      expect(result).toBe(xml);
    });

    it('does not modify cells when ColSpan=1', () => {
      const rdl = `<?xml version="1.0"?><Report xmlns="${NS}"><TablixCells>${spanCell('H1', 1)}${fullCell('H2')}</TablixCells></Report>`;
      const xml = wrap(rdl);
      const result = XmlTemplateGenerator.sanitizeReportXml(xml);
      expect(result).toBe(xml);
    });

    it('fix 15 is idempotent', () => {
      const rdl = `<?xml version="1.0"?><Report xmlns="${NS}"><TablixCells>${spanCell('H1', 2)}${fullCell('H2')}</TablixCells></Report>`;
      const xml = wrap(rdl);
      const once  = XmlTemplateGenerator.sanitizeReportXml(xml);
      const twice = XmlTemplateGenerator.sanitizeReportXml(once);
      expect(twice).toBe(once);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Fix 16 — reversed border side wrapper names (<BorderTop> → <TopBorder> etc.)
  // ─────────────────────────────────────────────────────────────
  describe('fix 16: reversed border side wrapper names', () => {
    const NS = 'http://schemas.microsoft.com/sqlserver/reporting/2016/01/reportdefinition';
    const wrap = (rdl: string) =>
      `<AxReport xmlns="Microsoft.Dynamics.AX.Metadata.V2"><Name>R</Name><DataMethods /><Designs><AxReportDesign xmlns="" i:type="AxReportPrecisionDesign"><Name>Report</Name><Text><![CDATA[${rdl}]]></Text></AxReportDesign></Designs></AxReport>`;

    it('renames <BorderTop> to <TopBorder>', () => {
      const rdl = `<?xml version="1.0"?><Report xmlns="${NS}"><Style><BorderTop><Style>Solid</Style><Width>1pt</Width></BorderTop></Style></Report>`;
      const xml = wrap(rdl);
      const result = XmlTemplateGenerator.sanitizeReportXml(xml);
      expect(result).toContain('<TopBorder>');
      expect(result).toContain('</TopBorder>');
      expect(result).not.toContain('<BorderTop>');
      expect(result).not.toContain('</BorderTop>');
    });

    it('renames <BorderBottom> to <BottomBorder>', () => {
      const rdl = `<?xml version="1.0"?><Report xmlns="${NS}"><Style><BorderBottom><Style>Solid</Style><Width>1pt</Width></BorderBottom></Style></Report>`;
      const xml = wrap(rdl);
      const result = XmlTemplateGenerator.sanitizeReportXml(xml);
      expect(result).toContain('<BottomBorder>');
      expect(result).not.toContain('<BorderBottom>');
    });

    it('renames all four sides in one pass', () => {
      const rdl = `<?xml version="1.0"?><Report xmlns="${NS}"><Style><BorderTop><Style>Solid</Style></BorderTop><BorderBottom><Style>Dashed</Style></BorderBottom><BorderLeft><Style>None</Style></BorderLeft><BorderRight><Style>Solid</Style></BorderRight></Style></Report>`;
      const xml = wrap(rdl);
      const result = XmlTemplateGenerator.sanitizeReportXml(xml);
      expect(result).toContain('<TopBorder>');    expect(result).not.toContain('<BorderTop>');
      expect(result).toContain('<BottomBorder>'); expect(result).not.toContain('<BorderBottom>');
      expect(result).toContain('<LeftBorder>');   expect(result).not.toContain('<BorderLeft>');
      expect(result).toContain('<RightBorder>');  expect(result).not.toContain('<BorderRight>');
    });

    it('does not modify already correct <TopBorder> names', () => {
      const rdl = `<?xml version="1.0"?><Report xmlns="${NS}"><Style><TopBorder><Style>Solid</Style><Width>1pt</Width></TopBorder></Style></Report>`;
      const xml = wrap(rdl);
      const result = XmlTemplateGenerator.sanitizeReportXml(xml);
      expect(result).toBe(xml);
    });

    it('fix 16 is idempotent', () => {
      const rdl = `<?xml version="1.0"?><Report xmlns="${NS}"><Style><BorderTop><Style>Solid</Style></BorderTop></Style></Report>`;
      const xml = wrap(rdl);
      const once  = XmlTemplateGenerator.sanitizeReportXml(xml);
      const twice = XmlTemplateGenerator.sanitizeReportXml(once);
      expect(twice).toBe(once);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Fix 17 — missing </Style> before </Paragraph>
  // ─────────────────────────────────────────────────────────────
  describe('fix 17: missing </Style> before </Paragraph>', () => {
    const NS = 'http://schemas.microsoft.com/sqlserver/reporting/2016/01/reportdefinition';
    const wrap = (rdl: string) =>
      `<AxReport xmlns="Microsoft.Dynamics.AX.Metadata.V2"><Name>R</Name><DataMethods /><Designs><AxReportDesign xmlns="" i:type="AxReportPrecisionDesign"><Name>Report</Name><Text><![CDATA[${rdl}]]></Text></AxReportDesign></Designs></AxReport>`;

    it('adds missing </Style> when Paragraph Style has no closing tag', () => {
      const rdl = `<?xml version="1.0"?><Report xmlns="${NS}"><Paragraph><TextRuns><TextRun><Value>X</Value><Style /></TextRun></TextRuns><Style><TextAlign>Right</TextAlign></Paragraph></Report>`;
      const xml = wrap(rdl);
      const result = XmlTemplateGenerator.sanitizeReportXml(xml);
      expect(result).toContain('<Style><TextAlign>Right</TextAlign></Style></Paragraph>');
      expect(result).not.toContain('<Style><TextAlign>Right</TextAlign></Paragraph>');
    });

    it('adds missing </Style> when Paragraph has TextRun styles plus unclosed outer Style', () => {
      // 2 TextRun <Style> (both properly closed) + 1 outer Paragraph <Style> (unclosed)
      const rdl = `<?xml version="1.0"?><Report xmlns="${NS}"><Paragraph><TextRuns><TextRun><Value>A</Value><Style><FontSize>9pt</FontSize></Style></TextRun><TextRun><Value>B</Value><Style><FontSize>9pt</FontSize></Style></TextRun></TextRuns><Style><TextAlign>Right</TextAlign></Paragraph></Report>`;
      const xml = wrap(rdl);
      const result = XmlTemplateGenerator.sanitizeReportXml(xml);
      expect(result).toContain('<Style><TextAlign>Right</TextAlign></Style></Paragraph>');
    });

    it('does not modify Paragraphs that already have balanced Style tags', () => {
      const rdl = `<?xml version="1.0"?><Report xmlns="${NS}"><Paragraph><TextRuns><TextRun><Value>X</Value><Style /></TextRun></TextRuns><Style><TextAlign>Right</TextAlign></Style></Paragraph></Report>`;
      const xml = wrap(rdl);
      const result = XmlTemplateGenerator.sanitizeReportXml(xml);
      expect(result).toBe(xml);
    });

    it('fix 17 is idempotent', () => {
      const rdl = `<?xml version="1.0"?><Report xmlns="${NS}"><Paragraph><TextRuns><TextRun><Value>X</Value><Style /></TextRun></TextRuns><Style><TextAlign>Right</TextAlign></Paragraph></Report>`;
      const xml = wrap(rdl);
      const once  = XmlTemplateGenerator.sanitizeReportXml(xml);
      const twice = XmlTemplateGenerator.sanitizeReportXml(once);
      expect(twice).toBe(once);
    });
  });
});
