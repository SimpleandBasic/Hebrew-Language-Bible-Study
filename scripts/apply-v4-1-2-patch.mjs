import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const payloadDirectory = join(scriptDirectory, 'v4-1-2-patch');
const encodedPayload = Array.from({ length: 7 }, (_, index) => {
  const partName = `part-${String(index + 1).padStart(2, '0')}.b64`;
  return readFileSync(join(payloadDirectory, partName), 'utf8').trim();
}).join('');

const originalPatchSource = Buffer.from(encodedPayload, 'base64').toString('utf8');
const brittleMarker = "  if (!source.includes(search)) throw new Error(`V4.1.2 patch marker missing: ${label}`);";
const resilientMarker = [
  "  if (!source.includes(search)) {",
  "    if (label === 'evidence-backed evaluator gates') {",
  "      const fallback = /Hard gates:\\r?\\n[\\s\\S]*?Return JSON only with scores, hard_gate_results, evidence_spans, strengths, rewrite_directives, and verdict\\./;",
  "      if (fallback.test(source)) return source.replace(fallback, replacement);",
  "    }",
  "    throw new Error(`V4.1.2 patch marker missing: ${label}`);",
  "  }",
].join('\n');
const patchSource = originalPatchSource.replace(brittleMarker, resilientMarker);
if (patchSource === originalPatchSource) throw new Error('Could not activate the resilient V4.1.2 patch marker.');

const runtimePath = join(scriptDirectory, '.apply-v4-1-2-runtime.mjs');
writeFileSync(runtimePath, patchSource, 'utf8');

try {
  await import(`${pathToFileURL(runtimePath).href}?run=${Date.now()}`);
} finally {
  rmSync(runtimePath, { force: true });
}
