-- Hebrew Scripture audio library v1. Additive only.
create table if not exists public.hebrew_book_albums (
  id uuid primary key default gen_random_uuid(), book_key text not null unique,
  title text not null, subtitle text not null default '', artwork_path text,
  display_order integer not null default 0, is_visible boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  constraint hebrew_book_albums_key_format check (book_key ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')
);
create table if not exists public.hebrew_audio_tracks (
  id uuid primary key default gen_random_uuid(),
  verse_id uuid not null references public.hebrew_verses(id) on delete restrict,
  lesson_id uuid references public.hebrew_lessons(id) on delete set null,
  verse_reference text not null unique, track_title text not null,
  status text not null default 'draft' check (status in ('draft','ready_to_generate','generating','ready','failed')),
  script_version text not null default 'v1', total_duration_seconds numeric,
  is_published boolean not null default false, published_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  constraint hebrew_audio_tracks_duration check (total_duration_seconds is null or total_duration_seconds >= 0)
);
create table if not exists public.hebrew_audio_segments (
  id uuid primary key default gen_random_uuid(),
  track_id uuid not null references public.hebrew_audio_tracks(id) on delete cascade,
  sort_order integer not null check (sort_order > 0), segment_type text not null, label text not null,
  spoken_text text not null default '', display_transcript text not null default '',
  voice_profile text not null default 'ash', voice_instructions text not null default '',
  speech_settings jsonb not null default '{"speed":1}'::jsonb, generation_model text,
  audio_path text, duration_seconds numeric, checksum text,
  status text not null default 'pending' check (status in ('pending','generating','ready','failed')),
  error_information text, generated_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (track_id, sort_order),
  constraint hebrew_audio_segments_duration check (duration_seconds is null or duration_seconds >= 0),
  constraint hebrew_audio_segments_speech_settings_object check (jsonb_typeof(speech_settings) = 'object')
);
create index if not exists hebrew_audio_tracks_verse_id_idx on public.hebrew_audio_tracks(verse_id);
create index if not exists hebrew_audio_tracks_status_idx on public.hebrew_audio_tracks(status,is_published);
create index if not exists hebrew_audio_segments_track_order_idx on public.hebrew_audio_segments(track_id,sort_order);
create index if not exists hebrew_audio_segments_status_idx on public.hebrew_audio_segments(status);
alter table public.hebrew_book_albums enable row level security;
alter table public.hebrew_audio_tracks enable row level security;
alter table public.hebrew_audio_segments enable row level security;
drop policy if exists "Visible Hebrew albums are publicly readable" on public.hebrew_book_albums;
create policy "Visible Hebrew albums are publicly readable" on public.hebrew_book_albums for select to public using (is_visible);
drop policy if exists "Published Hebrew audio tracks are publicly readable" on public.hebrew_audio_tracks;
create policy "Published Hebrew audio tracks are publicly readable" on public.hebrew_audio_tracks for select to public using (is_published);
drop policy if exists "Published Hebrew audio segments are publicly readable" on public.hebrew_audio_segments;
create policy "Published Hebrew audio segments are publicly readable" on public.hebrew_audio_segments for select to public using (
  status='ready' and exists(select 1 from public.hebrew_audio_tracks t where t.id=track_id and t.is_published and t.status='ready')
);
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('hebrew-media','hebrew-media',true,26214400,array['audio/mpeg','audio/mp3','image/webp','image/png','image/jpeg']::text[])
on conflict(id) do update set public=excluded.public,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types,updated_at=now();
insert into public.hebrew_book_albums(book_key,title,subtitle,artwork_path,display_order,is_visible)
values('genesis','Genesis','Beginnings, creation, covenant, and the faithful ordering of our Father.','artwork/books/genesis.webp',1,true)
on conflict(book_key) do update set title=excluded.title,subtitle=excluded.subtitle,artwork_path=excluded.artwork_path,display_order=1,is_visible=true,updated_at=now();

insert into public.hebrew_verses(book,chapter,verse_number,reference,hebrew_text,english_text,context_note)
values('Genesis',1,14,'Genesis 1:14',
'וַיֹּאמֶר אֱלֹהִים יְהִי מְאֹרֹת בִּרְקִיעַ הַשָּׁמַיִם לְהַבְדִּיל בֵּין הַיּוֹם וּבֵין הַלָּיְלָה וְהָיוּ לְאֹתֹת וּלְמוֹעֲדִים וּלְיָמִים וְשָׁנִים׃',
'And God said, Let there be lights in the firmament of the heaven to divide the day from the night; and let them be for signs, and for seasons, and for days, and years:',
'Our Father appoints the heavenly lights to separate day from night and mark signs, appointed times, days, and years.')
on conflict(book,chapter,verse_number) do update set reference=excluded.reference,hebrew_text=excluded.hebrew_text,english_text=excluded.english_text,context_note=excluded.context_note,updated_at=now();

with w as (
  select * from jsonb_to_recordset($words$[
{"p":1,"k":"genesis-1-14-01-vayomer","h":"וַיֹּאמֶר","t":"vayomer","pr":"vah-YOH-mer","g":"and He said","r":"אמר","rt":"amar","rm":"to say or speak","s":"H559","f":"Wayyiqtol verb, third masculine singular","n":"The narrative form moves the story forward: and He said."},
{"p":2,"k":"genesis-1-14-02-elohim","h":"אֱלֹהִים","t":"Elohim","pr":"eh-loh-HEEM","g":"God","r":"אלהים","rt":"elohim","rm":"God, the mighty Creator","s":"H430","f":"Plural-form noun with a singular verb here","n":"Elohim acts as the one Creator."},
{"p":3,"k":"genesis-1-14-03-yehi","h":"יְהִי","t":"yehi","pr":"yeh-HEE","g":"let there be","r":"היה","rt":"hayah","rm":"to be or become","s":"H1961","f":"Jussive verb","n":"A directive calling something into existence or function."},
{"p":4,"k":"genesis-1-14-04-meorot","h":"מְאֹרֹת","t":"me’orot","pr":"meh-oh-ROTE","g":"lights or light-bearers","r":"מאור","rt":"maor","rm":"luminary or light-bearer","s":"H3974","f":"Masculine plural noun","n":"Created luminaries that carry light and serve our Father's order."},
{"p":5,"k":"genesis-1-14-05-birqia","h":"בִּרְקִיעַ","t":"birqia","pr":"beer-kee-AH","g":"in the expanse","r":"רקיע","rt":"raqia","rm":"expanse or firmament","s":"H7549","f":"Preposition plus noun","n":"The lights receive a place in the prepared expanse."},
{"p":6,"k":"genesis-1-14-06-hashamayim","h":"הַשָּׁמַיִם","t":"hashamayim","pr":"hah-shah-MAH-yeem","g":"the heavens","r":"שמים","rt":"shamayim","rm":"heavens or sky","s":"H8064","f":"Definite article plus noun","n":"The heavens remain under the Creator."},
{"p":7,"k":"genesis-1-14-07-lehavdil","h":"לְהַבְדִּיל","t":"lehavdil","pr":"leh-hahv-DEEL","g":"to cause separation","r":"בדל","rt":"badal","rm":"to divide or distinguish","s":"H914","f":"Hiphil infinitive construct","n":"The causative stem means to cause a useful distinction."},
{"p":8,"k":"genesis-1-14-08-bein","h":"בֵּין","t":"bein","pr":"bane","g":"between","r":"בין","rt":"bein","rm":"between or among","s":"H996","f":"Preposition","n":"Introduces the two sides of a distinction."},
{"p":9,"k":"genesis-1-14-09-hayom","h":"הַיּוֹם","t":"hayom","pr":"hah-YOHM","g":"the day","r":"יום","rt":"yom","rm":"day","s":"H3117","f":"Definite article plus noun","n":"Day is one side of the ordered rhythm."},
{"p":10,"k":"genesis-1-14-10-uvein","h":"וּבֵין","t":"uvein","pr":"oo-VANE","g":"and between","r":"בין","rt":"bein","rm":"between or among","s":"H996","f":"Conjunction plus preposition","n":"Joins the second side of the comparison."},
{"p":11,"k":"genesis-1-14-11-halaylah","h":"הַלָּיְלָה","t":"halaylah","pr":"hah-LYE-lah","g":"the night","r":"לילה","rt":"laylah","rm":"night","s":"H3915","f":"Definite article plus noun","n":"Night has a place and boundary in the rhythm."},
{"p":12,"k":"genesis-1-14-12-vehayu","h":"וְהָיוּ","t":"vehayu","pr":"veh-hah-YOO","g":"and let them be","r":"היה","rt":"hayah","rm":"to be or become","s":"H1961","f":"Plural verb with directive force","n":"The lights are appointed to an ongoing function."},
{"p":13,"k":"genesis-1-14-13-leotot","h":"לְאֹתֹת","t":"le’otot","pr":"leh-oh-TOTE","g":"for signs","r":"אות","rt":"ot","rm":"sign, mark, or token","s":"H226","f":"Preposition plus plural noun","n":"The prefix marks assigned purpose: for signs."},
{"p":14,"k":"genesis-1-14-14-ulemoedim","h":"וּלְמוֹעֲדִים","t":"ulemo’adim","pr":"oo-leh-moh-ah-DEEM","g":"and for appointed times","r":"מועד","rt":"moed","rm":"appointed time, meeting, or season","s":"H4150","f":"Conjunction and preposition plus plural noun","n":"Moed is an appointed time, not merely weather season."},
{"p":15,"k":"genesis-1-14-15-uleyamim","h":"וּלְיָמִים","t":"uleyamim","pr":"oo-leh-yah-MEEM","g":"and for days","r":"יום","rt":"yom","rm":"day","s":"H3117","f":"Conjunction and preposition plus plural noun","n":"The lights make repeated days measurable."},
{"p":16,"k":"genesis-1-14-16-veshanim","h":"וְשָׁנִים","t":"veshanim","pr":"veh-shah-NEEM","g":"and years","r":"שנה","rt":"shanah","rm":"year or repeated cycle","s":"H8141","f":"Conjunction plus plural noun","n":"The sequence expands from days to long cycles of years."}
]$words$::jsonb) as x(p int,k text,h text,t text,pr text,g text,r text,rt text,rm text,s text,f text,n text)
), upserted as (
  insert into public.hebrew_words(source_key,hebrew_text,transliteration,pronunciation,english_gloss,root,root_transliteration,root_meaning,strongs_number,word_form,grammar_note,lexicon_note,context_note,study_prompt,theme_tags)
  select k,h,t,pr,g,r,rt,rm,s,f,n,n,n,'Practice the sound, meaning, root, grammar, and role of this word in Genesis 1:14.',array['genesis-1-14']::text[] from w
  on conflict(source_key) do update set hebrew_text=excluded.hebrew_text,transliteration=excluded.transliteration,pronunciation=excluded.pronunciation,english_gloss=excluded.english_gloss,root=excluded.root,root_transliteration=excluded.root_transliteration,root_meaning=excluded.root_meaning,strongs_number=excluded.strongs_number,word_form=excluded.word_form,grammar_note=excluded.grammar_note,lexicon_note=excluded.lexicon_note,context_note=excluded.context_note,updated_at=now()
  returning id,source_key
)
insert into public.hebrew_verse_words(verse_id,word_id,word_position)
select v.id,u.id,w.p from w join upserted u on u.source_key=w.k cross join lateral(select id from public.hebrew_verses where book='Genesis' and chapter=1 and verse_number=14)v
on conflict(verse_id,word_position) do update set word_id=excluded.word_id;

insert into public.hebrew_lessons(slug,title,description,lesson_order,content,is_published)
values('genesis-1-14-signs-seasons-days-and-years','Genesis 1:14 — Signs, Seasons, Days, and Years',
'Our Father appoints the heavenly lights to distinguish day from night and mark signs, appointed times, days, and years.',14,
$lesson${"book":"Genesis","chapter":1,"verseStart":14,"verseEnd":14,"referenceRange":"Genesis 1:14","schemaVersion":"hebrew-audio-library-v1","lesson":{"title":"Genesis 1:14 — Signs, Seasons, Days, and Years","reference":"Genesis 1:14","summary":"Our Father gives the created lights a place, a boundary-making function, and a role in marking signs, appointed times, days, and years.","simple_explanation":"The sun, moon, and stars are created servants. They help creation tell day from night and measure time.","root_study":[{"word":"וַיֹּאמֶר","transliteration":"Vayomer","root":"אמר","strongs":"H559","meaning":"and He said"},{"word":"מְאֹרֹת","transliteration":"Me’orot","root":"מאור","strongs":"H3974","meaning":"lights or light-bearers"},{"word":"לְהַבְדִּיל","transliteration":"Lehavdil","root":"בדל","strongs":"H914","meaning":"to cause a distinction"},{"word":"אוֹת","transliteration":"Ot","root":"אות","strongs":"H226","meaning":"sign or mark"},{"word":"מוֹעֵד","transliteration":"Moed","root":"מועד","strongs":"H4150","meaning":"appointed time or meeting"}],"what_english_misses":"Moed means an appointed time or meeting, and lehavdil is a causative form: the lights help cause a useful distinction between day and night.","worship_connection":"Genesis speaks first about created lights. Later Scripture reveals Jesus as the true Light, our Father's Son sent in the fullness of time, and the Lamb who lights the New Jerusalem. This is a whole-Bible theme, not a secret code in individual Hebrew letters.","memory_sentence":"Our Father gives light, time, and seasons an appointed purpose."}}$lesson$::jsonb,true)
on conflict(slug) do update set title=excluded.title,description=excluded.description,lesson_order=14,content=excluded.content,is_published=true,updated_at=now();

with ids as (
 select v.id verse_id,l.id lesson_id from public.hebrew_verses v join public.hebrew_lessons l on l.slug='genesis-1-14-signs-seasons-days-and-years' where v.book='Genesis' and v.chapter=1 and v.verse_number=14
)
insert into public.hebrew_audio_tracks(verse_id,lesson_id,verse_reference,track_title,status,script_version,is_published)
select verse_id,lesson_id,'Genesis 1:14','Genesis 1:14 — Signs, Seasons, Days, and Years','ready_to_generate','v1',false from ids
on conflict(verse_reference) do update set verse_id=excluded.verse_id,lesson_id=excluded.lesson_id,track_title=excluded.track_title,script_version='v1',status=case when hebrew_audio_tracks.status='ready' then 'ready' else 'ready_to_generate' end,updated_at=now();

with track as (select id from public.hebrew_audio_tracks where verse_reference='Genesis 1:14'), s as (
 select * from jsonb_to_recordset($segments$[
{"o":10,"t":"opening","l":"Opening and welcome","sp":"Welcome to Genesis 1:14, Signs, Seasons, Days, and Years. Today we will hear the verse, practice its Hebrew, study five important words, trace the Bible's light theme to Jesus, reflect, and pray.","d":"Welcome to Genesis 1:14 — Signs, Seasons, Days, and Years.\n\nWe will hear the verse, practice the Hebrew, study key words, see the whole-Bible light theme in Jesus, reflect, and pray.","i":"Speak warmly and reverently.","v":0.94},
{"o":20,"t":"kjv","l":"Genesis 1:14 in the KJV","sp":"Genesis chapter one, verse fourteen. And God said, Let there be lights in the firmament of the heaven to divide the day from the night; and let them be for signs, and for seasons, and for days, and years.","d":"Genesis 1:14 KJV\n\nAnd God said, Let there be lights in the firmament of the heaven to divide the day from the night; and let them be for signs, and for seasons, and for days, and years:","i":"Read clearly without dramatizing.","v":0.94},
{"o":30,"t":"hebrew_natural","l":"Complete Hebrew verse at natural speed","sp":"וַיֹּאמֶר אֱלֹהִים יְהִי מְאֹרֹת בִּרְקִיעַ הַשָּׁמַיִם לְהַבְדִּיל בֵּין הַיּוֹם וּבֵין הַלָּיְלָה וְהָיוּ לְאֹתֹת וּלְמוֹעֲדִים וּלְיָמִים וְשָׁנִים׃","d":"וַיֹּאמֶר אֱלֹהִים יְהִי מְאֹרֹת בִּרְקִיעַ הַשָּׁמַיִם לְהַבְדִּיל בֵּין הַיּוֹם וּבֵין הַלָּיְלָה וְהָיוּ לְאֹתֹת וּלְמוֹעֲדִים וּלְיָמִים וְשָׁנִים׃","i":"Read only the Hebrew naturally and carefully.","v":0.9},
{"o":40,"t":"hebrew_slow","l":"Complete Hebrew verse slowly by phrase","sp":"וַיֹּאמֶר אֱלֹהִים. יְהִי מְאֹרֹת בִּרְקִיעַ הַשָּׁמַיִם. לְהַבְדִּיל בֵּין הַיּוֹם וּבֵין הַלָּיְלָה. וְהָיוּ לְאֹתֹת וּלְמוֹעֲדִים. וּלְיָמִים וְשָׁנִים.","d":"וַיֹּאמֶר אֱלֹהִים — Vayomer Elohim — And God said.\n\nיְהִי מְאֹרֹת בִּרְקִיעַ הַשָּׁמַיִם — Yehi me’orot birqia hashamayim — Let there be lights in the expanse of the heavens.\n\nלְהַבְדִּיל בֵּין הַיּוֹם וּבֵין הַלָּיְלָה — Lehavdil bein hayom uvein halaylah — To distinguish day from night.\n\nוְהָיוּ לְאֹתֹת וּלְמוֹעֲדִים — Vehayu le’otot ulemo’adim — Let them be for signs and appointed times.\n\nוּלְיָמִים וְשָׁנִים — Uleyamim veshanim — For days and years.","i":"Read only the Hebrew slowly with natural phrase pauses.","v":0.72},
{"o":50,"t":"word_study","l":"Hebrew word study","sp":"Vayomer, וַיֹּאמֶר, means and He said. Its root is amar, to say or speak, Strong's H 559. It is a narrative verb that moves the story forward. Me’orot, מְאֹרֹת, means lights or light-bearers, Strong's H 3974. They are created luminaries, not gods. Lehavdil, לְהַבְדִּיל, means to cause a separation or distinction. Its root is badal, Strong's H 914. Ot, אוֹת, means a sign, mark, or token, Strong's H 226. Here the plural le’otot means for signs. Moed, מוֹעֵד, means an appointed time, meeting, or season, Strong's H 4150. Mo’adim are recurring appointed times, deeper than ordinary weather seasons.","d":"וַיֹּאמֶר — Vayomer — and He said. Root אמר, amar. Strong’s H559.\n\nמְאֹרֹת — Me’orot — lights or light-bearers. Strong’s H3974.\n\nלְהַבְדִּיל — Lehavdil — to cause a distinction. Root בדל, badal. Strong’s H914.\n\nאוֹת — Ot — sign, mark, or token. Strong’s H226.\n\nמוֹעֵד — Moed — appointed time, meeting, or season. Strong’s H4150.","i":"Teach like a patient Hebrew tutor and pronounce every Hebrew word carefully.","v":0.92},
{"o":60,"t":"repeat","l":"Repeat-after-me practice","sp":"Now repeat after me. Vayomer. וַיֹּאמֶר. Me’orot. מְאֹרֹת. Lehavdil. לְהַבְדִּיל. Ot. אוֹת. Moed. מוֹעֵד. Vayomer Elohim. וַיֹּאמֶר אֱלֹהִים. Yehi me’orot. יְהִי מְאֹרֹת. Lehavdil bein hayom uvein halaylah. לְהַבְדִּיל בֵּין הַיּוֹם וּבֵין הַלָּיְלָה.","d":"Repeat aloud:\n\nוַיֹּאמֶר — Vayomer\nמְאֹרֹת — Me’orot\nלְהַבְדִּיל — Lehavdil\nאוֹת — Ot\nמוֹעֵד — Moed\n\nוַיֹּאמֶר אֱלֹהִים — Vayomer Elohim\nיְהִי מְאֹרֹת — Yehi me’orot\nלְהַבְדִּיל בֵּין הַיּוֹם וּבֵין הַלָּיְלָה — Lehavdil bein hayom uvein halaylah","i":"Coach pronunciation and leave natural silence after every item without saying pause.","v":0.76},
{"o":70,"t":"see_jesus","l":"Did You Know? See Jesus Here","sp":"Genesis 1:14 first says that our Father created the heavenly lights to distinguish day from night and mark signs, appointed times, days, and years. The verse is about created lights serving creation. It does not hide Jesus in individual Hebrew letters. But the light theme grows through Scripture. John says that in Jesus was life, and that life was the light of men. Jesus says, I am the light of the world. Genesis gives created lights that mark time. Galatians says that when the fullness of time came, our Father sent His Son. The Creator of appointed times entered history at the appointed time. Revelation says the New Jerusalem needs neither sun nor moon because the glory of God lights it, and the Lamb is its light. The whole story moves from created lights, to the true Light entering time, to the Lamb lighting the final city.","d":"Genesis 1:14 first speaks about created lights serving creation. It does not hide Jesus inside individual Hebrew letters.\n\nThe theme grows through Scripture:\n\n• John 1:4–9 reveals Jesus as the true Light.\n• John 8:12 records Jesus saying, “I am the light of the world.”\n• Galatians 4:4 says that in the fullness of time, our Father sent His Son.\n• Revelation 21:23 says the glory of God lights the New Jerusalem, and the Lamb is its light.\n\nCreated lights. The true Light entering appointed time. The Lamb lighting the final city.","i":"Speak with wonder and carefully distinguish Genesis's original meaning from later fulfillment in Jesus.","v":0.94},
{"o":80,"t":"reflection","l":"Practical reflection","sp":"Time is not empty. Our Father gives it structure: days, years, signs, and appointed meetings. You do not have to carry every future year today. Receive the portion called today. Healthy distinctions create peace. Day is not night. Work is not rest. One season is not every season. The lights faithfully serve their appointed purpose. Peace often grows when we stop trying to be everything and faithfully serve today's assignment.","d":"Time is not empty. Our Father gives it structure.\n\nYou do not have to carry every future year today. Receive today’s portion.\n\nHealthy distinction creates peace: day is not night, work is not rest, and one season is not every season.\n\nFaithfully serve today’s assignment.","i":"Speak gently and practically.","v":0.94},
{"o":90,"t":"prayer","l":"Closing prayer","sp":"Father, thank You for creating light, order, rhythm, and appointed time. Teach us to receive today as a gift. Help us distinguish work from rest, urgency from calling, and distraction from faithful purpose. Thank You for sending Your Son in the fullness of time. Jesus, true Light of the world, guide our steps and fill our hearts with Your light. Help us faithfully serve today's assignment. In Jesus' name, amen.","d":"Father, thank You for creating light, order, rhythm, and appointed time. Teach us to receive today as a gift. Help us distinguish work from rest, urgency from calling, and distraction from faithful purpose. Thank You for sending Your Son in the fullness of time. Jesus, true Light of the world, guide our steps and fill our hearts with Your light. Help us faithfully serve today’s assignment. In Jesus’ name, amen.","i":"Pray warmly and reverently.","v":0.92},
{"o":100,"t":"final_hebrew","l":"Final natural Hebrew reading","sp":"וַיֹּאמֶר אֱלֹהִים יְהִי מְאֹרֹת בִּרְקִיעַ הַשָּׁמַיִם לְהַבְדִּיל בֵּין הַיּוֹם וּבֵין הַלָּיְלָה וְהָיוּ לְאֹתֹת וּלְמוֹעֲדִים וּלְיָמִים וְשָׁנִים׃","d":"וַיֹּאמֶר אֱלֹהִים יְהִי מְאֹרֹת בִּרְקִיעַ הַשָּׁמַיִם לְהַבְדִּיל בֵּין הַיּוֹם וּבֵין הַלָּיְלָה וְהָיוּ לְאֹתֹת וּלְמוֹעֲדִים וּלְיָמִים וְשָׁנִים׃","i":"Read only the Hebrew naturally, confidently, and reverently.","v":0.9}
]$segments$::jsonb) as x(o int,t text,l text,sp text,d text,i text,v numeric)
)
insert into public.hebrew_audio_segments(track_id,sort_order,segment_type,label,spoken_text,display_transcript,voice_profile,voice_instructions,speech_settings,status)
select track.id,o,t,l,sp,d,'ash',i,jsonb_build_object('speed',v),'pending' from track,s
on conflict(track_id,sort_order) do update set segment_type=excluded.segment_type,label=excluded.label,spoken_text=excluded.spoken_text,display_transcript=excluded.display_transcript,voice_profile=excluded.voice_profile,voice_instructions=excluded.voice_instructions,speech_settings=excluded.speech_settings,status=case when hebrew_audio_segments.checksum is null then 'pending' else hebrew_audio_segments.status end,updated_at=now();
