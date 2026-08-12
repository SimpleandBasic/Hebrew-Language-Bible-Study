-- Spoken Hebrew audio learning v1
-- Keeps conversational Modern Hebrew separate from the Biblical Hebrew study lane.

create table if not exists public.hebrew_spoken_tracks (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  title text not null,
  description text not null default '',
  language_variety text not null default 'Modern Israeli Hebrew',
  level text not null default 'starter' check (level in ('starter','beginner','intermediate','advanced')),
  status text not null default 'active' check (status in ('draft','active','retired')),
  sort_order integer not null default 0,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.hebrew_spoken_lessons (
  id uuid primary key default gen_random_uuid(),
  track_id uuid not null references public.hebrew_spoken_tracks(id) on delete cascade,
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  title text not null,
  topic text not null,
  summary text not null default '',
  level text not null default 'starter' check (level in ('starter','beginner','intermediate','advanced')),
  lesson_order integer not null check (lesson_order > 0),
  objectives jsonb not null default '[]'::jsonb check (jsonb_typeof(objectives) = 'array'),
  estimated_minutes integer not null default 10 check (estimated_minutes between 1 and 60),
  script_version text not null default 'v1',
  status text not null default 'draft' check (status in ('draft','ready','published','retired')),
  audio_status text not null default 'none' check (audio_status in ('none','pending','generating','ready','failed')),
  total_duration_seconds numeric null check (total_duration_seconds is null or total_duration_seconds >= 0),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (track_id, lesson_order)
);

create table if not exists public.hebrew_spoken_items (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.hebrew_spoken_lessons(id) on delete cascade,
  sort_order integer not null check (sort_order > 0),
  item_type text not null default 'phrase' check (item_type in ('phrase','vocabulary','pattern','dialogue','response')),
  hebrew_text text not null,
  transliteration text not null default '',
  english_text text not null default '',
  usage_note text not null default '',
  speaker_context text not null default 'any',
  tags text[] not null default '{}',
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (lesson_id, sort_order)
);

create table if not exists public.hebrew_spoken_segments (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.hebrew_spoken_lessons(id) on delete cascade,
  item_id uuid null references public.hebrew_spoken_items(id) on delete set null,
  sort_order integer not null check (sort_order > 0),
  segment_type text not null check (segment_type in ('coach','hebrew_slow','hebrew_natural','recall_prompt','dialogue','recap','silence')),
  label text not null default '',
  spoken_text text not null default '',
  display_text text not null default '',
  voice_profile text not null default 'cedar',
  voice_instructions text not null default '',
  speech_settings jsonb not null default '{"speed":1}'::jsonb check (jsonb_typeof(speech_settings) = 'object'),
  pause_after_ms integer not null default 1000 check (pause_after_ms between 0 and 15000),
  generation_model text null,
  audio_path text null,
  duration_seconds numeric null check (duration_seconds is null or duration_seconds >= 0),
  checksum text null,
  status text not null default 'pending' check (status in ('pending','generating','ready','failed','skipped')),
  error_information text null,
  generated_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (lesson_id, sort_order)
);

create table if not exists public.hebrew_spoken_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  track_id uuid null references public.hebrew_spoken_tracks(id) on delete set null,
  current_lesson_id uuid null references public.hebrew_spoken_lessons(id) on delete set null,
  current_item_order integer not null default 1 check (current_item_order > 0),
  learning_goal text not null default 'Conversational Modern Hebrew for everyday speaking and listening',
  audio_first boolean not null default true,
  preferred_mode text not null default 'drive' check (preferred_mode in ('drive','listen_repeat','shadowing','recall','mixed')),
  preferred_tts_provider text not null default 'openai' check (preferred_tts_provider in ('openai','elevenlabs','manual')),
  preferred_voice text not null default 'cedar',
  target_session_minutes integer not null default 10 check (target_session_minutes between 3 and 60),
  translation_support text not null default 'light' check (translation_support in ('minimal','light','full')),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.hebrew_spoken_lesson_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  lesson_id uuid not null references public.hebrew_spoken_lessons(id) on delete cascade,
  status text not null default 'not_started' check (status in ('not_started','learning','review','mastered')),
  mastery_score numeric not null default 0 check (mastery_score between 0 and 1),
  listen_count integer not null default 0 check (listen_count >= 0),
  practice_session_count integer not null default 0 check (practice_session_count >= 0),
  current_item_order integer not null default 1 check (current_item_order > 0),
  last_heard_at timestamptz null,
  last_practiced_at timestamptz null,
  next_review_at timestamptz null,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, lesson_id)
);

