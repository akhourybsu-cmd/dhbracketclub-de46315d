# DH Club — Claude Context

Mobile-first social/competition app for clubs. React + Vite + TypeScript + Supabase + Tailwind + shadcn/ui + framer-motion + lucide-react.

## Mental model

DH Club is a **multi-tenant club app**. Each user has a single active **club**; that club installs **assets/plugins** from a global catalog. Almost every UI surface gates on whether a given asset is installed for the current club.

```
Auth → Club → Installed Assets → Plugin UI surfaces (Home / Settings / Profile / Dedicated routes)
```

**Never assume a feature is available — always gate on `useClubAssets().isInstalled(slug)`.** If you want a quick "what slug am I checking?" answer, look in [`src/types/assets.ts`](src/types/assets.ts) → `NAV_ASSET_SLUGS`.

## Core systems (read these first)

| Concern | Where it lives |
|---|---|
| Authentication | [`src/contexts/AuthContext.tsx`](src/contexts/AuthContext.tsx) (`useAuth()`) |
| Active club + admin flag | [`src/contexts/ClubContext.tsx`](src/contexts/ClubContext.tsx) (`useClub()` → `club`, `membership`, `isClubAdmin`, `isPlatformOwner`, `isAppAdmin`) |
| Installed plugins | [`src/hooks/useClubAssets.ts`](src/hooks/useClubAssets.ts) — `installedAssets`, `allAssets`, `isInstalled(slug)`, optimistic install/uninstall/toggle with rollback, `pendingInstall/Uninstall/Toggle` sets |
| Asset catalog | `platform_assets` table (DB) — names, slugs, categories, descriptions, sort_order |
| Per-club installs | `club_installed_assets` table — joined `(club_id, asset_id)` with `enabled` + `visible_to_members` flags |
| Asset library UI | [`src/components/clubAssets/`](src/components/clubAssets/) — `ClubAssetLibrary`, `AssetCard`, `InstallAssetSheet` |
| Onboarding framework | [`src/lib/onboarding/`](src/lib/onboarding/) + [`src/components/onboarding/`](src/components/onboarding/) + [`src/hooks/useOnboarding.ts`](src/hooks/useOnboarding.ts) |
| Home screen orchestrator | [`src/pages/DashboardPage.tsx`](src/pages/DashboardPage.tsx) — slim composer of `home/` modules |
| Home modules | [`src/components/home/`](src/components/home/) — `HomeHero`, `QuickBar`, `RightNowCard`, `AssetLauncher`, `LeagueSnapshot`, `EventsStrip`, `ClubPulse`, `Highlights`, `MembersOnline`, `DiscoverStrip`, `EmptyClubState` |

## Asset/plugin system — how to add a new one

1. Insert a row into `platform_assets` via a Supabase migration (slug, name, category, short_description, full_description, icon_name, placement_area, sort_order).
2. (Optional) Create per-plugin tables + RLS policies in the same migration.
3. Add the slug → route to `NAV_ASSET_SLUGS` in [`src/types/assets.ts`](src/types/assets.ts) so nav filtering works.
4. Add an entry to the onboarding registry in [`src/lib/onboarding/registry.ts`](src/lib/onboarding/registry.ts) — the existing "What's New" flow will auto-surface a 3-step tutorial when the asset is installed.
5. Add the lazy route in [`src/App.tsx`](src/App.tsx).
6. Gate every plugin surface on `isInstalled('your-slug')`.
7. (Optional) Add per-plugin settings table and an admin panel — mount it inside `ClubSettingsPage` conditionally.

Existing slugs (canonical list in `NAV_ASSET_SLUGS`):
`draft-arena`, `rune-delve`, `nexus-defense`, `nfl-pickem`, `brackets`, `portfolio-wars`, `lockbox`, `chat`, `events`, `lore`, `feed`, `polls`, `rankings`, `posts`, `shared-media`, `birthdays-milestones`, `narrative-rpg`, `workout-competition`.

## Conventions

