-- ═══════════════════════════════════════════════════════════════════
-- WORKOUT COMPETITION — engine foundation
--
-- An asynchronous weekly social fitness competition, built as a
-- configuration-driven ENGINE rather than a set of hardcoded workouts.
--
-- Tables:
--   1. workout_exercises       — the universal ExerciseDefinition. A
--                                measurement_type + JSONB configs drive
--                                which logger UI the player receives and
--                                how the activity is scored.
--   2. workout_weeks           — a competition period with explicit
--                                starts_at/ends_at (never assume Mon–Sun).
--   3. workout_week_exercises  — which exercises are in a week, with
--                                per-week goal + scoring override.
--   4. workout_activities      — the AUTHORITATIVE append-only activity
--                                log. Competition score, XP, records,
--                                milestones and the leaderboard are all
--                                DERIVED from these rows (client never
--                                submits computed totals — only raw_value).
--
-- Design notes:
--   • measurement_type ∈ reps | timed_hold | duration | countdown |
--       distance | steps | sets_reps | rounds | completion.
--   • raw_value is always stored in the exercise's canonical unit
--       (reps count, seconds for time, miles for distance, …).
--   • source_type defaults to 'manual'; the column + source_activity_id
--       dedup key exist NOW so future Apple Health / Fitbit / Garmin
--       imports use the SAME normalized activity model — only the source
--       changes. No integrations are built in this phase.
--   • activity_local_date carries the user's LOCAL calendar date so
--       streaks are computed tz-correctly without trusting server UTC.
--   • Scoring lives in the client lib (src/lib/workout/scoring.ts),
--       mirroring how every other DH game scores in TS. competition_points
--       / xp_awarded columns are reserved (nullable) for a future
--       end-of-week server-side snapshot; phase one derives live on read.
--   • RLS is the security boundary: members of a club read that club's
--       workout data; only club admins author exercises/weeks; users only
--       write their own activity; admins may correct/remove activity.
--
-- Reuses the existing public.set_updated_at() trigger function (defined
-- in the asset-library migration) — not redefined here.
-- ═══════════════════════════════════════════════════════════════════

-- ─── Asset catalogue row ────────────────────────────────────────────
insert into public.platform_assets
  (name, slug, category, short_description, full_description, icon_name, placement_area, requires_configuration, is_premium, sort_order)
values
  ('Workout Arena', 'workout-competition', 'games',
   'A weekly, at-home fitness competition your club plays by exercising.',
   'Workout Arena turns exercise into a competitive social game. Admins build weekly competitions from a library of configurable workouts — reps, timed holds, distances, circuits and more — each with its own goal and scoring. Members log activity in seconds with a logger purpose-built for that workout (a counter for push-ups, a timer for planks, a round tracker for circuits) and watch their score, records and leaderboard position move in real time.',
   'Dumbbell', 'games', true, false, 175)
on conflict (slug) do update set
  name                   = excluded.name,
  short_description      = excluded.short_description,
  full_description       = excluded.full_description,
  icon_name              = excluded.icon_name,
  category               = excluded.category,
  placement_area         = excluded.placement_area,
  requires_configuration = excluded.requires_configuration,
  sort_order             = excluded.sort_order,
  is_active              = true;