create table if not exists public.hebrew_spoken_item_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  item_id uuid not null references public.hebrew_spoken_items(id) on delete cascade,
  familiarity_level smallint not null default 0 check (familiarity_level between 0 and 5),
  exposure_count integer not null default 0 check (exposure_count >= 0),
  recall_attempts integer not null default 0 check (recall_attempts >= 0),
  recall_correct integer not null default 0 check (recall_correct >= 0 and recall_correct <= recall_attempts),
  last_seen_at timestamptz null,
  next_review_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, item_id)
);

create table if not exists public.hebrew_spoken_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  lesson_id uuid not null references public.hebrew_spoken_lessons(id) on delete cascade,
  mode text not null default 'drive' check (mode in ('drive','listen_repeat','shadowing','recall','mixed')),
  playback_provider text not null default 'openai' check (playback_provider in ('openai','elevenlabs','chatgpt','manual')),
  started_at timestamptz not null default now(),
  ended_at timestamptz null,
  completed boolean not null default false,
  items_practiced integer not null default 0 check (items_practiced >= 0),
  recall_attempts integer not null default 0 check (recall_attempts >= 0),
  recall_correct integer not null default 0 check (recall_correct >= 0 and recall_correct <= recall_attempts),
  notes jsonb not null default '{}'::jsonb check (jsonb_typeof(notes) = 'object'),
  created_at timestamptz not null default now()
);

create index if not exists hebrew_spoken_lessons_track_order_idx on public.hebrew_spoken_lessons(track_id, lesson_order);
create index if not exists hebrew_spoken_items_lesson_order_idx on public.hebrew_spoken_items(lesson_id, sort_order);
create index if not exists hebrew_spoken_segments_lesson_order_idx on public.hebrew_spoken_segments(lesson_id, sort_order);
create index if not exists hebrew_spoken_lesson_progress_user_review_idx on public.hebrew_spoken_lesson_progress(user_id, next_review_at);
create index if not exists hebrew_spoken_item_progress_user_review_idx on public.hebrew_spoken_item_progress(user_id, next_review_at);
create index if not exists hebrew_spoken_sessions_user_started_idx on public.hebrew_spoken_sessions(user_id, started_at desc);

alter table public.hebrew_spoken_tracks enable row level security;
alter table public.hebrew_spoken_lessons enable row level security;
alter table public.hebrew_spoken_items enable row level security;
alter table public.hebrew_spoken_segments enable row level security;
alter table public.hebrew_spoken_settings enable row level security;
alter table public.hebrew_spoken_lesson_progress enable row level security;
alter table public.hebrew_spoken_item_progress enable row level security;
alter table public.hebrew_spoken_sessions enable row level security;

create policy "Authenticated users can read spoken Hebrew tracks" on public.hebrew_spoken_tracks for select to authenticated using (true);
create policy "Authenticated users can read spoken Hebrew lessons" on public.hebrew_spoken_lessons for select to authenticated using (true);
create policy "Authenticated users can read spoken Hebrew items" on public.hebrew_spoken_items for select to authenticated using (true);
create policy "Authenticated users can read spoken Hebrew segments" on public.hebrew_spoken_segments for select to authenticated using (true);
create policy "Users manage own spoken Hebrew settings" on public.hebrew_spoken_settings for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "Users manage own spoken Hebrew lesson progress" on public.hebrew_spoken_lesson_progress for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "Users manage own spoken Hebrew item progress" on public.hebrew_spoken_item_progress for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "Users manage own spoken Hebrew sessions" on public.hebrew_spoken_sessions for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

grant select on public.hebrew_spoken_tracks, public.hebrew_spoken_lessons, public.hebrew_spoken_items, public.hebrew_spoken_segments to authenticated;
grant select, insert, update, delete on public.hebrew_spoken_settings, public.hebrew_spoken_lesson_progress, public.hebrew_spoken_item_progress, public.hebrew_spoken_sessions to authenticated;

