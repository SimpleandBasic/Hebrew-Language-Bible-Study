export const chatTools = [
  { name: 'get_hebrew_app_status', description: 'Get Hebrew app database status.', inputSchema: { type: 'object', properties: { limit: { type: 'number' } } } },
  { name: 'draft_hebrew_lesson_bundle', description: 'Create or update an unpublished Hebrew lesson draft.', inputSchema: { type: 'object', required: ['title'], properties: { title: { type: 'string' }, slug: { type: 'string' }, book: { type: 'string' }, chapter: { type: 'number' }, verse_start: { type: 'number' }, verse_end: { type: 'number' }, lesson_json: {}, flashcards_json: {}, verses: { type: 'array' } } } },
  { name: 'preview_hebrew_lesson_bundle', description: 'Preview a Hebrew lesson bundle.', inputSchema: { type: 'object', properties: { lesson_id: { type: 'string' }, lessonId: { type: 'string' }, slug: { type: 'string' } } } },
  { name: 'publish_hebrew_lesson_bundle', description: 'Add an approved Hebrew lesson bundle to the study tables.', inputSchema: { type: 'object', properties: { lesson_id: { type: 'string' }, lessonId: { type: 'string' }, slug: { type: 'string' } } } },
  { name: 'list_pending_hebrew_lessons', description: 'List unpublished Hebrew lesson drafts.', inputSchema: { type: 'object', properties: { limit: { type: 'number' } } } },
];
