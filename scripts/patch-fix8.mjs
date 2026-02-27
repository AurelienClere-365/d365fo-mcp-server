// Replace fix 8 in sanitizeReportXml to handle both 2008 and 2010 RDL namespaces
import { readFileSync, writeFileSync } from 'fs';

const f = 'c:/Users/Admin7e00859cee/source/repos/d365fo-mcp-server/src/tools/createD365File.ts';
let src = readFileSync(f, 'utf8');
const eol = src.includes('\r\n') ? '\r\n' : '\n';

const OLD = `    // 8. Fix embedded RDL: move <PageHeader>/<PageFooter> inside <Page> when they
    //    appear as direct children of <Report> — SSRS schema violation that causes
    //    "Deserialization failed: invalid child element 'PageHeader'" in VS Designer.
    xml = xml.replace(/(<Text><!\\[CDATA\\[)([\\s\\S]*?)(\\]\\]><\\/Text>)/, (_whole, open, rdl, close) => {
      if (!rdl.includes('<PageHeader') && !rdl.includes('<PageFooter')) return _whole;
      // Already wrapped inside a <Page> element — nothing to do
      if (rdl.match(/<Page[\\s\\S]*?<\\/Page>/)) return _whole;
      let fixedRdl = rdl;
      let pageContent = '';
      const phMatch = fixedRdl.match(/<PageHeader[\\s\\S]*?<\\/PageHeader>/);
      if (phMatch) { pageContent += phMatch[0]; fixedRdl = fixedRdl.replace(phMatch[0], ''); }
      const pfMatch = fixedRdl.match(/<PageFooter[\\s\\S]*?<\\/PageFooter>/);
      if (pfMatch) { pageContent += (pageContent ? '\\n' : '') + pfMatch[0]; fixedRdl = fixedRdl.replace(pfMatch[0], ''); }
      if (!pageContent) return _whole;
      const pageEl = '<Page>\\n' + pageContent.trim() + '\\n</Page>';
      fixedRdl = fixedRdl.includes('</Body>')
        ? fixedRdl.replace('</Body>', '</Body>\\n' + pageEl)
        : fixedRdl.replace('</Report>', pageEl + '\\n</Report>');
      console.error('[sanitizeReportXml] Moved <PageHeader>/<PageFooter> inside <Page> in embedded RDL');
      return open + fixedRdl + close;
    });`;

const NEW = `    // 8. Fix embedded RDL structural issues based on the SSRS namespace version:
    //    2008/01 — <PageHeader>/<PageFooter> must be inside <Page> (direct child of <Report>).
    //    2010/01 — <Body> and <Page> must NOT be direct children of <Report>; they must be
    //              wrapped in <ReportSections><ReportSection>...</ReportSection></ReportSections>.
    //              Placing <Page> directly under <Report> (as the old fix did) causes:
    //              "Deserialization failed: invalid child element 'Page'" in VS Designer.
    xml = xml.replace(/(<Text><!\\[CDATA\\[)([\\s\\S]*?)(\\]\\]><\\/Text>)/, (_whole, open, rdl, close) => {
      const is2010 = rdl.includes('reporting/2010/01/reportdefinition');
      const is2008 = rdl.includes('reporting/2008/01/reportdefinition');
      let fixedRdl = rdl;
      let changed = false;

      if (is2010 && !rdl.includes('<ReportSections>')) {
        // 2010 schema: collect any stray Body/Page/PageHeader/PageFooter that are direct
        // children of <Report>, then wrap them in ReportSections/ReportSection.
        let pageEl = '';
        const existingPageMatch = fixedRdl.match(/<Page(?:\\s[^>]*)?>([\\s\\S]*?)<\\/Page>/);
        if (existingPageMatch) {
          pageEl = existingPageMatch[0];
          fixedRdl = fixedRdl.replace(existingPageMatch[0], '');
        } else {
          let pageInner = '';
          const phMatch = fixedRdl.match(/<PageHeader[\\s\\S]*?<\\/PageHeader>/);
          if (phMatch) { pageInner += phMatch[0]; fixedRdl = fixedRdl.replace(phMatch[0], ''); }
          const pfMatch = fixedRdl.match(/<PageFooter[\\s\\S]*?<\\/PageFooter>/);
          if (pfMatch) { pageInner += (pageInner ? '\\n' : '') + pfMatch[0]; fixedRdl = fixedRdl.replace(pfMatch[0], ''); }
          if (pageInner) pageEl = '<Page>\\n' + pageInner.trim() + '\\n</Page>';
        }
        const bodyMatch = fixedRdl.match(/<Body[\\s\\S]*?<\\/Body>/);
        let sectionContent = '';
        if (bodyMatch) { sectionContent += bodyMatch[0]; fixedRdl = fixedRdl.replace(bodyMatch[0], ''); }
        if (pageEl) sectionContent += (sectionContent ? '\\n' : '') + pageEl;
        if (sectionContent) {
          const reportSections =
            '<ReportSections>\\n<ReportSection>\\n' + sectionContent.trim() + '\\n</ReportSection>\\n</ReportSections>';
          fixedRdl = fixedRdl.includes('</Report>')
            ? fixedRdl.replace('</Report>', reportSections + '\\n</Report>')
            : fixedRdl + '\\n' + reportSections;
          changed = true;
          console.error('[sanitizeReportXml] Wrapped Body+Page in <ReportSections>/<ReportSection> for 2010 RDL');
        }

      } else if (is2008 && !rdl.match(/<Page[\\s\\S]*?<\\/Page>/) && (rdl.includes('<PageHeader') || rdl.includes('<PageFooter'))) {
        // 2008 schema: <PageHeader>/<PageFooter> as direct children of <Report> — move inside <Page>.
        let pageContent = '';
        const phMatch = fixedRdl.match(/<PageHeader[\\s\\S]*?<\\/PageHeader>/);
        if (phMatch) { pageContent += phMatch[0]; fixedRdl = fixedRdl.replace(phMatch[0], ''); }
        const pfMatch = fixedRdl.match(/<PageFooter[\\s\\S]*?<\\/PageFooter>/);
        if (pfMatch) { pageContent += (pageContent ? '\\n' : '') + pfMatch[0]; fixedRdl = fixedRdl.replace(pfMatch[0], ''); }
        if (pageContent) {
          const pageEl = '<Page>\\n' + pageContent.trim() + '\\n</Page>';
          fixedRdl = fixedRdl.includes('</Body>')
            ? fixedRdl.replace('</Body>', '</Body>\\n' + pageEl)
            : fixedRdl.replace('</Report>', pageEl + '\\n</Report>');
          changed = true;
          console.error('[sanitizeReportXml] Moved <PageHeader>/<PageFooter> inside <Page> in 2008 RDL');
        }
      }

      if (!changed) return _whole;
      return open + fixedRdl + close;
    });`;

// Normalize to match file EOL
const oldNorm = OLD.replace(/\r?\n/g, eol);
const newNorm = NEW.replace(/\r?\n/g, eol);

if (!src.includes(oldNorm)) {
  // Try LF fallback
  const oldLf = OLD.replace(/\r?\n/g, '\n');
  if (!src.includes(oldLf)) {
    console.error('OLD string not found in file');
    process.exit(1);
  }
}

const patched = src.replace(oldNorm, newNorm);
if (patched === src) {
  console.error('NO CHANGE — replacement did not match');
  process.exit(1);
}
writeFileSync(f, patched, 'utf8');
console.log('Fix 8 replaced OK. Size:', patched.length);