with track as (
  insert into public.hebrew_spoken_tracks (slug,title,description,language_variety,level,status,sort_order,metadata)
  values ('spoken-hebrew-foundations','Spoken Hebrew Foundations','Audio-first conversational Hebrew for everyday listening and speaking practice.','Modern Israeli Hebrew','starter','active',10,'{"learning_style":"audio_first","lesson_pattern":["hear","repeat","recall","mini_dialogue","review"],"driving_mode":true}'::jsonb)
  returning id
), lesson as (
  insert into public.hebrew_spoken_lessons (track_id,slug,title,topic,summary,level,lesson_order,objectives,estimated_minutes,script_version,status,audio_status,metadata)
  select id,'greetings-01','Greetings 1: Hello and Goodbye','greetings','Learn six high-frequency greetings and polite phrases by hearing, repeating, recalling, and using them in a tiny dialogue.','starter',1,'["Say hello naturally","Say good morning","Ask how things are going","Say good, thanks","Say nice to meet you","Say goodbye / see you"]'::jsonb,10,'v1','published','pending','{"safety":"hands_free_no_screen_interaction_while_driving","teaching_style":"audio_immersion_with_light_english_support"}'::jsonb from track
  returning id
), items as (
  insert into public.hebrew_spoken_items (lesson_id,sort_order,item_type,hebrew_text,transliteration,english_text,usage_note,speaker_context,tags)
  select lesson.id,v.sort_order,v.item_type,v.hebrew_text,v.transliteration,v.english_text,v.usage_note,'any',v.tags from lesson
  cross join (values
    (10,'phrase','שלום','shalom','hello / hi','The standard all-purpose greeting.',array['greeting','core']::text[]),
    (20,'phrase','בוקר טוב','boker tov','good morning','Common morning greeting.',array['greeting','morning']::text[]),
    (30,'phrase','מה נשמע?','ma nishma?','how is it going? / what is up?','Very common casual greeting question.',array['greeting','casual']::text[]),
    (40,'response','טוב, תודה','tov, toda','good, thanks','Simple response to a greeting question.',array['response','core']::text[]),
    (50,'phrase','נעים מאוד','na''im me''od','nice to meet you','Useful when meeting someone for the first time.',array['introduction','polite']::text[]),
    (60,'phrase','להתראות','lehitra''ot','goodbye / see you','Standard goodbye meaning roughly see you again.',array['goodbye','core']::text[])
  ) v(sort_order,item_type,hebrew_text,transliteration,english_text,usage_note,tags)
  returning id,lesson_id,sort_order
)
insert into public.hebrew_spoken_segments (lesson_id,item_id,sort_order,segment_type,label,spoken_text,display_text,voice_profile,voice_instructions,speech_settings,pause_after_ms,status)
select l.id,i.id,s.sort_order,s.segment_type,s.label,s.spoken_text,s.display_text,'cedar',s.voice_instructions,s.speech_settings,s.pause_after_ms,case when s.segment_type='silence' then 'skipped' else 'pending' end
from lesson l
cross join (values
  (10,null::integer,'coach','Introduction','Spoken Hebrew, lesson one: greetings. This is hands-free practice. If you are driving, keep your eyes on the road and do not touch the screen. I will say a phrase, give you space to repeat it, and then test your recall.','Spoken Hebrew — Greetings 1','Coach warmly in clear English. Do not rush.','{"speed":0.95}'::jsonb,1000),
  (20,10,'coach','Hello cue','First: hello, or hi.','Hello / hi','Coach in English.','{"speed":1}'::jsonb,500),
  (30,10,'hebrew_slow','Shalom slow','שלום','שלום — shalom','Speak only the Hebrew phrase in clear Modern Israeli Hebrew, slightly slowly.','{"speed":0.82}'::jsonb,2500),
  (40,null::integer,'silence','Repeat pause','','','','{"speed":1}'::jsonb,2500),
  (50,10,'hebrew_natural','Shalom natural','שלום','שלום — shalom','Speak only the Hebrew phrase naturally in Modern Israeli Hebrew.','{"speed":1}'::jsonb,1200),
  (60,20,'coach','Good morning cue','Now: good morning.','Good morning','Coach in English.','{"speed":1}'::jsonb,500),
  (70,20,'hebrew_slow','Boker tov slow','בוקר טוב','בוקר טוב — boker tov','Speak only the Hebrew phrase in clear Modern Israeli Hebrew, slightly slowly.','{"speed":0.82}'::jsonb,2500),
  (80,null::integer,'silence','Repeat pause','','','','{"speed":1}'::jsonb,2500),
  (90,20,'hebrew_natural','Boker tov natural','בוקר טוב','בוקר טוב — boker tov','Speak only the Hebrew phrase naturally in Modern Israeli Hebrew.','{"speed":1}'::jsonb,1200),
  (100,30,'coach','How is it going cue','Now a very common casual question: how is it going? Listen.','How is it going?','Coach in English.','{"speed":1}'::jsonb,500),
  (110,30,'hebrew_slow','Ma nishma slow','מה נשמע?','מה נשמע? — ma nishma?','Speak only the Hebrew phrase in clear Modern Israeli Hebrew, slightly slowly.','{"speed":0.82}'::jsonb,2500),
  (120,null::integer,'silence','Repeat pause','','','','{"speed":1}'::jsonb,2500),
  (130,30,'hebrew_natural','Ma nishma natural','מה נשמע?','מה נשמע? — ma nishma?','Speak only the Hebrew phrase naturally in Modern Israeli Hebrew.','{"speed":1}'::jsonb,1200),
  (140,40,'coach','Good thanks cue','Answer: good, thanks.','Good, thanks','Coach in English.','{"speed":1}'::jsonb,500),
  (150,40,'hebrew_slow','Tov toda slow','טוב, תודה','טוב, תודה — tov, toda','Speak only the Hebrew phrase in clear Modern Israeli Hebrew, slightly slowly.','{"speed":0.82}'::jsonb,2500),
  (160,null::integer,'silence','Repeat pause','','','','{"speed":1}'::jsonb,2500),
  (170,40,'hebrew_natural','Tov toda natural','טוב, תודה','טוב, תודה — tov, toda','Speak only the Hebrew phrase naturally in Modern Israeli Hebrew.','{"speed":1}'::jsonb,1200),
  (180,50,'coach','Nice to meet you cue','Now: nice to meet you.','Nice to meet you','Coach in English.','{"speed":1}'::jsonb,500),
  (190,50,'hebrew_slow','Naim meod slow','נעים מאוד','נעים מאוד — na''im me''od','Speak only the Hebrew phrase in clear Modern Israeli Hebrew, slightly slowly.','{"speed":0.82}'::jsonb,2500),
  (200,null::integer,'silence','Repeat pause','','','','{"speed":1}'::jsonb,2500),
  (210,50,'hebrew_natural','Naim meod natural','נעים מאוד','נעים מאוד — na''im me''od','Speak only the Hebrew phrase naturally in Modern Israeli Hebrew.','{"speed":1}'::jsonb,1200),
  (220,60,'coach','Goodbye cue','Last new phrase: goodbye, or see you.','Goodbye / see you','Coach in English.','{"speed":1}'::jsonb,500),
  (230,60,'hebrew_slow','Lehitraot slow','להתראות','להתראות — lehitra''ot','Speak only the Hebrew phrase in clear Modern Israeli Hebrew, slightly slowly.','{"speed":0.82}'::jsonb,2500),
  (240,null::integer,'silence','Repeat pause','','','','{"speed":1}'::jsonb,2500),
  (250,60,'hebrew_natural','Lehitraot natural','להתראות','להתראות — lehitra''ot','Speak only the Hebrew phrase naturally in Modern Israeli Hebrew.','{"speed":1}'::jsonb,1200),
  (260,10,'recall_prompt','Recall hello','Recall round. How do you say hello? Say it before I do.','Recall: hello','Coach in English and leave the learner thinking space.','{"speed":1}'::jsonb,3500),
  (270,10,'hebrew_natural','Recall answer hello','שלום','שלום — shalom','Speak only the Hebrew answer naturally.','{"speed":1}'::jsonb,1000),
  (280,20,'recall_prompt','Recall good morning','How do you say good morning?','Recall: good morning','Coach in English and leave the learner thinking space.','{"speed":1}'::jsonb,3500),
  (290,20,'hebrew_natural','Recall answer morning','בוקר טוב','בוקר טוב — boker tov','Speak only the Hebrew answer naturally.','{"speed":1}'::jsonb,1000),
  (300,30,'recall_prompt','Recall how is it going','How do you casually ask, how is it going?','Recall: how is it going?','Coach in English and leave the learner thinking space.','{"speed":1}'::jsonb,3500),
  (310,30,'hebrew_natural','Recall answer how is it going','מה נשמע?','מה נשמע? — ma nishma?','Speak only the Hebrew answer naturally.','{"speed":1}'::jsonb,1000),
  (320,40,'recall_prompt','Recall good thanks','How do you answer, good, thanks?','Recall: good, thanks','Coach in English and leave the learner thinking space.','{"speed":1}'::jsonb,3500),
  (330,40,'hebrew_natural','Recall answer good thanks','טוב, תודה','טוב, תודה — tov, toda','Speak only the Hebrew answer naturally.','{"speed":1}'::jsonb,1000),
  (340,50,'recall_prompt','Recall nice to meet you','How do you say nice to meet you?','Recall: nice to meet you','Coach in English and leave the learner thinking space.','{"speed":1}'::jsonb,3500),
  (350,50,'hebrew_natural','Recall answer nice to meet you','נעים מאוד','נעים מאוד — na''im me''od','Speak only the Hebrew answer naturally.','{"speed":1}'::jsonb,1000),
  (360,60,'recall_prompt','Recall goodbye','How do you say goodbye, or see you?','Recall: goodbye','Coach in English and leave the learner thinking space.','{"speed":1}'::jsonb,3500),
  (370,60,'hebrew_natural','Recall answer goodbye','להתראות','להתראות — lehitra''ot','Speak only the Hebrew answer naturally.','{"speed":1}'::jsonb,1000),
  (380,null::integer,'dialogue','Mini dialogue setup','Mini dialogue. Imagine you meet someone in the morning. I will play both sides once. Then you repeat your side.','Mini dialogue','Coach naturally in English.','{"speed":1}'::jsonb,1000),
  (390,null::integer,'dialogue','Dialogue A','בוקר טוב. מה נשמע?','בוקר טוב. מה נשמע?','Speak the Hebrew naturally as one friendly speaker.','{"speed":0.95}'::jsonb,800),
  (400,null::integer,'dialogue','Dialogue B','טוב, תודה. נעים מאוד.','טוב, תודה. נעים מאוד.','Speak the Hebrew naturally as the responding speaker.','{"speed":0.95}'::jsonb,1800),
  (410,null::integer,'dialogue','Dialogue goodbye','להתראות','להתראות','Speak the Hebrew naturally.','{"speed":0.95}'::jsonb,1500),
  (420,null::integer,'recap','Recap','That is lesson one. Today you learned shalom, boker tov, ma nishma, tov toda, na''im me''od, and lehitra''ot. The goal is not perfection. Hear it often, say it out loud, and let the sounds become familiar.','Lesson complete','Coach warmly in English. Pronounce the transliterated Hebrew carefully.','{"speed":0.95}'::jsonb,0)
) s(sort_order,item_sort_order,segment_type,label,spoken_text,display_text,voice_instructions,speech_settings,pause_after_ms)
left join items i on i.sort_order=s.item_sort_order;

