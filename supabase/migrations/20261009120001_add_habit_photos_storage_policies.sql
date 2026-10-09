-- Migration: scoped storage policies for the private `habit-photos` bucket.
--
-- Run: `supabase db push`, or paste into Dashboard -> SQL Editor -> New query.
-- Safe to re-run: every policy is dropped before re-creating.
--
-- Object paths are `{user_id}/{habit_id}/{log_date}-{unique}.jpg`, so the
-- first path segment is always the owner's id and every policy scopes on it.
-- The bucket itself stays private: proofs resolve only through short-lived
-- signed URLs minted for the owning user.

drop policy if exists "habit-photos insert own" on storage.objects;
create policy "habit-photos insert own" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'habit-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "habit-photos read own" on storage.objects;
create policy "habit-photos read own" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'habit-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "habit-photos update own" on storage.objects;
create policy "habit-photos update own" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'habit-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'habit-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "habit-photos delete own" on storage.objects;
create policy "habit-photos delete own" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'habit-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