- **Mobile-first.** Bottom-sheet modals via `createPortal(node, document.body)` to escape transform contexts (PageTransition, framer-motion route wrappers). The first time someone forgets this, the sheet ends up positioned relative to a transformed ancestor instead of the viewport.
- **Tailwind + shadcn/ui.** Don't introduce new icon libraries; use `lucide-react`. Colors via `hsl(var(--...))` tokens — full set in [`src/index.css`](src/index.css).
- **Light/dark mode.** Always test both; never use raw hex/rgb that fails contrast in one mode.
- **`(supabase as any).from('...')`** is the pattern for tables whose types aren't in the generated Supabase types yet. Use real types once they're generated.
- **Optimistic updates with rollback** is the standard for mutations. Pattern: capture snapshot → optimistic state update → await Supabase call → catch + restore snapshot on error. See `useClubAssets` for the canonical implementation.
- **Stale-closure gotcha**: long-lived callbacks (toast onClick, portaled buttons) capture state at their creation time. If your mutator's `useCallback` depends on a state array and the array updates before the callback fires, you'll get stale reads. Mirror the array in a `useRef` updated via `useEffect`. See `useClubAssets.installedRef` for the canonical fix.
- **Perpetual-loading defense (REQUIRED for every data-loading hook)**: any `Promise.allSettled([...queries])` only resolves when EVERY query settles. A single hung Supabase fetch (dropped WebSocket, throttled background tab, network stall) traps the awaiter forever — `finally { setLoading(false) }` never runs and the user is stuck on a skeleton. **Always wrap each query and the outer race in [`withTimeout`](src/lib/asyncGuards.ts)** with `QUERY_TIMEOUT_MS` / `HYDRATE_TIMEOUT_MS`. Page-level skeletons should also expose a manual retry escape hatch after ~10s as a last-resort UX safety net (see `DetailSkeleton` in `NarrativeCampaignDetailPage.tsx`). Canonical hook implementation: [`useNarrativeCampaign.ts`](src/hooks/useNarrativeCampaign.ts) `refresh()`.
- **Onboarding for new plugins is automatic** — just register in `registry.ts`. The What's New flow + admin Preview button + first-time tour all pick it up.
- **RLS policies are the security boundary.** Hooks trust policies; don't double-filter unless you also need to hide rows from a client's local view (e.g., `visibility === 'hidden'`).

## Major features (last six months)

These are stable; reference them as patterns, don't reinvent.

