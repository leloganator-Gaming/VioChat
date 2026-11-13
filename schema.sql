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
