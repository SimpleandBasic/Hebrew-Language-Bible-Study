import { getSupabaseAdminClient } from '../supabase-client.js';

const text = (value) => (typeof value === 'string' ? value.trim() : '');
const objectValue = (value) => (value && typeof value === 'object' && !Array.isArray(value) ? value : {});
const arrayValue = (value) => (Array.isArray(value) ? value : []);

const HEBREW_TABLES = ['hebrew_verses', 'hebrew_words', 'hebrew_verse_words', 'hebrew_lessons'];

function cleanLimit(value, fallback = 25) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.min(parsed, 100));
}

function positiveInt(value, fallback = null) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseJsonInput(value, fallback, label) {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      throw new Error(`${label} must be valid JSON when supplied as a string.`);
    }
  }
  return value;
}

function slugify(value) {
  return text(value)
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
}

function normalizeBook(value) {
  const cleaned = text(value);
  if (!cleaned) return 'Genesis';
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

function referenceRange({ book, chapter, verseStart, verseEnd }) {
  if (!book || !chapter || !verseStart) return '';
  if (!verseEnd || verseEnd === verseStart) return `${book} ${chapter}:${verseStart}`;
  return `${book} ${chapter}:${verseStart}-${verseEnd}`;
}

function themeTags(value) {
  if (Array.isArray(value)) return value.map(text).filter(Boolean);
  if (typeof value === 'string') return value.split(',').map(text).filter(Boolean);
  return [];
}

function stableSourceKey({ book, chapter, verseNumber, position, hebrew }) {
  const base = slugify(`${book}-${chapter}-${verseNumber}-${String(position).padStart(2, '0')}`);
  const hebrewPart = Buffer.from(text(hebrew)).toString('base64url').slice(0, 24);
  return hebrewPart ? `${base}-${hebrewPart}` : base;
}

function normalizeWord(rawWord = {}, index = 0, verseContext = {}) {
  const word = objectValue(rawWord);
  const wordPosition = positiveInt(word.word_position ?? word.wordPosition ?? word.position, index + 1);
  const hebrewText = text(word.hebrew_text ?? word.hebrewText ?? word.hebrew);

  return {
    sourceKey: text(word.source_key ?? word.sourceKey) || stableSourceKey({
      book: verseContext.book,
      chapter: verseContext.chapter,
      verseNumber: verseContext.verseNumber,
      position: wordPosition,
      hebrew: hebrewText,
    }),
    wordPosition,
    hebrewText,
    transliteration: text(word.transliteration),
    pronunciation: text(word.pronunciation),
    englishGloss: text(word.english_gloss ?? word.englishGloss ?? word.gloss ?? word.meaning),
    root: text(word.root),
    rootTransliteration: text(word.root_transliteration ?? word.rootTransliteration),
    rootMeaning: text(word.root_meaning ?? word.rootMeaning),
    strongsNumber: text(word.strongs_number ?? word.strongsNumber ?? word.strongs),
    wordForm: text(word.word_form ?? word.wordForm ?? word.form),
    grammarNote: text(word.grammar_note ?? word.grammarNote ?? word.grammar),
    lexiconNote: text(word.lexicon_note ?? word.lexiconNote),
    contextNote: text(word.context_note ?? word.contextNote ?? word.context),
    studyPrompt: text(word.study_prompt ?? word.studyPrompt ?? word.prompt),
    themeTags: themeTags(word.theme_tags ?? word.themeTags ?? word.tags),
  };
}

function normalizeVerse(rawVerse = {}, index = 0, defaults = {}) {
  const verse = objectValue(rawVerse);
  const book = normalizeBook(verse.book ?? defaults.book);
  const chapter = positiveInt(verse.chapter ?? defaults.chapter, defaults.chapter || 1);
  const verseNumber = positiveInt(verse.verse_number ?? verse.verseNumber ?? verse.number, defaults.verseStart ? defaults.verseStart + index : index + 1);
  const reference = text(verse.reference) || `${book} ${chapter}:${verseNumber}`;
  const words = arrayValue(verse.words).map((word, wordIndex) => normalizeWord(word, wordIndex, { book, chapter, verseNumber }));

  return {
    book,
    chapter,
    verseNumber,
    reference,
    hebrewText: text(verse.hebrew_text ?? verse.hebrewText ?? verse.hebrew) || words.map((word) => word.hebrewText).filter(Boolean).join(' '),
    englishText: text(verse.english_text ?? verse.englishText ?? verse.english ?? verse.translation),
    contextNote: text(verse.context_note ?? verse.contextNote ?? verse.context ?? verse.summary),
    words,
  };
}

function normalizeBundle(input = {}) {
  const lesson = objectValue(parseJsonInput(input.lesson_json ?? input.lessonJson ?? input.lesson ?? {}, {}, 'lesson_json'));
  const book = normalizeBook(input.book ?? lesson.book);
  const chapter = positiveInt(input.chapter ?? lesson.chapter, 1);
  const verseStart = positiveInt(input.verse_start ?? input.verseStart ?? lesson.verse_start ?? lesson.verseStart, 1);
  const verseEnd = positiveInt(input.verse_end ?? input.verseEnd ?? lesson.verse_end ?? lesson.verseEnd, verseStart);
  const title = text(input.title ?? lesson.title) || `${referenceRange({ book, chapter, verseStart, verseEnd })} Hebrew Lesson`;
  const slug = slugify(input.slug ?? lesson.slug ?? `${book}-${chapter}-${verseStart}-${verseEnd}-${title}`);
  const rawVerses = arrayValue(input.verses ?? lesson.verses);
  const verses = rawVerses.map((verse, index) => normalizeVerse(verse, index, { book, chapter, verseStart }));
  const rawCards = parseJsonInput(input.flashcards_json ?? input.flashcardsJson ?? input.flashcards ?? lesson.flashcards ?? [], [], 'flashcards_json');
  const flashcards = arrayValue(rawCards).length ? arrayValue(rawCards) : verses.flatMap((verse) => verse.words.map((word) => ({
    front: word.hebrewText,
    back: `${word.hebrewText} (${word.transliteration}) means ${word.englishGloss}`,
    lessonReference: verse.reference,
    memoryClue: word.rootMeaning || word.studyPrompt || '',
  })));

  return {
    slug,
    title,
    description: text(input.description ?? lesson.description ?? lesson.summary),
    lessonOrder: positiveInt(input.lesson_order ?? input.lessonOrder ?? lesson.lessonOrder, verseStart) || 0,
    content: {
      schemaVersion: 'hebrew-mcp-v1',
      book,
      chapter,
      verseStart,
      verseEnd,
      referenceRange: referenceRange({ book, chapter, verseStart, verseEnd }),
      sourceNote: text(input.source_note ?? input.sourceNote ?? lesson.sourceNote),
      lesson,
      verses,
      flashcards,
      auditTrail: [{ action: 'drafted', at: new Date().toISOString(), actor: 'hebrew-mcp' }],
    },
  };
}

async function countTable(supabase, table) {
  const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true });
  if (error) return { table, count: null, error: error.message };
  return { table, count: count ?? 0, error: null };
}