-- ─── 1. Exercise definitions ────────────────────────────────────────
create table if not exists public.workout_exercises (
  id                 uuid        primary key default gen_random_uuid(),
  club_id            uuid        not null references public.clubs(id) on delete cascade,
  name               text        not null,
  short_description  text,
  instructions       text,
  category           text        not null default 'other',
  measurement_type   text        not null,
  unit               text        not null default 'reps',
  -- Per-type logging behaviour: quick_add[], timer_mode, allow_pause,
  -- allow_manual, countdown_seconds, round_definition, default_sets, …
  logging_config     jsonb       not null default '{}'::jsonb,
  -- points_per_unit, max_weekly_points, xp_per_unit
  scoring_config     jsonb       not null default '{}'::jsonb,
  default_weekly_goal numeric,
  -- lifetime:[…], session:[…] threshold arrays (exercise's canonical unit)
  milestone_config   jsonb       not null default '{}'::jsonb,
  icon_name          text,
  active             boolean     not null default true,
  sort_order         integer     not null default 0,
  created_by         uuid        references auth.users(id),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint workout_exercises_measurement_type_chk check (
    measurement_type in ('reps','timed_hold','duration','countdown','distance','steps','sets_reps','rounds','completion')
  )
);
create index if not exists idx_workout_exercises_club on public.workout_exercises(club_id);
create index if not exists idx_workout_exercises_club_active on public.workout_exercises(club_id, active);

drop trigger if exists trg_workout_exercises_updated_at on public.workout_exercises;
create trigger trg_workout_exercises_updated_at
  before update on public.workout_exercises
  for each row execute procedure public.set_updated_at();

-- ─── 2. Competition weeks ───────────────────────────────────────────
create table if not exists public.workout_weeks (
  id             uuid        primary key default gen_random_uuid(),
  club_id        uuid        not null references public.clubs(id) on delete cascade,
  title          text        not null,
  theme          text,
  starts_at      timestamptz not null,
  ends_at        timestamptz not null,
  status         text        not null default 'upcoming',
  scoring_config jsonb       not null default '{}'::jsonb,
  created_by     uuid        references auth.users(id),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint workout_weeks_status_chk check (status in ('upcoming','active','completed')),
  constraint workout_weeks_dates_chk  check (ends_at > starts_at)
);
create index if not exists idx_workout_weeks_club on public.workout_weeks(club_id);
create index if not exists idx_workout_weeks_club_status on public.workout_weeks(club_id, status);

drop trigger if exists trg_workout_weeks_updated_at on public.workout_weeks;
create trigger trg_workout_weeks_updated_at
  before update on public.workout_weeks
  for each row execute procedure public.set_updated_at();

-- ─── 3. Week ⇄ exercise join (per-week goal + scoring override) ──────
create table if not exists public.workout_week_exercises (
  id             uuid        primary key default gen_random_uuid(),
  week_id        uuid        not null references public.workout_weeks(id) on delete cascade,
  exercise_id    uuid        not null references public.workout_exercises(id) on delete cascade,
  goal           numeric,
  scoring_config jsonb       not null default '{}'::jsonb,
  sort_order     integer     not null default 0,
  created_at     timestamptz not null default now(),
  unique (week_id, exercise_id)
);
create index if not exists idx_workout_week_exercises_week on public.workout_week_exercises(week_id);

-- ─── 4. Authoritative activity log ──────────────────────────────────
create table if not exists public.workout_activities (
  id                 uuid        primary key default gen_random_uuid(),
  club_id            uuid        not null references public.clubs(id) on delete cascade,
  user_id            uuid        not null references auth.users(id),
  week_id            uuid        references public.workout_weeks(id) on delete set null,
  exercise_id        uuid        not null references public.workout_exercises(id) on delete cascade,
  measurement_type   text        not null,
  raw_value          numeric     not null,
  unit               text        not null,
  started_at         timestamptz,
  ended_at           timestamptz,
  logged_at          timestamptz not null default now(),
  activity_local_date date       not null,
  source_type        text        not null default 'manual',
  source_activity_id text,
  metadata           jsonb       not null default '{}'::jsonb,
  -- Reserved for a future end-of-week authoritative snapshot; phase one
  -- derives score/XP live on read and leaves these null.
  competition_points numeric,
  xp_awarded         numeric,
  status             text        not null default 'active',
  created_at         timestamptz not null default now(),
  constraint workout_activities_value_chk  check (raw_value > 0),
  constraint workout_activities_status_chk check (status in ('active','voided')),
  constraint workout_activities_source_chk check (
    source_type in ('manual','apple_health','health_connect','fitbit','garmin','other')
  )
);
create index if not exists idx_workout_activities_week_user on public.workout_activities(week_id, user_id) where status = 'active';
create index if not exists idx_workout_activities_user_ex   on public.workout_activities(user_id, exercise_id) where status = 'active';
create index if not exists idx_workout_activities_club      on public.workout_activities(club_id) where status = 'active';
-- Dedup key for future external-source imports (manual rows keep NULL).
create unique index if not exists uq_workout_activities_source
  on public.workout_activities(source_type, source_activity_id)
  where source_activity_id is not null;

-- ═══ RLS ════════════════════════════════════════════════════════════
alter table public.workout_exercises       enable row level security;
alter table public.workout_weeks           enable row level security;
alter table public.workout_week_exercises  enable row level security;
alter table public.workout_activities      enable row level security;

-- Exercises: any club member reads; club admins manage.
drop policy if exists "Members read workout exercises"  on public.workout_exercises;
drop policy if exists "Admins manage workout exercises"  on public.workout_exercises;
create policy "Members read workout exercises"
  on public.workout_exercises for select to authenticated
  using (exists (select 1 from public.club_members
    where club_id = workout_exercises.club_id and user_id = auth.uid()));
create policy "Admins manage workout exercises"
  on public.workout_exercises for all to authenticated
  using (exists (select 1 from public.club_members
    where club_id = workout_exercises.club_id and user_id = auth.uid() and role = 'admin'))
  with check (exists (select 1 from public.club_members
    where club_id = workout_exercises.club_id and user_id = auth.uid() and role = 'admin'));

-- Weeks: any club member reads; club admins manage.
drop policy if exists "Members read workout weeks"  on public.workout_weeks;
drop policy if exists "Admins manage workout weeks"  on public.workout_weeks;
create policy "Members read workout weeks"
  on public.workout_weeks for select to authenticated
  using (exists (select 1 from public.club_members
    where club_id = workout_weeks.club_id and user_id = auth.uid()));
create policy "Admins manage workout weeks"
  on public.workout_weeks for all to authenticated
  using (exists (select 1 from public.club_members
    where club_id = workout_weeks.club_id and user_id = auth.uid() and role = 'admin'))
  with check (exists (select 1 from public.club_members
    where club_id = workout_weeks.club_id and user_id = auth.uid() and role = 'admin'));

-- Week⇄exercise: members read (via the week's club); admins manage.
drop policy if exists "Members read workout week exercises" on public.workout_week_exercises;
drop policy if exists "Admins manage workout week exercises" on public.workout_week_exercises;
create policy "Members read workout week exercises"
  on public.workout_week_exercises for select to authenticated
  using (exists (
    select 1 from public.workout_weeks w
    join public.club_members cm on cm.club_id = w.club_id
    where w.id = workout_week_exercises.week_id and cm.user_id = auth.uid()));
create policy "Admins manage workout week exercises"
  on public.workout_week_exercises for all to authenticated
  using (exists (
    select 1 from public.workout_weeks w
    join public.club_members cm on cm.club_id = w.club_id
    where w.id = workout_week_exercises.week_id and cm.user_id = auth.uid() and cm.role = 'admin'))
  with check (exists (
    select 1 from public.workout_weeks w
    join public.club_members cm on cm.club_id = w.club_id
    where w.id = workout_week_exercises.week_id and cm.user_id = auth.uid() and cm.role = 'admin'));

-- Activities: members read all club activity (leaderboard/records);
-- a user inserts only their own; owners may delete their own (undo);
-- club admins may correct/remove any (moderation).
drop policy if exists "Members read workout activity"  on public.workout_activities;
drop policy if exists "Users log own workout activity"  on public.workout_activities;
drop policy if exists "Owners delete own workout activity" on public.workout_activities;
drop policy if exists "Admins moderate workout activity" on public.workout_activities;
create policy "Members read workout activity"
  on public.workout_activities for select to authenticated
  using (exists (select 1 from public.club_members
    where club_id = workout_activities.club_id and user_id = auth.uid()));
create policy "Users log own workout activity"
  on public.workout_activities for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.club_members
      where club_id = workout_activities.club_id and user_id = auth.uid()));
create policy "Owners delete own workout activity"
  on public.workout_activities for delete to authenticated
  using (user_id = auth.uid());
create policy "Admins moderate workout activity"
  on public.workout_activities for all to authenticated
  using (exists (select 1 from public.club_members
    where club_id = workout_activities.club_id and user_id = auth.uid() and role = 'admin'))
  with check (exists (select 1 from public.club_members
    where club_id = workout_activities.club_id and user_id = auth.uid() and role = 'admin'));

-- ─── Realtime: live leaderboard + progress ──────────────────────────
alter publication supabase_realtime add table public.workout_activities;
alter publication supabase_realtime add table public.workout_weeks;