insert into public.hebrew_spoken_lessons (track_id,slug,title,topic,summary,level,lesson_order,objectives,estimated_minutes,script_version,status,audio_status,metadata)
select t.id,x.slug,x.title,x.topic,x.summary,'starter',x.lesson_order,x.objectives,10,'v1','draft','none',x.metadata
from public.hebrew_spoken_tracks t
cross join (values
  ('greetings-02','Greetings 2: How Are You?','greetings','Learn common ways to ask how someone is doing and respond naturally.',2,'["Ask how someone is doing","Hear male/female pronunciation differences","Give simple positive and neutral answers"]'::jsonb,'{"planned":true}'::jsonb),
  ('introductions-01','Introductions 1: My Name Is...','introductions','Say your name, ask someone else their name, and say where you are from.',3,'["Say my name is","Ask what is your name","Say I am from..."]'::jsonb,'{"planned":true}'::jsonb),
  ('courtesy-01','Courtesy 1: Please and Thank You','courtesy','Build the polite survival phrases used constantly in everyday conversation.',4,'["Say please","Say thank you","Say excuse me / sorry","Respond politely"]'::jsonb,'{"planned":true}'::jsonb),
  ('numbers-01','Numbers 1: One Through Ten','numbers','Recognize and say the first ten numbers in spoken Hebrew.',5,'["Recognize 1 through 10","Say 1 through 10","Use numbers in tiny prompts"]'::jsonb,'{"planned":true}'::jsonb),
  ('coffee-food-01','Coffee and Food 1: Ordering Simply','food','Order a simple drink or food item and use please and thank you.',6,'["Ask for a coffee","Say I would like","Use please and thank you in an order"]'::jsonb,'{"planned":true}'::jsonb),
  ('directions-01','Directions 1: Where Is...?','directions','Ask where a place is and understand a few basic directional words.',7,'["Ask where is","Recognize here / there","Recognize right / left"]'::jsonb,'{"planned":true}'::jsonb),
  ('family-01','Family 1: Talking About My Family','family','Use basic family words and say simple sentences about family.',8,'["Name close family members","Say I have","Say this is my..."]'::jsonb,'{"planned":true}'::jsonb),
  ('daily-verbs-01','Daily Verbs 1: Want, Need, Go, Come','verbs','Practice a small set of high-value verbs for everyday communication.',9,'["Recognize four core verbs","Build tiny first-person phrases","Respond to simple prompts"]'::jsonb,'{"planned":true}'::jsonb),
  ('conversation-01','Conversation 1: First Mini Conversation','conversation','Combine greetings, introductions, courtesy, and simple questions in one short exchange.',10,'["Follow a short conversation","Respond from memory","Shadow a natural-speed exchange"]'::jsonb,'{"planned":true}'::jsonb)
) x(slug,title,topic,summary,lesson_order,objectives,metadata)
where t.slug='spoken-hebrew-foundations';

