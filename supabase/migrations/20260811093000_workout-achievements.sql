-- ═══════════════════════════════════════════════════════════════════
-- WORKOUT COMPETITION — achievement unlocks
--
-- Achievement DEFINITIONS live in the client (src/lib/workout/achievements.ts)
-- and their criteria are evaluated from the authoritative workout_activities
-- log. This table only persists the fact + timestamp of an unlock, so the
-- app knows which achievements a member has already earned (and doesn't
-- re-celebrate them). One row per (club, user, achievement_key).
--
-- Unlocks are immutable: a user may read + insert their own; club members
-- may read (to show each other's badges later); admins may correct.
-- ═══════════════════════════════════════════════════════════════════

create table if not exists public.workout_achievement_unlocks (
  id              uuid        primary key default gen_random_uuid(),
  club_id         uuid        not null references public.clubs(id) on delete cascade,
  user_id         uuid        not null references auth.users(id),
  achievement_key text        not null,
  unlocked_at     timestamptz not null default now(),
  metadata        jsonb       not null default '{}'::jsonb,
  unique (club_id, user_id, achievement_key)
);
create index if not exists idx_workout_ach_unlocks_user on public.workout_achievement_unlocks(club_id, user_id);

alter table public.workout_achievement_unlocks enable row level security;

drop policy if exists "Members read workout achievement unlocks" on public.workout_achievement_unlocks;
drop policy if exists "Users insert own workout achievement unlocks" on public.workout_achievement_unlocks;
drop policy if exists "Admins manage workout achievement unlocks" on public.workout_achievement_unlocks;

create policy "Members read workout achievement unlocks"
  on public.workout_achievement_unlocks for select to authenticated
  using (exists (select 1 from public.club_members
    where club_id = workout_achievement_unlocks.club_id and user_id = auth.uid()));

create policy "Users insert own workout achievement unlocks"
  on public.workout_achievement_unlocks for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.club_members
      where club_id = workout_achievement_unlocks.club_id and user_id = auth.uid()));

create policy "Admins manage workout achievement unlocks"
  on public.workout_achievement_unlocks for all to authenticated
  using (exists (select 1 from public.club_members
    where club_id = workout_achievement_unlocks.club_id and user_id = auth.uid() and role = 'admin'))
  with check (exists (select 1 from public.club_members
    where club_id = workout_achievement_unlocks.club_id and user_id = auth.uid() and role = 'admin'));
