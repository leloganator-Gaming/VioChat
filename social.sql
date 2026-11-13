-- VioChat : migration sociale à exécuter une seule fois dans Supabase > SQL Editor.
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
for insert to authenticated with check (auth.uid()=actor_id);
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
