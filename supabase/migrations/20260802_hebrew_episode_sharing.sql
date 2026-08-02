-- Hebrew Audio Library — secure single-episode sharing
-- Additive migration. Shared links expose only one published audio track through
-- a server-side Vercel function. The browser never receives the service-role key.

create extension if not exists pgcrypto;

create table if not exists public.hebrew_episode_shares (
  id uuid primary key default gen_random_uuid(),
  track_id uuid not null unique references public.hebrew_audio_tracks(id) on delete cascade,
  share_token uuid not null unique default gen_random_uuid(),
  slug text not null default '',
  is_active boolean not null default true,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint hebrew_episode_shares_slug_length check (char_length(slug) <= 120)
);

create index if not exists hebrew_episode_shares_token_idx
  on public.hebrew_episode_shares (share_token)
  where is_active;

alter table public.hebrew_episode_shares enable row level security;

-- No public table policy is created on purpose. Shared episodes are retrieved
-- only by the server-side API after it validates the opaque token and confirms
-- that the linked track is still ready and published.
revoke all on table public.hebrew_episode_shares from public, anon, authenticated;
grant select, insert, update, delete on table public.hebrew_episode_shares to service_role;

comment on table public.hebrew_episode_shares is
  'Opaque, revocable links for sharing one published Hebrew audio episode.';
comment on column public.hebrew_episode_shares.share_token is
  'Unpredictable token used in the public /listen URL. Never list this table to browser roles.';
