-- Genesis 1:1-6 word study data completion
-- Applied directly to Supabase on 2026-07-07.
-- Purpose: complete missing Genesis 1:6 Strong's numbers, root transliterations,
-- root meanings, forms, grammar notes, lexicon notes, context notes, study prompts,
-- theme tags, and pronunciation fields.

update hebrew_words as hw
set
  root_transliteration = data.root_transliteration,
  root_meaning = data.root_meaning,
  strongs_number = data.strongs_number,
  word_form = data.word_form,
  grammar_note = data.grammar_note,
  lexicon_note = data.lexicon_note,
  context_note = data.context_note,
  study_prompt = data.study_prompt,
  theme_tags = data.theme_tags::text[]
from (values
  ('b87638f9-290c-44cb-938b-cf58315f04fc'::uuid, 'amar', 'say, speak, command', 'H559', 'Wayyiqtol verb, 3rd masculine singular', 'This is a storytelling verb. It moves the scene forward by showing God speaking.', 'Amar simply means to say or speak. In Genesis 1, God''s speaking brings order and action.', 'God''s speech begins the creative action. The scene changes because God speaks.', 'Notice the pattern: God said. What does this teach you about the power of our Father''s word?', array['speech','creation','command']),
  ('ff90d23d-7695-4757-b257-d8d929a44e2e'::uuid, 'elohim', 'God, deity, mighty one', 'H430', 'Masculine plural form used here with singular meaning', 'This noun names the subject of the sentence. God is the One speaking.', 'Elohim names the Creator. The form can look plural to beginners, but here it clearly points to the one true God acting and speaking.', 'The Creator is the One speaking. The verse keeps our eyes on God before it shows the created space.', 'Before looking at the expanse, look at the Speaker. How does this keep the verse centered on God?', array['God','speech','creator']),
  ('673a80c7-de49-445b-b11b-b2a69dec20dc'::uuid, 'hayah', 'be, become, happen', 'H1961', 'Jussive-like Qal form, 3rd masculine singular', 'This is a command-like form: let it be.', 'Yehi is the same creation command pattern heard in verse 3. It is short, direct, and full of authority.', 'God commands something to exist. The expanse is not negotiated into being; it answers His word.', 'Say it slowly: yehi, let there be. What does this show about God bringing order with a word?', array['command','being','creation']),
  ('c5afe8ca-b697-47e9-af8e-74dc75ada50e'::uuid, 'raqa', 'spread out, beat out, stretch an expanse', 'H7549', 'Masculine singular noun', 'This noun names the expanse God commands into the waters.', 'Raqia names an expanse or spread-out space. In Genesis 1 it becomes the ordered space God places among the waters.', 'The space God makes in the midst of the waters becomes part of creation''s ordered structure.', 'Picture God making room and structure. Where do you see Him creating ordered space in this verse?', array['expanse','space','order']),
  ('a3d1f6b8-60cf-4d70-8df0-15d62fcb64b9'::uuid, 'tavekh / tokh', 'middle, midst, inside', 'H8432', 'Preposition בְּ + noun meaning midst', 'This phrase shows location: in the middle of the waters.', 'Betokh points to location. It tells us where the expanse is placed.', 'The expanse is not off to the side. It is set right in the midst of the waters.', 'This word says in the middle. What does it help you picture about where God is working?', array['location','middle','waters']),
  ('977bf941-b922-40d9-96cd-1ce14cf55dd3'::uuid, 'mayim', 'water, waters', 'H4325', 'Definite plural noun with הַ', 'This is the definite form: the waters.', 'Mayim means water or waters. Genesis 1 keeps returning to the waters as God orders the creation scene.', 'The waters are being ordered by God''s command. What felt unshaped in verse 2 is now being given structure.', 'Watch the waters move from chaos toward order. What does that teach you about our Father''s patience and power?', array['waters','order','creation setting']),
  ('f6ae8a08-44fd-4025-8de7-d12d2854efd3'::uuid, 'hayah', 'be, become, happen', 'H1961', 'Conjunction וִ + jussive-like verb', 'This continues the command: and let it be.', 'Vihi continues the command. The verse gives both the creation of the expanse and its purpose.', 'The command continues with purpose. The expanse is not only made; it is assigned a separating role.', 'God does not only make things. He gives them purpose. What purpose is being given here?', array['command','purpose','creation']),
  ('9bec3ec9-53c5-44b0-872f-23f5e846b01e'::uuid, 'badal', 'separate, divide, distinguish', 'H914', 'Hiphil participle, masculine singular', 'This participle describes the expanse as separating.', 'Mavdil comes from the same separation idea used in verse 4. Here the expanse is described as the thing separating waters from waters.', 'God''s created space has the job of separating. Separation is part of how He brings order.', 'Notice the repeated creation pattern: God separates to bring order. What boundary is being formed here?', array['separation','order','boundary']),
  ('c5b8cd5a-cfad-49a3-9d2e-650ba6509eb3'::uuid, 'bein', 'between, among, in the space between', 'H996', 'Preposition', 'This word marks the space between two sides.', 'Bein draws a line between two sides. Hebrew often uses it to show distinction and ordered relationship.', 'This word marks the boundary or distinction that the expanse creates.', 'Between is a boundary word. What two sides is Hebrew asking you to notice?', array['between','boundary','syntax']),
  ('54f4a107-0837-4818-9d8d-eaef4ce58ea8'::uuid, 'mayim', 'water, waters', 'H4325', 'Plural noun', 'This names the first side in the waters-from-waters separation.', 'Mayim appears first without the article here, showing one side of the waters being distinguished.', 'This is one side of the separated waters. The verse is carefully describing ordered division.', 'What changes when the waters are no longer one unshaped mass, but are being distinguished?', array['waters','separation','order']),
  ('119027b1-962c-46b5-9115-4ddefb639993'::uuid, 'mayim', 'water, waters', 'H4325', 'Preposition לְ + definite plural noun', 'This points to the other waters in the separation.', 'Lammayim points to the other waters in the separation. The phrase completes the picture: waters from waters.', 'The other side of the separated waters is named. Hebrew slows down so we can see the distinction clearly.', 'This phrase completes the separation picture. How does God make order by naming both sides?', array['waters','separation','completion'])
) as data(id, root_transliteration, root_meaning, strongs_number, word_form, grammar_note, lexicon_note, context_note, study_prompt, theme_tags)
where hw.id = data.id;