async function loadLesson(supabase, input = {}) {
  const id = text(input.lesson_id ?? input.lessonId ?? input.id);
  const slug = text(input.slug);
  if (!id && !slug) throw new Error('lesson_id or slug is required.');

  let query = supabase.from('hebrew_lessons').select('id,slug,title,description,lesson_order,content,is_published,created_at,updated_at').limit(1);
  query = id ? query.eq('id', id) : query.eq('slug', slug);

  const { data, error } = await query.maybeSingle();
  if (error) throw new Error(`Could not load Hebrew lesson: ${error.message}`);
  if (!data) throw new Error('Hebrew lesson was not found.');
  return data;
}

function previewFromLesson(lesson) {
  const content = objectValue(lesson.content);
  const verses = arrayValue(content.verses);
  const flashcards = arrayValue(content.flashcards);
  const warnings = [];

  if (!verses.length) warnings.push('No verses were found in the lesson content.');
  for (const verse of verses) {
    if (!text(verse.reference)) warnings.push('A verse is missing its reference.');
    if (!text(verse.hebrewText)) warnings.push(`${verse.reference || 'A verse'} is missing Hebrew text.`);
    if (!arrayValue(verse.words).length) warnings.push(`${verse.reference || 'A verse'} has no word breakdown.`);
    for (const word of arrayValue(verse.words)) {
      if (!text(word.strongsNumber)) warnings.push(`${verse.reference || 'A verse'} / ${word.hebrewText || 'unknown word'} is missing Strong's number.`);
    }
  }

  return {
    referenceRange: content.referenceRange || '',
    verseCount: verses.length,
    wordCount: verses.reduce((sum, verse) => sum + arrayValue(verse.words).length, 0),
    flashcardCount: flashcards.length,
    verses: verses.map((verse) => ({
      reference: verse.reference,
      hebrewText: verse.hebrewText,
      englishText: verse.englishText,
      wordCount: arrayValue(verse.words).length,
    })),
    warnings: [...new Set(warnings)],
  };
}