| Feature | Surfaces | Key files |
|---|---|---|
| Compete reorg | `/compete` (banner list of installed games), `/drafts` (Drafts / Season / Commissioner tabs) | [`src/pages/CompetePage.tsx`](src/pages/CompetePage.tsx), [`src/pages/DraftsListPage.tsx`](src/pages/DraftsListPage.tsx) |
| Nexus Defense game refresh | Hub, Missions, Loadout, Battle, Results pages; engine path variants | [`src/lib/nexus/`](src/lib/nexus/), [`src/components/nexus/`](src/components/nexus/) |
| Rune Delve chamber layouts | Home, Level Map | [`src/lib/runedelve/runeLayouts.ts`](src/lib/runedelve/runeLayouts.ts), [`src/lib/runedelve/chamberAssignment.ts`](src/lib/runedelve/chamberAssignment.ts), [`src/components/runedelve/`](src/components/runedelve/) |
| Home redesign (club-aware mobile command center) | `/dashboard` | [`src/pages/DashboardPage.tsx`](src/pages/DashboardPage.tsx), [`src/components/home/`](src/components/home/) |
| Customizable QuickBar + screen-filling modules | Home dock + What's New, Members Online, Discover, Highlights | [`src/components/home/QuickBar.tsx`](src/components/home/QuickBar.tsx), [`src/components/home/useQuickBar.ts`](src/components/home/useQuickBar.ts) |
| Asset Library with optimistic install + undo | `/club/assets` | [`src/components/clubAssets/`](src/components/clubAssets/), [`src/hooks/useClubAssets.ts`](src/hooks/useClubAssets.ts) |
| Onboarding framework (club intro + What's New + admin preview) | Auto-mounts on Home + Asset Library | [`src/lib/onboarding/`](src/lib/onboarding/), [`src/components/onboarding/`](src/components/onboarding/), [`src/hooks/useOnboarding.ts`](src/hooks/useOnboarding.ts) |
| Birthdays & Milestones (first installable plugin) | `/celebrations`, Home widget, Club Settings panel, Profile section | [`src/components/celebrations/`](src/components/celebrations/), [`src/hooks/useCelebrations.ts`](src/hooks/useCelebrations.ts), [`src/lib/celebrations/dates.ts`](src/lib/celebrations/dates.ts) |
| Workout Arena (Workout Competition engine) | `/workouts` (member week screen: score, rank, per-exercise progress + few-seconds logging, leaderboard preview), `/workouts/admin` (admin: measurement-type-driven exercise builder + competition-week builder). Engine-driven: an exercise's `measurement_type` picks its logger. Loggers: Rep, Timer (timed hold), Duration, Countdown, Distance, Steps, Sets×Reps, Round, Completion — all writing ONE normalized `workout_activities` row. Score/XP/leaderboard/records/streaks/milestones are all **derived on read** in the scoring lib from raw values (client never submits computed totals). Timers are timestamp-based + localStorage-persisted (survive lock/background/reload). `source_type`/`source_activity_id` on activities make future Apple Health/Fitbit/Garmin imports use the same model — not built yet. | [`src/lib/workout/`](src/lib/workout/) (types, measurement registry, scoring, useStopwatch), [`src/components/workout/`](src/components/workout/) (WorkoutLoggers, WorkoutLoggerSheet, ExerciseForm), [`src/hooks/useWorkoutArena.ts`](src/hooks/useWorkoutArena.ts), [`src/hooks/useWorkoutAdmin.ts`](src/hooks/useWorkoutAdmin.ts), [`src/pages/WorkoutPage.tsx`](src/pages/WorkoutPage.tsx), [`src/pages/WorkoutAdminPage.tsx`](src/pages/WorkoutAdminPage.tsx), [`WorkoutRecapPage.tsx`](src/pages/WorkoutRecapPage.tsx), migrations `20260811090000_workout-competition.sql` + `20260811093000_workout-achievements.sql`. Achievements: definitions in [`src/lib/workout/achievements.ts`](src/lib/workout/achievements.ts) (evaluated from activity), unlocks persisted in `workout_achievement_unlocks`; completed-week recap at `/workouts/recap/:weekId` |
| Narrative RPG (Chronicle Engine) | `/narrative` campaigns list, `/narrative/new` proposal, `/narrative/:id` detail with Story/Characters/World/Log tabs + GM Console drawer (Scene · Chapters · NPCs · Clues · Items · Factions · Clocks · Memory · Notes · AI). Reusable `EntityEditSheet` for inline edit of every GM-managed row. Real AI via `narrative-ai` edge function + `LOVABLE_API_KEY`, gated client-side by `VITE_NARRATIVE_AI_ENABLED`. SceneSummaryWizard for manual memory updates with structured diff review. MemberManagementSheet (invite/role/remove, guards against losing the only GM). LiveSessionControls (start/end + Live Now pill + duration). Player composer AI assist (public scope only). Computed campaign status (Waiting on GM / Waiting on Players / Live Now). | [`src/lib/narrative/`](src/lib/narrative/) (ruleset, templates, ai service, types, applyStateUpdates, campaignStatus), [`src/components/narrative/`](src/components/narrative/), [`src/hooks/useNarrativeCampaigns.ts`](src/hooks/useNarrativeCampaigns.ts), [`src/hooks/useNarrativeCampaign.ts`](src/hooks/useNarrativeCampaign.ts), [`supabase/functions/narrative-ai/`](supabase/functions/narrative-ai/) |

## Routing patterns

Single-club model (no `/clubs/:clubId/...` in user-facing routes). Plugin routes look like `/drafts`, `/celebrations`, `/nexus`, etc.

Auth + club guards live in [`src/App.tsx`](src/App.tsx):
- `<ProtectedPage>` — requires auth
- `<ClubAdminRoute>` — requires admin role in active club

## Migrations

`supabase/migrations/` — timestamp-prefixed SQL files. Conventions:
- Reuse the existing `set_updated_at()` trigger function.
- Always include `enable row level security` + named, idempotent (`drop policy if exists` then `create policy`) policies.
- Asset library inserts use `on conflict (slug) do update set ...` so re-running is safe.
- When adding plugin tables, write RLS that joins via `public.club_members` to enforce club-scoped visibility.

## Storage namespaces (localStorage keys)

| Key prefix | Owner |
|---|---|
| `dh_home_quickbar_v1:` | QuickBar pinned apps per (user, club) |
| `dh_onboarding_v1:` | Onboarding status per (user, club) |
| `nexus_run_state_v1:` | In-flight Nexus battle saves per (user, mission) |
| `nexus_endless_layout_v1` | Endless map layout choice |
| `dh_workout_timer_v1:` | In-progress Workout Arena timer (timed hold / countdown) per exercise — timestamp-based, survives reload |

## Don'ts

- Don't bypass `useClubAssets().isInstalled(slug)` to access plugin UI — clubs that haven't installed the asset must see nothing.
- Don't hardcode the 5-game launcher tile grid (deleted from the old Dashboard).
- Don't put per-feature long lists on the Home screen — they belong on the feature's own page.
- Don't use the `posts` flow as a generic "compose" surface without checking the existing route params it accepts (`?title=`, `?body=` are supported via `URLSearchParams`).
- Don't introduce drag-and-drop libraries (no `@dnd-kit` etc.) — arrow buttons for reordering have been the convention.
- Don't write to `installedAssets` directly — always go through `useClubAssets` mutators for the optimistic-rollback semantics.

## Dev workflow

```bash
npm run dev      # Vite dev server on :8080
npx tsc --noEmit # Type check (must pass before commit)
npx vite build   # Production build
```

`tsc --noEmit` is the gate. The repo has no formal test suite; verification is `tsc` + `vite build` + browser smoke-test in the Claude Preview iframe.

## Notes for future sessions

- This file is auto-loaded by Claude Code. Keep it tight — index, not encyclopedia.
- When adding a new major feature/plugin, update the **Major features** table and the **Storage namespaces** table if applicable.
- Add new gotchas to **Conventions** so they don't get re-discovered.
