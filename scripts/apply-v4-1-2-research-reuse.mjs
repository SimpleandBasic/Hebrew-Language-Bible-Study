import { readFileSync, writeFileSync } from 'node:fs';

function replaceOnce(source, search, replacement, label) {
  if (source.includes(replacement)) return source;
  if (!source.includes(search)) throw new Error(`V4.1.2 research-reuse marker missing: ${label}`);
  return source.replace(search, replacement);
}

function patchGenerator() {
  const path = 'src/v4/episode-generator.js';
  const original = readFileSync(path, 'utf8');
  const updated = replaceOnce(
    original,
    "export async function generateV4Episode(reference, canonical, env = process.env) {\n  const research = await createResearch(reference, canonical, env);",
    "export async function generateV4Episode(reference, canonical, env = process.env, reusableResearch = null) {\n  const research = reusableResearch || await createResearch(reference, canonical, env);",
    'optional reusable research input',
  );
  if (updated !== original) writeFileSync(path, updated, 'utf8');
}

function patchGenerateRoute() {
  const path = 'api/generate-next-verse.js';
  let source = readFileSync(path, 'utf8');
  const helperMarker = 'async function loadReusableResearch(client, reference) {';
  if (!source.includes(helperMarker)) {
    const helper = [
      'async function loadReusableResearch(client, reference) {',
      "  const { data: episode, error: episodeError } = await client.from('hebrew_episodes')",
      "    .select('id')",
      "    .eq('reference', reference)",
      '    .maybeSingle();',
      '  if (episodeError) throw episodeError;',
      '  if (!episode?.id) return null;',
      '',
      "  const { data: revision, error: revisionError } = await client.from('hebrew_episode_revisions')",
      "    .select('research_dossier_id,revision_number')",
      "    .eq('episode_id', episode.id)",
      "    .not('research_dossier_id', 'is', null)",
      "    .order('revision_number', { ascending: false })",
      '    .limit(1)',
      '    .maybeSingle();',
      '  if (revisionError) throw revisionError;',
      '  if (!revision?.research_dossier_id) return null;',
      '',
      "  const { data: dossier, error: dossierError } = await client.from('hebrew_research_dossiers')",
      "    .select('*')",
      "    .eq('id', revision.research_dossier_id)",
      "    .eq('status', 'verified')",
      '    .maybeSingle();',
      '  if (dossierError) throw dossierError;',
      '  if (!dossier) return null;',
      '',
      '  const literaryContext = dossier.literary_context || {};',
      '  const narrativeMap = literaryContext.narrative_map || {};',
      '  if (!narrativeMap.controlling_truth || !Array.isArray(narrativeMap.curiosity_turns)) return null;',
      '  return {',
      '    dossier: {',
      '      verse_text: dossier.verse_text || {},',
      '      literary_context: literaryContext,',
      '      hebrew_observations: dossier.hebrew_observations || [],',
      '      cross_references: dossier.cross_references || [],',
      '      historical_background: dossier.historical_background || [],',
      '      archaeology: dossier.archaeology || [],',
      '      geography: dossier.geography || [],',
      '      biblical_theology: dossier.biblical_theology || [],',
      '      christological_pathways: dossier.christological_pathways || [],',
      '      unsupported_connections: dossier.unsupported_connections || [],',
      '      sources: dossier.sources || [],',
      '      claims: dossier.claims || [],',
      '    },',
      '    narrativeMap,',
      "    model: `reused:${dossier.dossier_version || 'verified-research'}` ,",
      '  };',
      '}',
      '',
    ].join('\n');
    const handlerMarker = 'export default async function handler(req, res) {';
    if (!source.includes(handlerMarker)) throw new Error('V4.1.2 handler marker missing for research reuse.');
    source = source.replace(handlerMarker, `${helper}${handlerMarker}`);
  }

  source = replaceOnce(
    source,
    '    const generated = await generateV4Episode(target.reference, canonical, process.env);',
    [
      '    const reusableResearch = forceRegenerate',
      '      ? await loadReusableResearch(client, target.reference)',
      '      : null;',
      '    const generated = await generateV4Episode(target.reference, canonical, process.env, reusableResearch);',
    ].join('\n'),
    'forced regeneration research reuse',
  );
  writeFileSync(path, source, 'utf8');
}

patchGenerator();
patchGenerateRoute();
console.log('Applied V4.1.2 verified research reuse for sermon repair jobs.');
