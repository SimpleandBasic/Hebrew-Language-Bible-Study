"use strict";

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const supabaseUrl = (process.env.SUPABASE_URL || "").replace(/\/$/, "");
const adminKey =
  process.env.SUPABASE_SECRET_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  "";

if (!supabaseUrl || !adminKey) {
  throw new Error(
    "SUPABASE_URL and SUPABASE_SECRET_KEY are required. The legacy SUPABASE_SERVICE_ROLE_KEY is also supported."
  );
}

function readLocalVerses() {
  const scriptPath = path.join(__dirname, "..", "script.js");
  const source = fs.readFileSync(scriptPath, "utf8");
  const match = source.match(/const verses = (\[[\s\S]*?\n\]);\n\nlet activeVerseIndex/);

  if (!match) {
    throw new Error("Could not find the verses array in script.js.");
  }

  const parsed = vm.runInNewContext(`(${match[1]})`, Object.create(null), {
    timeout: 1000,
    filename: "script.js#verses"
  });

  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error("The local verses array is empty or invalid.");
  }

  return parsed;
}

function getAdminHeaders(prefer) {
  const headers = {
    apikey: adminKey,
    "Content-Type": "application/json",
    ...(prefer ? { Prefer: prefer } : {})
  };

  // Legacy service-role keys are JWTs and require the Authorization header.
  // Current sb_secret_ keys use the apikey header only.
  if (adminKey.startsWith("eyJ")) {
    headers.Authorization = `Bearer ${adminKey}`;
  }

  return headers;
}

async function supabaseRequest(route, { method = "GET", body, prefer } = {}) {
  const response = await fetch(`${supabaseUrl}/rest/v1/${route}`, {
    method,
    headers: getAdminHeaders(prefer),
    ...(body === undefined ? {} : { body: JSON.stringify(body) })
  });

  const text = await response.text();
  let payload = null;

  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = text;
    }
  }

  if (!response.ok) {
    throw new Error(
      `${method} ${route} failed (${response.status}): ${
        typeof payload === "string" ? payload : JSON.stringify(payload)
      }`
    );
  }

  return payload;
}

function parseReference(reference) {
  const match = reference.match(/^(.+?)\s+(\d+):(\d+)$/);
  if (!match) throw new Error(`Unsupported verse reference: ${reference}`);

  return {
    book: match[1],
    chapter: Number(match[2]),
    verseNumber: Number(match[3])
  };
}

function mapWord(word, sourceKey) {
  return {
    source_key: sourceKey,
    hebrew_text: word.hebrew || "",
    transliteration: word.transliteration || "",
    pronunciation: word.pronunciation || "",
    english_gloss: word.gloss || "",
    root: word.root || "",
    root_transliteration: word.rootTransliteration || "",
    root_meaning: word.rootMeaning || "",
    strongs_number: word.strongs || "",
    word_form: word.form || "",
    grammar_note: word.grammar || "",
    lexicon_note: word.lexiconNote || "",
    context_note: word.context || "",
    study_prompt: word.prompt || "",
    theme_tags: Array.isArray(word.themeTags) ? word.themeTags : [],
    audio_url: null
  };
}

async function upsertOne(table, conflictColumns, record) {
  const route = `${table}?on_conflict=${encodeURIComponent(conflictColumns)}&select=id`;
  const payload = await supabaseRequest(route, {
    method: "POST",
    body: [record],
    prefer: "resolution=merge-duplicates,return=representation"
  });

  if (!Array.isArray(payload) || !payload[0]?.id) {
    throw new Error(`Supabase did not return an id for ${table}.`);
  }

  return payload[0].id;
}

async function seed() {
  const localVerses = readLocalVerses();
  let wordCount = 0;

  for (const verse of localVerses) {
    const { book, chapter, verseNumber } = parseReference(verse.reference);
    const verseId = await upsertOne("hebrew_verses", "book,chapter,verse_number", {
      book,
      chapter,
      verse_number: verseNumber,
      reference: verse.reference,
      hebrew_text: verse.words.map((word) => word.hebrew).join(" "),
      english_text: verse.english || "",
      context_note: verse.context || ""
    });

    await supabaseRequest(`hebrew_verse_words?verse_id=eq.${encodeURIComponent(verseId)}`, {
      method: "DELETE",
      prefer: "return=minimal"
    });

    for (const [index, word] of verse.words.entries()) {
      const position = index + 1;
      const sourceKey = `${book.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${chapter}-${verseNumber}-${position}`;
      const wordId = await upsertOne("hebrew_words", "source_key", mapWord(word, sourceKey));

      await supabaseRequest("hebrew_verse_words?on_conflict=verse_id,word_position", {
        method: "POST",
        body: [{ verse_id: verseId, word_id: wordId, word_position: position }],
        prefer: "resolution=merge-duplicates,return=minimal"
      });

      wordCount += 1;
    }

    console.log(`Seeded ${verse.reference} (${verse.words.length} words).`);
  }

  console.log(`Hebrew seed complete: ${localVerses.length} verses and ${wordCount} word occurrences.`);
}

seed().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