update hebrew_words
set pronunciation = transliteration
where id in (
  'b87638f9-290c-44cb-938b-cf58315f04fc'::uuid,
  'ff90d23d-7695-4757-b257-d8d929a44e2e'::uuid,
  '673a80c7-de49-445b-b11b-b2a69dec20dc'::uuid,
  'c5afe8ca-b697-47e9-af8e-74dc75ada50e'::uuid,
  'a3d1f6b8-60cf-4d70-8df0-15d62fcb64b9'::uuid,
  '977bf941-b922-40d9-96cd-1ce14cf55dd3'::uuid,
  'f6ae8a08-44fd-4025-8de7-d12d2854efd3'::uuid,
  '9bec3ec9-53c5-44b0-872f-23f5e846b01e'::uuid,
  'c5b8cd5a-cfad-49a3-9d2e-650ba6509eb3'::uuid,
  '54f4a107-0837-4818-9d8d-eaef4ce58ea8'::uuid,
  '119027b1-962c-46b5-9115-4ddefb639993'::uuid
)
and coalesce(pronunciation,'') = '';

update hebrew_words
set root_transliteration = 'et'
where id = '4bba00a0-9c20-47d2-961b-add69788a473'::uuid
  and coalesce(root_transliteration,'') = '';

update hebrew_verses
set context_note = 'Verse 6 continues the pattern of creation by God''s spoken command. God calls for an expanse in the midst of the waters, and that expanse will separate waters from waters. The big picture is order: our Father makes space, boundaries, and purpose where the scene was once formless.'
where book = 'Genesis' and chapter = 1 and verse_number = 6;

-- Audit query used after applying the patch:
select count(*) filter (where coalesce(hw.pronunciation,'') = '') as missing_pronunciation,
       count(*) filter (where coalesce(hw.strongs_number,'') = '') as missing_strongs,
       count(*) filter (where coalesce(hw.root_transliteration,'') = '') as missing_root_transliteration,
       count(*) filter (where coalesce(hw.root_meaning,'') = '') as missing_root_meaning,
       count(*) filter (where coalesce(hw.word_form,'') = '') as missing_form,
       count(*) filter (where coalesce(hw.grammar_note,'') = '') as missing_grammar,
       count(*) filter (where coalesce(hw.lexicon_note,'') = '') as missing_lexicon_note,
       count(*) filter (where coalesce(hw.context_note,'') = '') as missing_context,
       count(*) filter (where coalesce(hw.study_prompt,'') = '') as missing_prompt
from hebrew_verses v
join hebrew_verse_words hvw on hvw.verse_id = v.id
join hebrew_words hw on hw.id = hvw.word_id
where v.book = 'Genesis' and v.chapter = 1 and v.verse_number between 1 and 6;
