# Genesis 1 Hebrew Study

A small static Bible study app for exploring Hebrew words in Genesis 1.

Open `index.html` in a browser. Click a Hebrew word to see:

- English gloss
- Transliteration
- Beginner-friendly pronunciation help
- Hebrew root
- Form and grammar
- Context notes
- A study prompt
- A Blue Letter Bible lexicon link when a Strong's number is available

The app currently includes Genesis 1:1-5 with word-level notes.

## Sources

### Hebrew Bible Text

The Hebrew text in this study app is based on the Masoretic Text tradition, using Genesis 1 Hebrew forms commonly found in Westminster Leningrad Codex / Leningrad Codex based resources.

### Study Notes

The English glosses, transliterations, roots, grammar notes, context notes, study prompts, pronunciation helps, and theme tags are app study notes. They are meant to help beginners and should be checked against trusted Hebrew lexicons and Bible study resources.

### Strong's Numbers

Strong's numbers are used as study index numbers that help connect Hebrew words to lexicon resources.

### External Study Tools

Blue Letter Bible is linked for Strong's / lexicon lookup. Google Translate is linked as a modern Hebrew audio helper.

### Pronunciation Note

Google Translate audio can be helpful for hearing modern Hebrew pronunciation, but it should not be treated as perfect Biblical Hebrew pronunciation.

### Disclaimer

This app is a beginner-friendly study tool, not a final scholarly authority. Users should compare the notes with trusted Hebrew Bible resources.

## Blue Letter Bible Links

The detail panel shows the selected word's `strongs` value. If that value includes a Strong's number, the **Open in Blue Letter Bible** button opens the matching lexicon page.

The app uses this URL pattern:

```text
https://www.blueletterbible.org/lexicon/{strongs-lowercase}/kjv/wlc/0-1/
```

For example, `strongs: "H7225"` opens:

```text
https://www.blueletterbible.org/lexicon/h7225/kjv/wlc/0-1/
```

If a word does not have a Strong's number yet, the button is disabled.

## Pronunciation Help

Each word can include a beginner-friendly `pronunciation` field. This is a simple reading aid, not a technical pronunciation system.

Beginner-friendly pronunciation helps have been added for every Hebrew word currently included in Genesis 1:1-5.

Example:

```js
pronunciation: "buh-ray-SHEET"
```

If a word does not have a pronunciation value yet, the detail panel shows:

```text
Pronunciation coming soon
```

The **Hear in Google Translate** button opens the selected Hebrew word in Google Translate:

```text
https://translate.google.com/?sl=iw&tl=en&text={encoded-hebrew-word}&op=translate
```

This is included as a helpful modern Hebrew audio reference. It should not be treated as a full Biblical Hebrew pronunciation system.

The selected word detail rows are styled so longer labels, such as `PRONUNCIATION`, have room to wrap cleanly. On small screens, each label stacks above its value so the text does not overlap.

The **Hear Whole Verse** button opens the current verse in Google Translate by joining the active verse's Hebrew words in order:

```js
const hebrewVerse = verse.words.map((word) => word.hebrew).join(" ");
```

This whole-verse audio helper follows the same modern Hebrew caveat as the selected-word helper.

## Data Structure

Verse and word data live in the `verses` array in `script.js`.

Each verse object uses this shape:

```js
{
  reference: "Genesis 1:1",
  english: "In the beginning God created the heavens and the earth.",
  context: "A short note about the whole verse.",
  words: [
    // word objects go here
  ]
}
```

Each Hebrew word should use one consistent object format:

```js
{
  hebrew: "בְּרֵאשִׁית",
  transliteration: "bereshit",
  gloss: "in beginning, at first",
  pronunciation: "buh-ray-SHEET",
  root: "רֹאשׁ",
  rootTransliteration: "rosh",
  rootMeaning: "head, beginning, first part",
  strongs: "H7225",
  form: "Preposition בְּ + feminine noun רֵאשִׁית",
  grammar: "Construct-like opening phrase; no explicit definite article.",
  lexiconNote: "A short lexicon-style note.",
  context: "A short note about this word in this verse.",
  themeTags: ["beginning", "creation", "time"],
  prompt: "A study question or observation for the learner."
}
```

Optional fields can be left as empty strings or empty arrays if the information is not ready yet. The app will still render without breaking.

## Add A New Verse

1. Open `script.js`.
2. Add a new verse object to the `verses` array.
3. Give it `reference`, `english`, `context`, and `words`.
4. Add one word object for each Hebrew word in the verse.

Example:

```js
{
  reference: "Genesis 1:6",
  english: "And God said, 'Let there be an expanse...'",
  context: "A short verse-level context note.",
  words: [
    {
      hebrew: "וַיֹּאמֶר",
      transliteration: "vayomer",
      gloss: "and he said",
      pronunciation: "vah-YOH-mer",
      root: "אמר",
      rootTransliteration: "amar",
      rootMeaning: "say, speak",
      strongs: "H559",
      form: "Wayyiqtol verb",
      grammar: "Narrative verb form.",
      lexiconNote: "אמר is the common Hebrew verb for speaking.",
      context: "Introduces another divine speech act.",
      themeTags: ["speech", "creation"],
      prompt: "How does repeated divine speech structure the chapter?"
    }
  ]
}
```

## Add A New Hebrew Word

Add a new object inside a verse's `words` array. Keep the same field names every time:

- `hebrew`
- `transliteration`
- `gloss`
- `pronunciation`
- `root`
- `rootTransliteration`
- `rootMeaning`
- `strongs`
- `form`
- `grammar`
- `lexiconNote`
- `context`
- `themeTags`
- `prompt`

Using the same shape for every word keeps the app easier to expand, search, and eventually connect to lexicon data.