async function upsertVerse(supabase, verse) {
  const { data: existing, error: lookupError } = await supabase
    .from('hebrew_verses')
    .select('id')
    .eq('book', verse.book)
    .eq('chapter', verse.chapter)
    .eq('verse_number', verse.verseNumber)
    .limit(1)
    .maybeSingle();

  if (lookupError) throw new Error(`Could not check ${verse.reference}: ${lookupError.message}`);

  const row = {
    book: verse.book,
    chapter: verse.chapter,
    verse_number: verse.verseNumber,
    reference: verse.reference,
    hebrew_text: verse.hebrewText || '',
    english_text: verse.englishText || '',
    context_note: verse.contextNote || '',
    updated_at: new Date().toISOString(),
  };

  if (existing?.id) {
    const { data, error } = await supabase.from('hebrew_verses').update(row).eq('id', existing.id).select('id,reference').single();
    if (error) throw new Error(`Could not update ${verse.reference}: ${error.message}`);
    return { ...data, action: 'updated' };
  }

  const { data, error } = await supabase.from('hebrew_verses').insert(row).select('id,reference').single();
  if (error) throw new Error(`Could not insert ${verse.reference}: ${error.message}`);
  return { ...data, action: 'created' };
}

function mapWordRow(word) {
  return {
    source_key: word.sourceKey,
    hebrew_text: word.hebrewText || '',
    transliteration: word.transliteration || '',
    pronunciation: word.pronunciation || '',
    english_gloss: word.englishGloss || '',
    root: word.root || '',
    root_transliteration: word.rootTransliteration || '',
    root_meaning: word.rootMeaning || '',
    strongs_number: word.strongsNumber || '',
    word_form: word.wordForm || '',
    grammar_note: word.grammarNote || '',
    lexicon_note: word.lexiconNote || '',
    context_note: word.contextNote || '',
    study_prompt: word.studyPrompt || '',
    theme_tags: arrayValue(word.themeTags),
    updated_at: new Date().toISOString(),
  };
}

async function publishVerseWords(supabase, verseRecord, verse) {
  const words = arrayValue(verse.words).filter((word) => text(word.hebrewText));
  if (!words.length) return { wordCount: 0, linkedCount: 0 };

  const { data: wordRows, error: wordError } = await supabase
    .from('hebrew_words')
    .upsert(words.map(mapWordRow), { onConflict: 'source_key' })
    .select('id,source_key');

  if (wordError) throw new Error(`Could not publish words for ${verse.reference}: ${wordError.message}`);

  const wordIdBySourceKey = new Map(arrayValue(wordRows).map((word) => [word.source_key, word.id]));
  const links = words.map((word) => ({
    verse_id: verseRecord.id,
    word_id: wordIdBySourceKey.get(word.sourceKey),
    word_position: word.wordPosition,
  })).filter((link) => link.word_id);

  const { error: linkError } = await supabase.from('hebrew_verse_words').upsert(links, { onConflict: 'verse_id,word_position' });
  if (linkError) throw new Error(`Could not link words for ${verse.reference}: ${linkError.message}`);
  return { wordCount: words.length, linkedCount: links.length };
}

export async function getHebrewAppStatus(input = {}, options = {}) {
  const supabase = options.supabase ?? getSupabaseAdminClient(options.env);
  const limit = cleanLimit(input.limit, 8);
  const tableCounts = await Promise.all(HEBREW_TABLES.map((table) => countTable(supabase, table)));

  const { data: latestVerses } = await supabase
    .from('hebrew_verses')
    .select('book,chapter,verse_number,reference,updated_at')
    .order('updated_at', { ascending: false })
    .limit(limit);

  const { data: latestLessons } = await supabase
    .from('hebrew_lessons')
    .select('id,slug,title,is_published,updated_at')
    .order('updated_at', { ascending: false })
    .limit(limit);

  return {
    ok: !tableCounts.some((entry) => entry.error),
    tool: 'get_hebrew_app_status',
    tableCounts,
    latestVerses: arrayValue(latestVerses),
    latestLessons: arrayValue(latestLessons),
    message: 'Hebrew app status loaded.',
  };
}

