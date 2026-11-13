-- VioChat : à exécuter dans Supabase > SQL Editor > New query.
-- Ce script crée les profils et active les règles de sécurité RLS.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  created_at timestamptz not null default now(),
  constraint username_format check (username ~ '^[A-Za-z0-9_]{3,20}$')
);

alter table public.profiles enable row level security;

-- Les membres connectés peuvent consulter les profils.
create policy "Profiles are visible to authenticated users"
on public.profiles for select
to authenticated
using (true);

-- Chaque membre peut modifier uniquement son propre profil.
create policy "Members can update their own profile"
on public.profiles for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

-- Création automatique du profil lors de l'inscription.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, username)
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data ->> 'username', ''),
      'Membre_' || substr(new.id::text, 1, 8)
    )
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

-- IMPORTANT : ne jamais mettre la clé service_role dans config.js.
-- Utiliser uniquement la clé publishable/anon côté navigateur.


-- === MESSAGERIE PRIVEE ET AVATARS 3D ===
alter table public.profiles
  add column if not exists avatar_config jsonb not null
  default '{"skin":"#d99a70","hair":"#51302a","shirt":"#8d45df","style":"short"}'::jsonb;

create table if not exists public.direct_chats (
  id uuid primary key default gen_random_uuid(),
  user_a uuid not null references auth.users(id) on delete cascade,
  user_b uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint direct_chat_distinct_users check (user_a <> user_b),
  constraint direct_chat_pair_unique unique (user_a,user_b)
);
alter table public.direct_chats enable row level security;

drop policy if exists "Members can view their direct chats" on public.direct_chats;
create policy "Members can view their direct chats"
on public.direct_chats for select to authenticated
using (auth.uid() = user_a or auth.uid() = user_b);

