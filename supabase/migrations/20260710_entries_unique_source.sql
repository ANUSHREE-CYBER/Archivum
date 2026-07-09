-- Prevent duplicate library entries: the same user picking the same API
-- search result twice should not create two rows.
--
-- This file is a RECORD of SQL applied manually in the Supabase dashboard
-- (SQL Editor) — there is no migration tooling in this repo, so nothing
-- runs these files automatically. The layout matches the Supabase CLI's
-- migrations format in case that's adopted later.
--
-- Applied on: 2026-07-10

-- A partial unique INDEX rather than a table constraint, because Postgres
-- unique constraints can't take a WHERE clause — and the WHERE is what
-- exempts manual entries (source_id IS NULL) from blocking each other.
-- The app relies on this: MediaSearch.tsx catches error code 23505 from
-- this index and shows "already in your library" instead of an error.
create unique index if not exists entries_user_source_unique
  on public.entries (user_id, source_api, source_id)
  where source_id is not null;

-- Pre-flight check: index creation fails if duplicates already exist.
-- Run this first; if it returns rows, run the cleanup below before creating
-- the index.
--
-- select user_id, source_api, source_id, count(*)
-- from public.entries
-- where source_id is not null
-- group by user_id, source_api, source_id
-- having count(*) > 1;

-- Cleanup (only if the check above found rows): removes the newer copies,
-- keeping the earliest-added row of each duplicate group.
--
-- delete from public.entries e
-- using public.entries keep
-- where e.user_id    = keep.user_id
--   and e.source_api = keep.source_api
--   and e.source_id  = keep.source_id
--   and e.source_id is not null
--   and e.created_at > keep.created_at;
