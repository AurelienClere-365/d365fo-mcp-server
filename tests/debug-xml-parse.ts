import { parseStringPromise } from 'xml2js';

const testXml = `<?xml version="1.0" encoding="utf-8"?>
<AxForm xmlns:i="http://www.w3.org/2001/XMLSchema-instance">
\t<Name>TestForm</Name>
</AxForm>`;

async function test() {
  const result = await parseStringPromise(testXml);
  console.log('Parsed XML:', JSON.stringify(result, null, 2));
  console.log('Keys:', Object.keys(result));
  console.log('AxForm?', result.AxForm);
}

test().catch(console.error);
