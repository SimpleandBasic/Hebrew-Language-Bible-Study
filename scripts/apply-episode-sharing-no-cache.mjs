import { readFile, writeFile } from 'node:fs/promises';

const path = 'api/hebrew-mcp.js';
let source = await readFile(path, 'utf8');
const cacheable = "  setCommonSecurityHeaders(res, { cache: true });";
const noStore = "  setCommonSecurityHeaders(res);";

if (source.includes(cacheable)) {
  source = source.replace(cacheable, noStore);
  await writeFile(path, source);
  console.log('Disabled shared-page caching for immediate revocation.');
} else if (source.includes('async function handleEpisodePage') && source.includes(noStore)) {
  console.log('Shared-page no-store protection already applied.');
} else {
  throw new Error('Shared episode page cache anchor was not found.');
}
