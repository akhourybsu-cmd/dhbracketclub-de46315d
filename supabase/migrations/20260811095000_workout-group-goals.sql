-- ═══════════════════════════════════════════════════════════════════
-- WORKOUT COMPETITION — collaborative group goals
--
-- A shared, club-wide target for a competition week, e.g. "Complete
-- 10,000 squats together this week." Progress is the COMBINED raw total
-- of every member's activity for the chosen exercise in that week —
-- derived on read from workout_activities, never a stored counter.
--
-- Members read; club admins author. One goal is scoped to one week +
-- one exercise for phase one.
-- ═══════════════════════════════════════════════════════════════════

create table if not exists public.workout_group_goals (
  id          uuid        primary key default gen_random_uuid(),
  club_id     uuid        not null references public.clubs(id) on delete cascade,
  week_id     uuid        not null references public.workout_weeks(id) on delete cascade,
  exercise_id uuid        not null references public.workout_exercises(id) on delete cascade,
  title       text        not null,
  target      numeric     not null check (target > 0),
  created_by  uuid        references auth.users(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists idx_workout_group_goals_week on public.workout_group_goals(week_id);

drop trigger if exists trg_workout_group_goals_updated_at on public.workout_group_goals;
create trigger trg_workout_group_goals_updated_at
  before update on public.workout_group_goals
  for each row execute procedure public.set_updated_at();

alter table public.workout_group_goals enable row level security;

drop policy if exists "Members read workout group goals" on public.workout_group_goals;
drop policy if exists "Admins manage workout group goals" on public.workout_group_goals;

create policy "Members read workout group goals"
  on public.workout_group_goals for select to authenticated
  using (exists (select 1 from public.club_members
    where club_id = workout_group_goals.club_id and user_id = auth.uid()));

create policy "Admins manage workout group goals"
  on public.workout_group_goals for all to authenticated
  using (exists (select 1 from public.club_members
    where club_id = workout_group_goals.club_id and user_id = auth.uid() and role = 'admin'))
  with check (exists (select 1 from public.club_members
    where club_id = workout_group_goals.club_id and user_id = auth.uid() and role = 'admin'));