drop policy if exists "Members can create their direct chats" on public.direct_chats;
create policy "Members can create their direct chats"
on public.direct_chats for insert to authenticated
with check ((auth.uid() = user_a or auth.uid() = user_b) and user_a <> user_b);

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references public.direct_chats(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  content text not null check (char_length(content) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index if not exists chat_messages_chat_created_idx
on public.chat_messages(chat_id,created_at);

alter table public.chat_messages enable row level security;

drop policy if exists "Chat members can read messages" on public.chat_messages;
create policy "Chat members can read messages"
on public.chat_messages for select to authenticated
using (exists (
  select 1 from public.direct_chats c
  where c.id = chat_id and (c.user_a = auth.uid() or c.user_b = auth.uid())
));

drop policy if exists "Chat members can send their own messages" on public.chat_messages;
create policy "Chat members can send their own messages"
on public.chat_messages for insert to authenticated
with check (
  sender_id = auth.uid()
  and exists (
    select 1 from public.direct_chats c
    where c.id = chat_id and (c.user_a = auth.uid() or c.user_b = auth.uid())
  )
);

-- Active les mises à jour en temps réel pour les messages.
do $$
begin
  alter publication supabase_realtime add table public.chat_messages;
exception when duplicate_object then
  null;
when undefined_object then
  raise notice 'Publication supabase_realtime indisponible : active-la dans Supabase > Database > Publications.';
end $$;


-- Crée aussi un profil pour les comptes qui existaient avant l'installation du déclencheur.
insert into public.profiles (id, username)
select u.id,
       coalesce(nullif(u.raw_user_meta_data ->> 'username',''),
                'Membre_' || substr(u.id::text,1,8))
from auth.users u
on conflict (id) do nothing;


-- === FONCTIONS SOCIALES : AMIS, STORIES ET NOTIFICATIONS ===
create table if not exists public.friend_requests (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references auth.users(id) on delete cascade,
  receiver_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted')),
  created_at timestamptz not null default now(),
  constraint friend_request_not_self check (sender_id <> receiver_id),
  constraint friend_request_pair_unique unique(sender_id,receiver_id)
);
alter table public.friend_requests enable row level security;
drop policy if exists "Users can view their friend requests" on public.friend_requests;
create policy "Users can view their friend requests" on public.friend_requests
for select to authenticated using (auth.uid()=sender_id or auth.uid()=receiver_id);
drop policy if exists "Users can send friend requests" on public.friend_requests;
create policy "Users can send friend requests" on public.friend_requests
for insert to authenticated with check (auth.uid()=sender_id and sender_id<>receiver_id and status='pending');
drop policy if exists "Receivers can accept requests" on public.friend_requests;
create policy "Receivers can accept requests" on public.friend_requests
for update to authenticated using (auth.uid()=receiver_id) with check (auth.uid()=receiver_id and status='accepted');
drop policy if exists "Participants can remove requests" on public.friend_requests;
create policy "Participants can remove requests" on public.friend_requests
for delete to authenticated using (auth.uid()=sender_id or auth.uid()=receiver_id);

create table if not exists public.stories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  storage_path text not null,
  caption text not null default '',
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours')
);
alter table public.stories enable row level security;
drop policy if exists "Friends can view active stories" on public.stories;
create policy "Friends can view active stories" on public.stories
for select to authenticated using (
  expires_at > now() and (
    user_id=auth.uid() or exists (
      select 1 from public.friend_requests fr
      where fr.status='accepted' and (
        (fr.sender_id=auth.uid() and fr.receiver_id=stories.user_id) or
        (fr.receiver_id=auth.uid() and fr.sender_id=stories.user_id)
      )
    )
  )
);
drop policy if exists "Users can publish own stories" on public.stories;
create policy "Users can publish own stories" on public.stories
for insert to authenticated with check (auth.uid()=user_id);
drop policy if exists "Users can delete own stories" on public.stories;
create policy "Users can delete own stories" on public.stories
for delete to authenticated using (auth.uid()=user_id);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  kind text not null,
  content text not null,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_created_idx on public.notifications(user_id,created_at desc);
alter table public.notifications enable row level security;
drop policy if exists "Users can read own notifications" on public.notifications;
create policy "Users can read own notifications" on public.notifications
for select to authenticated using (auth.uid()=user_id);
drop policy if exists "Users can receive notifications" on public.notifications;
create policy "Users can receive notifications" on public.notifications
for insert to authenticated with check (
  auth.uid()=actor_id and user_id<>auth.uid() and exists (
    select 1 from public.friend_requests fr
    where (fr.sender_id=auth.uid() and fr.receiver_id=notifications.user_id)
       or (fr.receiver_id=auth.uid() and fr.sender_id=notifications.user_id)
  )
);
drop policy if exists "Users can update own notifications" on public.notifications;
create policy "Users can update own notifications" on public.notifications
for update to authenticated using (auth.uid()=user_id) with check (auth.uid()=user_id);
drop policy if exists "Users can delete own notifications" on public.notifications;
create policy "Users can delete own notifications" on public.notifications
for delete to authenticated using (auth.uid()=user_id);

-- Stockage privé des stories (photos et vidéos).
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('viochat-stories','viochat-stories',false,52428800,array['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm','video/quicktime'])
on conflict (id) do update set public=false,file_size_limit=52428800,allowed_mime_types=excluded.allowed_mime_types;
drop policy if exists "Members upload own story media" on storage.objects;
create policy "Members upload own story media" on storage.objects
for insert to authenticated with check (bucket_id='viochat-stories' and (storage.foldername(name))[1]=auth.uid()::text);
drop policy if exists "Members read own and friends story media" on storage.objects;
create policy "Members read own and friends story media" on storage.objects
for select to authenticated using (
  bucket_id='viochat-stories' and (
    (storage.foldername(name))[1]=auth.uid()::text or exists (
      select 1 from public.friend_requests fr
      where fr.status='accepted' and (
        (fr.sender_id=auth.uid() and fr.receiver_id=(storage.foldername(name))[1]::uuid) or
        (fr.receiver_id=auth.uid() and fr.sender_id=(storage.foldername(name))[1]::uuid)
      )
    )
  )
);
drop policy if exists "Members delete own story media" on storage.objects;
create policy "Members delete own story media" on storage.objects
for delete to authenticated using (bucket_id='viochat-stories' and (storage.foldername(name))[1]=auth.uid()::text);