export async function draftHebrewLessonBundle(input = {}, options = {}) {
  const supabase = options.supabase ?? getSupabaseAdminClient(options.env);
  const bundle = normalizeBundle(input);
  if (!bundle.slug) throw new Error('Could not create a stable Hebrew lesson slug.');

  const { data: existing, error: lookupError } = await supabase.from('hebrew_lessons').select('id').eq('slug', bundle.slug).limit(1).maybeSingle();
  if (lookupError) throw new Error(`Could not check existing Hebrew lesson: ${lookupError.message}`);

  const row = {
    slug: bundle.slug,
    title: bundle.title,
    description: bundle.description,
    lesson_order: bundle.lessonOrder,
    content: bundle.content,
    is_published: false,
    updated_at: new Date().toISOString(),
  };

  const query = existing?.id ? supabase.from('hebrew_lessons').update(row).eq('id', existing.id) : supabase.from('hebrew_lessons').insert(row);
  const { data, error } = await query.select('id,slug,title,is_published,updated_at,content').single();
  if (error) throw new Error(`Could not save Hebrew lesson draft: ${error.message}`);

  return {
    ok: true,
    tool: 'draft_hebrew_lesson_bundle',
    action: existing?.id ? 'updated' : 'created',
    lessonId: data.id,
    slug: data.slug,
    title: data.title,
    isPublished: data.is_published,
    preview: previewFromLesson(data),
    message: existing?.id ? 'Hebrew lesson draft updated.' : 'Hebrew lesson draft created.',
  };
}

export async function previewHebrewLessonBundle(input = {}, options = {}) {
  const supabase = options.supabase ?? getSupabaseAdminClient(options.env);
  const lesson = await loadLesson(supabase, input);
  return {
    ok: true,
    tool: 'preview_hebrew_lesson_bundle',
    lessonId: lesson.id,
    slug: lesson.slug,
    title: lesson.title,
    isPublished: lesson.is_published,
    ...previewFromLesson(lesson),
  };
}

export async function publishHebrewLessonBundle(input = {}, options = {}) {
  const supabase = options.supabase ?? getSupabaseAdminClient(options.env);
  const lesson = await loadLesson(supabase, input);
  const content = objectValue(lesson.content);
  const verses = arrayValue(content.verses);
  if (!verses.length) throw new Error('This lesson has no verses to publish.');

  const publishedVerses = [];
  let wordCount = 0;
  let linkedWordCount = 0;

  for (const verse of verses) {
    const normalizedVerse = normalizeVerse(verse, 0, { book: content.book, chapter: content.chapter, verseStart: content.verseStart });
    const verseRecord = await upsertVerse(supabase, normalizedVerse);
    const wordResult = await publishVerseWords(supabase, verseRecord, normalizedVerse);
    wordCount += wordResult.wordCount;
    linkedWordCount += wordResult.linkedCount;
    publishedVerses.push({ reference: normalizedVerse.reference, verseId: verseRecord.id, action: verseRecord.action });
  }

  const updatedContent = {
    ...content,
    publishedAt: new Date().toISOString(),
    publishedSummary: { verseCount: publishedVerses.length, wordCount, linkedWordCount },
  };

  await supabase.from('hebrew_lessons').update({ content: updatedContent, is_published: true, updated_at: new Date().toISOString() }).eq('id', lesson.id);

  return {
    ok: true,
    tool: 'publish_hebrew_lesson_bundle',
    lessonId: lesson.id,
    slug: lesson.slug,
    publishedVerses,
    verseCount: publishedVerses.length,
    wordCount,
    linkedWordCount,
    message: 'Hebrew lesson published into the Bible study tables.',
  };
}

export async function listPendingHebrewLessons(input = {}, options = {}) {
  const supabase = options.supabase ?? getSupabaseAdminClient(options.env);
  const limit = cleanLimit(input.limit, 25);
  const { data, error } = await supabase
    .from('hebrew_lessons')
    .select('id,slug,title,description,content,is_published,created_at,updated_at')
    .eq('is_published', false)
    .order('updated_at', { ascending: false })
    .limit(limit);

  if (error) throw new Error(`Could not list pending Hebrew lessons: ${error.message}`);

  return {
    ok: true,
    tool: 'list_pending_hebrew_lessons',
    count: arrayValue(data).length,
    lessons: arrayValue(data).map((lesson) => ({
      id: lesson.id,
      slug: lesson.slug,
      title: lesson.title,
      referenceRange: objectValue(lesson.content).referenceRange || '',
      updatedAt: lesson.updated_at,
    })),
  };
}
