import { readFileSync, writeFileSync } from 'node:fs';

function patchGenerator() {
  const path = 'src/v4/episode-generator.js';
  let source = readFileSync(path, 'utf8');

  if (!source.includes('function validateLesson(reference, lesson)')) {
    if (!source.includes('function validateLesson(lesson)')) {
      throw new Error('Genesis boundary patch could not find validateLesson signature.');
    }
    source = source.replace('function validateLesson(lesson)', 'function validateLesson(reference, lesson)');
  }

  const oldSeriesGate = `  if (!lesson.series_connection?.previous || !lesson.series_connection?.next) {
    throw new Error('V4 sermon must connect the previous and next verses.');
  }`;
  const newSeriesGate = `  const isGenesisOpening = /^Genesis\\s+1:1$/i.test(cleanText(reference));
  const hasRequiredPrevious = isGenesisOpening || Boolean(cleanText(lesson.series_connection?.previous));
  const hasRequiredNext = Boolean(cleanText(lesson.series_connection?.next));
  if (!hasRequiredPrevious || !hasRequiredNext) {
    throw new Error(isGenesisOpening
      ? 'V4 Genesis 1:1 sermon must connect forward to the next verse.'
      : 'V4 sermon must connect the previous and next verses.');
  }`;
  if (!source.includes(newSeriesGate)) {
    if (!source.includes(oldSeriesGate)) {
      throw new Error('Genesis boundary patch could not find the series-connection gate.');
    }
    source = source.replace(oldSeriesGate, newSeriesGate);
  }

  if (!source.includes('const wordCount = validateLesson(reference, lesson);')) {
    if (!source.includes('const wordCount = validateLesson(lesson);')) {
      throw new Error('Genesis boundary patch could not find validateLesson call.');
    }
    source = source.replace(
      'const wordCount = validateLesson(lesson);',
      'const wordCount = validateLesson(reference, lesson);',
    );
  }

  writeFileSync(path, source, 'utf8');
}

function patchOrchestratorMetadata() {
  const path = 'api/run-generation-job.js';
  let source = readFileSync(path, 'utf8');
  source = source.replaceAll("pipeline_version: 'sermon-experience-v4.1.2'", "pipeline_version: 'sermon-experience-v4.2.0'");
  writeFileSync(path, source, 'utf8');
}

patchGenerator();
patchOrchestratorMetadata();
console.log('Genesis 1:1 boundary and V4.2 orchestration metadata patch applied.');
