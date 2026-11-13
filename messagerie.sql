-- VioChat : messagerie privee et avatars 3D
-- A executer une seule fois dans Supabase > SQL Editor > New query.

alter table public.profiles
  add column if not exists avatar_config jsonb not null
  default '{"skin":"#d99a70","hair":"#51302a","shirt":"#8d45df","style":"short"}'::jsonb;

-- Profil pour les comptes Supabase crees avant le declencheur de profils.
insert into public.profiles (id, username)
select u.id,
       coalesce(nullif(u.raw_user_meta_data ->> 'username',''),
                'Membre_' || substr(u.id::text,1,8))
from auth.users u
on conflict (id) do nothing;

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

-- Active les evenements temps reel pour les messages.
do $$
begin
  alter publication supabase_realtime add table public.chat_messages;
exception when duplicate_object then
  null;
when undefined_object then
  raise notice 'Publication supabase_realtime indisponible : active-la dans Database > Publications.';
end $$;
