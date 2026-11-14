-- CampusVoice 1.0 database setup
-- Run this entire file in Supabase Dashboard > SQL Editor > New query.

create extension if not exists pgcrypto;

create table if not exists public.complaints (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 3 and 100),
  category text not null,
  description text not null check (char_length(description) between 10 and 2000),
  photo_path text,
  status text not null default 'pending'
    check (status in ('pending', 'in_progress', 'resolved')),
  created_at timestamptz not null default now()
);

alter table public.complaints enable row level security;

drop policy if exists "Signed-in students can view complaints" on public.complaints;
create policy "Signed-in students can view complaints"
on public.complaints for select to authenticated
using (true);

drop policy if exists "Students can submit their own complaints" on public.complaints;
create policy "Students can submit their own complaints"
on public.complaints for insert to authenticated
with check (auth.uid() = user_id);

-- Students cannot update/delete complaints in v1. Status updates can be added
-- later through a restricted admin workflow.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('complaint-photos', 'complaint-photos', false, 5242880,
        array['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
on conflict (id) do update set
  public = false,
  file_size_limit = 5242880,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

drop policy if exists "Signed-in students can view complaint photos" on storage.objects;
create policy "Signed-in students can view complaint photos"
on storage.objects for select to authenticated
using (bucket_id = 'complaint-photos');

drop policy if exists "Students can upload photos to their own folder" on storage.objects;
create policy "Students can upload photos to their own folder"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'complaint-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
);