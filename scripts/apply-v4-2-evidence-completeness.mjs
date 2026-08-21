import { readFileSync, writeFileSync } from 'node:fs';

const path = 'src/v4/episode-generator.js';
let source = readFileSync(path, 'utf8');

const oldGate = '  if (initial.evidenceSpans.length >= 10) return raw;';
const newGate = `  const requiredEvidenceDimensions = [
    'conversational_flow', 'storytelling', 'curiosity', 'hebrew_integration',
    'biblical_faithfulness', 'christ_centeredness', 'emotional_movement',
    'educational_value', 'spoken_naturalness', 'listener_engagement',
  ];
  const coveredEvidenceDimensions = new Set(
    initial.evidenceSpans.map((span) => String(span?.dimension || '').trim().toLowerCase()),
  );
  if (requiredEvidenceDimensions.every((dimension) => coveredEvidenceDimensions.has(dimension))) return raw;`;

if (!source.includes(newGate)) {
  if (!source.includes(oldGate)) {
    throw new Error('V4.2 evidence patch could not find the evidence-completeness shortcut.');
  }
  source = source.replace(oldGate, newGate);
}

writeFileSync(path, source, 'utf8');
console.log('V4.2 evaluator now requires evidence coverage for all ten dimensions before skipping extraction.');