insert into public.hebrew_spoken_settings (user_id,track_id,current_lesson_id,current_item_order,learning_goal,audio_first,preferred_mode,preferred_tts_provider,preferred_voice,target_session_minutes,translation_support,metadata)
select u.id,t.id,l.id,1,'Learn to understand and speak conversational Modern Israeli Hebrew through hands-free audio lessons while preserving Biblical Hebrew as a separate study lane.',true,'drive','openai','cedar',10,'light','{"started_from":"chatgpt","started_topic":"greetings","started_on":"2026-08-11","biblical_hebrew_separate_track":true}'::jsonb
from (select id from auth.users order by created_at asc limit 1) u
join public.hebrew_spoken_tracks t on t.slug='spoken-hebrew-foundations'
join public.hebrew_spoken_lessons l on l.slug='greetings-01'
on conflict (user_id) do update set track_id=excluded.track_id,current_lesson_id=excluded.current_lesson_id,current_item_order=excluded.current_item_order,learning_goal=excluded.learning_goal,audio_first=excluded.audio_first,preferred_mode=excluded.preferred_mode,preferred_tts_provider=excluded.preferred_tts_provider,preferred_voice=excluded.preferred_voice,target_session_minutes=excluded.target_session_minutes,translation_support=excluded.translation_support,metadata=public.hebrew_spoken_settings.metadata || excluded.metadata,updated_at=now();

insert into public.hebrew_spoken_lesson_progress (user_id,lesson_id,status,mastery_score,current_item_order,notes)
select u.id,l.id,'learning',0,1,'Current spoken-Hebrew focus: Greetings 1.'
from (select id from auth.users order by created_at asc limit 1) u
join public.hebrew_spoken_lessons l on l.slug='greetings-01'
on conflict (user_id,lesson_id) do update set status='learning',current_item_order=1,notes='Current spoken-Hebrew focus: Greetings 1.',updated_at=now();
