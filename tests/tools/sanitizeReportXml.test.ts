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

    // 2008: PageHeader as direct child of Report (wrong — must be inside Page)
    const RDL_2008_WRONG = `<?xml version="1.0"?><Report xmlns="${NS_2008}"><PageHeader><Height>1cm</Height></PageHeader><Body><Height>10cm</Height></Body></Report>`;
    // 2008: PageHeader already inside Page (correct for 2008)
    const RDL_2008_CORRECT = `<?xml version="1.0"?><Report xmlns="${NS_2008}"><DataSources /><Body><Height>10cm</Height></Body><Page><PageHeader><Height>1cm</Height></PageHeader></Page></Report>`;
    // 2010: Body and Page as direct children of Report (wrong — must be inside ReportSections)
    const RDL_2010_WRONG_PAGE = `<?xml version="1.0"?><Report xmlns="${NS_2010}"><DataSources /><Body><Height>10cm</Height></Body><Page><PageHeader><Height>1cm</Height></PageHeader></Page></Report>`;
    // 2010: PageHeader as stray direct child (must end up inside ReportSections/ReportSection/Page)
    const RDL_2010_WRONG_PH = `<?xml version="1.0"?><Report xmlns="${NS_2010}"><PageHeader><Height>1cm</Height></PageHeader><Body><Height>10cm</Height></Body></Report>`;
    // 2010: already correct — ReportSections present
    const RDL_2010_CORRECT = `<?xml version="1.0"?><Report xmlns="${NS_2010}"><DataSources /><ReportSections><ReportSection><Body><Height>10cm</Height></Body><Page><PageHeader><Height>1cm</Height></PageHeader></Page></ReportSection></ReportSections></Report>`;

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

    it('should not modify XML when no <Text><![CDATA[ present', () => {
      const result = XmlTemplateGenerator.sanitizeReportXml(CORRECT_XML);
      expect(result).toBe(CORRECT_XML);
    });
  });
});
