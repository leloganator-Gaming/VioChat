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
