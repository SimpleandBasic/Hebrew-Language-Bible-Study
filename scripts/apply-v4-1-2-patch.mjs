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

let patchSource = originalPatchSource.replace(brittleMarker, resilientMarker);
if (patchSource === originalPatchSource) throw new Error('Could not activate the resilient V4.1.2 patch marker.');

const brokenReleaseTestPatch = "  source = replaceOnce(source, `  return \\`${sentence.repeat(28)}\\${extra}\\`;`, `  return \\`${sentence.repeat(36)}\\${extra}\\`;`, 'release test transcript length');";
const fixedReleaseTestPatch = "  source = replaceOnce(source, \"  return `${sentence.repeat(28)}${extra}`;\", \"  return `${sentence.repeat(36)}${extra}`;\", 'release test transcript length');";
patchSource = patchSource.replace(brokenReleaseTestPatch, fixedReleaseTestPatch);
if (patchSource.includes(brokenReleaseTestPatch)) throw new Error('Could not repair the V4.1.2 release-test patch interpolation.');

const oldEvidenceParser = Buffer.from('ICBjb25zdCBoYXJkR2F0ZVJlc3VsdHMgPSByYXcuaGFyZF9nYXRlX3Jlc3VsdHMgfHwgcmF3LmhhcmRHYXRlUmVzdWx0cyB8fCB7fTsKICBjb25zdCBldmlkZW5jZVNwYW5zID0gYXJyYXlWYWx1ZShyYXcuZXZpZGVuY2Vfc3BhbnMgfHwgcmF3LmV2aWRlbmNlU3BhbnMpOwogIGNvbnN0IG5vcm1hbGl6ZWRUcmFuc2NyaXB0ID0gdGV4dCh0cmFuc2NyaXB0KS50b0xvd2VyQ2FzZSgpLnJlcGxhY2UoL1xccysvZywgJyAnKTsKICBjb25zdCBlbmZvcmNlRXZpZGVuY2UgPSBCb29sZWFuKG5vcm1hbGl6ZWRUcmFuc2NyaXB0KTsKICBjb25zdCB2YWxpZEV2aWRlbmNlID0gZXZpZGVuY2VTcGFucy5maWx0ZXIoKHNwYW4pID0+IHsKICAgIGNvbnN0IGRpbWVuc2lvbiA9IHRleHQoc3Bhbj8uZGltZW5zaW9uKTsKICAgIGNvbnN0IHF1b3RlID0gdGV4dChzcGFuPy5xdW90ZSkudG9Mb3dlckNhc2UoKS5yZXBsYWNlKC9cXHMrL2csICcgJyk7CiAgICBjb25zdCBleHBsYW5hdGlvbiA9IHRleHQoc3Bhbj8uZXhwbGFuYXRpb24pOwogICAgY29uc3QgcXVvdGVXb3JkcyA9IHF1b3RlLnNwbGl0KC9cXHMrLykuZmlsdGVyKEJvb2xlYW4pLmxlbmd0aDsKICAgIHJldHVybiBkaW1lbnNpb25zLmluY2x1ZGVzKGRpbWVuc2lvbikKICAgICAgJiYgcXVvdGVXb3JkcyA+PSA4CiAgICAgICYmIHF1b3RlV29yZHMgPD0gMzAKICAgICAgJiYgZXhwbGFuYXRpb24KICAgICAgJiYgbm9ybWFsaXplZFRyYW5zY3JpcHQuaW5jbHVkZXMocXVvdGUpOwogIH0pOwogIGNvbnN0IGV2aWRlbmNlQ29tcGxldGUgPSAhZW5mb3JjZUV2aWRlbmNlIHx8IGRpbWVuc2lvbnMuZXZlcnkoKGRpbWVuc2lvbikgPT4gKAogICAgdmFsaWRFdmlkZW5jZS5zb21lKChzcGFuKSA9PiB0ZXh0KHNwYW4uZGltZW5zaW9uKSA9PT0gZGltZW5zaW9uKQogICkpOwo=', 'base64').toString('utf8');
const robustEvidenceParser = Buffer.from('ICBjb25zdCBoYXJkR2F0ZVJlc3VsdHMgPSByYXcuaGFyZF9nYXRlX3Jlc3VsdHMgfHwgcmF3LmhhcmRHYXRlUmVzdWx0cyB8fCB7fTsKICBjb25zdCBldmlkZW5jZVNvdXJjZSA9IHJhdy5ldmlkZW5jZV9zcGFucyB8fCByYXcuZXZpZGVuY2VTcGFucyB8fCBbXTsKICBjb25zdCBldmlkZW5jZVNwYW5zID0gQXJyYXkuaXNBcnJheShldmlkZW5jZVNvdXJjZSkKICAgID8gZXZpZGVuY2VTb3VyY2UKICAgIDogKGV2aWRlbmNlU291cmNlICYmIHR5cGVvZiBldmlkZW5jZVNvdXJjZSA9PT0gJ29iamVjdCcKICAgICAgPyBPYmplY3QuZW50cmllcyhldmlkZW5jZVNvdXJjZSkubWFwKChbZGltZW5zaW9uLCB2YWx1ZV0pID0+ICgKICAgICAgICB0eXBlb2YgdmFsdWUgPT09ICdzdHJpbmcnID8geyBkaW1lbnNpb24sIHF1b3RlOiB2YWx1ZSwgZXhwbGFuYXRpb246ICdFdmFsdWF0b3IgZXZpZGVuY2UuJyB9IDogeyBkaW1lbnNpb24sIC4uLnZhbHVlIH0KICAgICAgKSkKICAgICAgOiBbXSk7CiAgY29uc3QgY2Fub25pY2FsRXZpZGVuY2VUZXh0ID0gKHZhbHVlKSA9PiB0ZXh0KHZhbHVlKQogICAgLnRvTG93ZXJDYXNlKCkKICAgIC5yZXBsYWNlKC9bXmEtejAtOVxcdTA1OTAtXFx1MDVmZl0rL2csICcgJykKICAgIC5yZXBsYWNlKC9cXHMrL2csICcgJykKICAgIC50cmltKCk7CiAgY29uc3QgY2Fub25pY2FsRGltZW5zaW9uID0gKHZhbHVlKSA9PiB0ZXh0KHZhbHVlKQogICAgLnRvTG93ZXJDYXNlKCkKICAgIC5yZXBsYWNlKC9bXmEtejAtOV0rL2csICdfJykKICAgIC5yZXBsYWNlKC9eXyt8XyskL2csICcnKTsKICBjb25zdCBub3JtYWxpemVkVHJhbnNjcmlwdCA9IGNhbm9uaWNhbEV2aWRlbmNlVGV4dCh0cmFuc2NyaXB0KTsKICBjb25zdCBlbmZvcmNlRXZpZGVuY2UgPSBCb29sZWFuKG5vcm1hbGl6ZWRUcmFuc2NyaXB0KTsKICBjb25zdCB2YWxpZEV2aWRlbmNlID0gZXZpZGVuY2VTcGFucy5tYXAoKHNwYW4pID0+IHsKICAgIGNvbnN0IGRpbWVuc2lvbiA9IGNhbm9uaWNhbERpbWVuc2lvbihzcGFuPy5kaW1lbnNpb24gfHwgc3Bhbj8uY3JpdGVyaW9uIHx8IHNwYW4/LmNhdGVnb3J5KTsKICAgIGNvbnN0IHJhd1F1b3RlID0gdGV4dChzcGFuPy5xdW90ZSB8fCBzcGFuPy5leGNlcnB0IHx8IHNwYW4/LmV2aWRlbmNlKTsKICAgIGNvbnN0IHF1b3RlID0gY2Fub25pY2FsRXZpZGVuY2VUZXh0KHJhd1F1b3RlKTsKICAgIGNvbnN0IGV4cGxhbmF0aW9uID0gdGV4dChzcGFuPy5leHBsYW5hdGlvbiB8fCBzcGFuPy5yZWFzb24gfHwgc3Bhbj8uYW5hbHlzaXMpOwogICAgY29uc3QgcXVvdGVXb3JkcyA9IHF1b3RlLnNwbGl0KC9cXHMrLykuZmlsdGVyKEJvb2xlYW4pLmxlbmd0aDsKICAgIGlmICghZGltZW5zaW9ucy5pbmNsdWRlcyhkaW1lbnNpb24pCiAgICAgIHx8IHF1b3RlV29yZHMgPCA4CiAgICAgIHx8IHF1b3RlV29yZHMgPiA0MAogICAgICB8fCAhZXhwbGFuYXRpb24KICAgICAgfHwgIW5vcm1hbGl6ZWRUcmFuc2NyaXB0LmluY2x1ZGVzKHF1b3RlKSkgcmV0dXJuIG51bGw7CiAgICByZXR1cm4geyAuLi5zcGFuLCBkaW1lbnNpb24sIHF1b3RlOiByYXdRdW90ZSwgZXhwbGFuYXRpb24gfTsKICB9KS5maWx0ZXIoQm9vbGVhbik7CiAgY29uc3QgZXZpZGVuY2VDb21wbGV0ZSA9ICFlbmZvcmNlRXZpZGVuY2UgfHwgZGltZW5zaW9ucy5ldmVyeSgoZGltZW5zaW9uKSA9PiAoCiAgICB2YWxpZEV2aWRlbmNlLnNvbWUoKHNwYW4pID0+IHNwYW4uZGltZW5zaW9uID09PSBkaW1lbnNpb24pCiAgKSk7Cg==', 'base64').toString('utf8');
patchSource = patchSource.replace(oldEvidenceParser, robustEvidenceParser);
if (patchSource.includes(oldEvidenceParser)) throw new Error('Could not upgrade the V4.1.2 evidence parser.');

const runtimePath = join(scriptDirectory, '.apply-v4-1-2-runtime.mjs');
writeFileSync(runtimePath, patchSource, 'utf8');

try {
  await import(`${pathToFileURL(runtimePath).href}?run=${Date.now()}`);
} finally {
  rmSync(runtimePath, { force: true });
}
