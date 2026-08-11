// DH Club — Feature Onboarding Registry
//
// Single source of truth for "what does each feature teach the user".
// Keyed by feature slug (matches `PlatformAsset.slug`). Used by the
// onboarding framework to:
//   • drive the first-time club tour
//   • drive "What's New" prompts when assets are installed/enabled
//   • drive single-feature tutorials (admin preview, deep-link, etc.)
//
// Adding onboarding for a new feature: append an entry below. If you don't,
// callers fall back to `deriveFallbackOnboarding(asset)` which constructs
// a minimal one-step tutorial from the existing asset metadata, so the
// system never breaks on unknown features.
//
// Importance gates what surfaces a feature: `minor` features never trigger
// the New Feature prompt; `standard`+ do. Critical-tagged features can be
// pinned more prominently in the future.

import type { PlatformAsset } from '@/types/assets';

export type OnboardingImportance = 'minor' | 'standard' | 'important' | 'critical';
export type OnboardingType = 'club_intro' | 'new_feature' | 'feature_update';
export type OnboardingRole = 'admin' | 'member';

export interface OnboardingStep {
  /** Bold heading for this step. */
  title: string;
  /** Body copy — keep short, 1–2 sentences. */
  body: string;
  /** Lucide icon name — looked up at render time via a small map. */
  iconKey?: string;
}

export interface FeatureOnboarding {
  /** Slug — matches PlatformAsset.slug. */
  featureKey: string;
  /** Display name for headers / chips. */
  displayName: string;
  /** Short subtitle shown under the title (one line). */
  shortDescription: string;
  /** Category tag — drives accent + grouping. */
  featureType: 'core' | 'plugin' | 'game' | 'social' | 'admin' | 'utility';
  /** Importance gate. `minor` features never trigger prompts. */
  importance: OnboardingImportance;
  /**
   * Version. Bumping this re-triggers onboarding once for each user as a
   * `feature_update` event (only if the feature is also marked `standard`+).
   */
  version: number;
  /**
   * Roles allowed to see this onboarding. Omit = everyone. `'admin'` =
   * only club admins. `'member'` = only non-admin members.
   */
  requiredRole?: OnboardingRole;
  /** Header for the onboarding modal. */
  onboardingTitle: string;
  /** One-line summary shown below the title. */
  onboardingSummary: string;
  /** Steps — keep to 2–4 for mobile readability. */
  onboardingSteps: OnboardingStep[];
  /** Final CTA button on the completion screen. */
  primaryCta: { label: string; route: string };
  /** Optional iconKey for the feature header (defaults derived from category). */
  iconKey?: string;
  /** Free-form tags shown as small chips ("Multiplayer", "Daily", etc). */
  tags?: string[];
}

/* ─── Registry ─────────────────────────────────────────────────────── */

const REGISTRY: Record<string, FeatureOnboarding> = {
  'draft-arena': {
    featureKey: 'draft-arena',
    displayName: 'Draft Arena',
    shortDescription: 'Run live snake drafts with your crew.',
    featureType: 'game',
    importance: 'critical',
    version: 1,
    iconKey: 'Bookmark',
    tags: ['Live', 'Multiplayer', 'Seasons'],
    onboardingTitle: 'Welcome to Draft Arena',
    onboardingSummary: 'Run live drafts, build seasons, and crown a champion.',
    onboardingSteps: [
      { title: 'Live snake drafts', body: 'Members take turns picking on any topic — sports, music, debates, anything.', iconKey: 'Bookmark' },
      { title: 'Seasons & playoffs', body: 'String drafts into a season. Top finishers go to a Bo3 playoffs bracket.', iconKey: 'Trophy' },
      { title: 'Your turn pings', body: "Get a notification when you're on the clock. Resume drafts on any device.", iconKey: 'BellRing' },
    ],
    primaryCta: { label: 'Open Draft Arena', route: '/drafts' },
  },

  'rune-delve': {
    featureKey: 'rune-delve',
    displayName: 'Rune Delve',
    shortDescription: 'Roguelike dungeon crawler for your club.',
    featureType: 'game',
    importance: 'critical',
    version: 1,
    iconKey: 'Sparkles',
    tags: ['Solo', 'Daily', 'Campaign'],
    onboardingTitle: 'Welcome to Rune Delve',
    onboardingSummary: 'Descend through chambers, collect runes, climb the leaderboard.',
    onboardingSteps: [
      { title: 'Forge a hero', body: 'Pick a class and class title. Your hero levels up across every delve.', iconKey: 'Shield' },
      { title: 'Chamber by chamber', body: 'Each level is a distinct chamber — Ancient Gate, Cursed Vault, Spiral Sanctum, and more.', iconKey: 'DoorOpen' },
      { title: 'Daily run', body: 'A new 2-minute challenge every day. Streaks earn cosmetic titles.', iconKey: 'Calendar' },
    ],
    primaryCta: { label: 'Open Rune Delve', route: '/rune-delve' },
  },

  'nexus-defense': {
    featureKey: 'nexus-defense',
    displayName: 'Nexus Defense',
    shortDescription: 'Cooperative tower defense strategy game.',
    featureType: 'game',
    importance: 'critical',
    version: 1,
    iconKey: 'Shield',
    tags: ['Co-op', 'Strategy', 'Endless'],
    onboardingTitle: 'Welcome to Nexus Defense',
    onboardingSummary: 'Build a grid, hold the nexus, push the club operation forward.',
    onboardingSteps: [
      { title: 'Place towers, hold the line', body: 'Four tower kinds, two abilities. Mix them — single-tower runs don\'t survive late waves.', iconKey: 'Shield' },
      { title: 'Solo campaign + Endless', body: 'Six missions in Sector I, plus an endless gauntlet for replay value.', iconKey: 'Sparkles' },
      { title: 'Club operations', body: 'Every endless run contributes to a three-phase club-wide operation. Push it together.', iconKey: 'Users' },
    ],
    primaryCta: { label: 'Open Nexus Defense', route: '/nexus' },
  },

  'nfl-pickem': {
    featureKey: 'nfl-pickem',
    displayName: "NFL Pick'em",
    shortDescription: 'Weekly NFL game predictions.',
    featureType: 'game',
    importance: 'important',
    version: 1,
    iconKey: 'Trophy',
    tags: ['Weekly', 'Sports'],
    onboardingTitle: "Welcome to NFL Pick'em",
    onboardingSummary: 'Pick every NFL game each week. Climb your club leaderboard.',
    onboardingSteps: [
      { title: 'Pick before kickoff', body: 'Every game locks at kickoff. Late picks default to no-selection.', iconKey: 'Clock' },
      { title: 'Score moves season-long', body: 'Correct picks score. Wrong picks hurt. The leaderboard updates live.', iconKey: 'TrendingUp' },
      { title: 'See the sharpest in your club', body: 'Weekly + season standings show who\'s actually good at this.', iconKey: 'Trophy' },
    ],
    primaryCta: { label: "Open NFL Pick'em", route: '/pickem' },
  },

  'brackets': {
    featureKey: 'brackets',
    displayName: 'Brackets',
    shortDescription: 'Create and run tournament brackets.',
    featureType: 'utility',
    importance: 'important',
    version: 1,
    iconKey: 'Trophy',
    tags: ['Tournament', 'Voting'],
    onboardingTitle: 'Welcome to Brackets',
    onboardingSummary: 'Build single or double-elimination brackets your club can fill out.',
    onboardingSteps: [
      { title: 'Anything you can rank', body: 'Sports, music, hot takes, holiday movies — set up entries and seed them.', iconKey: 'Trophy' },
      { title: 'Lock time matters', body: 'Members submit their brackets before lock. Late entries are ignored.', iconKey: 'Lock' },
      { title: 'Live standings', body: 'As rounds resolve, the leaderboard updates so members can see who picked best.', iconKey: 'TrendingUp' },
    ],
    primaryCta: { label: 'Open Brackets', route: '/brackets' },
  },

  'portfolio-wars': {
    featureKey: 'portfolio-wars',
    displayName: 'Portfolio Wars',
    shortDescription: 'Weekly stock-picking competition.',
    featureType: 'game',
    importance: 'standard',
    version: 1,
    iconKey: 'TrendingUp',
    tags: ['Weekly', 'Finance'],
    onboardingTitle: 'Welcome to Portfolio Wars',
    onboardingSummary: 'Pick five stocks. Beat the market. Beat your friends.',
    onboardingSteps: [
      { title: 'Five stocks, one week', body: 'Pick at the start of each weekly challenge. Returns track live.', iconKey: 'TrendingUp' },
      { title: 'Picks lock at the bell', body: 'After lock, no edits. The leaderboard updates automatically.', iconKey: 'Lock' },
    ],
    primaryCta: { label: 'Open Portfolio Wars', route: '/portfolio-wars' },
  },

  'lockbox': {
    featureKey: 'lockbox',
    displayName: 'Lockbox',
    shortDescription: 'Your single most confident daily pick.',
    featureType: 'game',
    importance: 'standard',
    version: 1,
    iconKey: 'Lock',
    tags: ['Daily', 'Sports'],
    onboardingTitle: 'Welcome to Lockbox',
    onboardingSummary: 'One lock a day. A clear yes/no outcome. Accuracy tracked over time.',
    onboardingSteps: [
      { title: 'One pick a day', body: 'Your single most confident prediction — a game, a hot take, anything yes/no.', iconKey: 'Lock' },
      { title: 'Accuracy beats volume', body: 'Hit rate is what scores. Skip a day rather than throw away a bad lock.', iconKey: 'Trophy' },
    ],
    primaryCta: { label: 'Open Lockbox', route: '/lockbox' },
  },

  'chat': {
    featureKey: 'chat',
    displayName: 'Club Chat',
    shortDescription: 'Real-time channel-based messaging.',
    featureType: 'social',
    importance: 'important',
    version: 1,
    iconKey: 'MessageSquareText',
    tags: ['Realtime', 'Channels'],
    onboardingTitle: 'Your club has chat',
    onboardingSummary: 'Channel-based messaging, threads, reactions, and typing indicators.',
    onboardingSteps: [
      { title: 'Channels per topic', body: 'Spin up channels for games, off-topic, planning — whatever your club needs.', iconKey: 'MessageSquareText' },
      { title: 'Threads, reacts, mentions', body: 'Standard chat affordances. Mentions ping the person directly.', iconKey: 'AtSign' },
    ],
    primaryCta: { label: 'Open Chat', route: '/chat' },
  },

  'events': {
    featureKey: 'events',
    displayName: 'Events',
    shortDescription: 'Club event calendar with RSVPs.',
    featureType: 'social',
    importance: 'standard',
    version: 1,
    iconKey: 'CalendarDays',
    tags: ['Calendar', 'RSVP'],
    onboardingTitle: 'Your club has events',
    onboardingSummary: 'Game nights, watch parties, IRL meetups — all in one place with RSVPs.',
    onboardingSteps: [
      { title: 'See what\'s coming up', body: 'A scrollable calendar of upcoming club events with date, time, and location.', iconKey: 'CalendarDays' },
      { title: 'RSVP', body: 'Mark attending, maybe, or skip. Hosts see the count in real time.', iconKey: 'Check' },
    ],
    primaryCta: { label: 'Open Events', route: '/events' },
  },

  'feed': {
    featureKey: 'feed',
    displayName: 'Feed',
    shortDescription: 'Scrollable club activity stream.',
    featureType: 'social',
    importance: 'standard',
    version: 1,
    iconKey: 'Newspaper',
    onboardingTitle: 'Your club has a feed',
    onboardingSummary: 'A scrollable timeline of club activity — picks, wins, posts, events.',
    onboardingSteps: [
      { title: 'See everything at a glance', body: 'Draft completions, brackets locked in, new events — the feed has it all.', iconKey: 'Newspaper' },
    ],
    primaryCta: { label: 'Open Feed', route: '/feed' },
  },

  'polls': {
    featureKey: 'polls',
    displayName: 'Polls',
    shortDescription: 'Quick club polls on anything.',
    featureType: 'social',
    importance: 'standard',
    version: 1,
    iconKey: 'MessageCircle',
    onboardingTitle: 'Your club has polls',
    onboardingSummary: 'Settle debates, plan hangouts, take quick reads on what the club thinks.',
    onboardingSteps: [
      { title: 'Spin one up in seconds', body: 'Title, 2+ options, optional close time. Results visible after voting.', iconKey: 'MessageCircle' },
    ],
    primaryCta: { label: 'Open Polls', route: '/polls' },
  },

  'rankings': {
    featureKey: 'rankings',
    displayName: 'Rankings',
    shortDescription: 'Cross-game member leaderboards.',
    featureType: 'utility',
    importance: 'standard',
    version: 1,
    iconKey: 'BarChart3',
    onboardingTitle: 'Your club has rankings',
    onboardingSummary: 'Aggregate leaderboards across every installed game.',
    onboardingSteps: [
      { title: 'One leaderboard to rule them all', body: 'Cross-game performance ranked by club. Filter by game or time range.', iconKey: 'BarChart3' },
    ],
    primaryCta: { label: 'Open Rankings', route: '/rankings' },
  },

  'lore': {
    featureKey: 'lore',
    displayName: 'Club Lore',
    shortDescription: 'Club history, rivalries, running jokes.',
    featureType: 'social',
    importance: 'minor',
    version: 1,
    iconKey: 'ScrollText',
    onboardingTitle: 'Your club has lore',
    onboardingSummary: 'A living document of your club\'s greatest moments and inside jokes.',
    onboardingSteps: [
      { title: 'Write your history', body: 'Admins write entries; members read and relive the lore.', iconKey: 'ScrollText' },
    ],
    primaryCta: { label: 'Open Lore', route: '/lore' },
  },

  'posts': {
    featureKey: 'posts',
    displayName: 'Posts',
    shortDescription: 'Long-form club posts and articles.',
    featureType: 'social',
    importance: 'standard',
    version: 1,
    iconKey: 'FileText',
    onboardingTitle: 'Your club has posts',
    onboardingSummary: 'Long-form recaps, analysis, and announcements.',
    onboardingSteps: [
      { title: 'Write something worth keeping', body: 'Rich text, images, reactions. Think of it as your club\'s internal blog.', iconKey: 'FileText' },
    ],
    primaryCta: { label: 'Open Posts', route: '/posts' },
  },

  'shared-media': {
    featureKey: 'shared-media',
    displayName: 'Shared Media',
    shortDescription: 'Curated club links and media.',
    featureType: 'social',
    importance: 'minor',
    version: 1,
    iconKey: 'Link2',
    onboardingTitle: 'Your club has shared media',
    onboardingSummary: 'A wall for the links, videos, and clips members want to surface.',
    onboardingSteps: [
      { title: 'Drop in interesting links', body: 'Members react and sort by recency or popularity.', iconKey: 'Link2' },
    ],
    primaryCta: { label: 'Open Shared Media', route: '/shared' },
  },

  'birthdays-milestones': {
    featureKey: 'birthdays-milestones',
    displayName: 'Celebrations',
    shortDescription: 'Birthdays and milestones for your club.',
    featureType: 'social',
    importance: 'standard',
    version: 1,
    iconKey: 'PartyPopper',
    tags: ['Birthdays', 'Milestones', 'Reminders'],
    onboardingTitle: 'Celebrations are on',
    onboardingSummary: 'Track birthdays and club milestones so your group never misses a moment.',
    onboardingSteps: [
      {
        title: 'Add your birthday',
        body: 'Year is optional and stays private unless you opt in. You can also hide your birthday or share it with admins only.',
        iconKey: 'Cake',
      },
      {
        title: 'See what\'s coming up',
        body: 'Today\'s celebrations and the next few upcoming ones appear right on Home.',
        iconKey: 'CalendarHeart',
      },
      {
        title: 'Toast and wish',
        body: 'On a celebration day, tap to post a quick message to your club.',
        iconKey: 'PartyPopper',
      },
    ],
    primaryCta: { label: 'Open Celebrations', route: '/celebrations' },
  },

  'readshift': {
    featureKey: 'readshift',
    displayName: 'READSHIFT',
    shortDescription: 'Async social deduction — read the room, shift your voice.',
    featureType: 'game',
    importance: 'important',
    version: 1,
    iconKey: 'VenetianMask',
    tags: ['Async', 'Multiplayer', 'Deduction'],
    onboardingTitle: 'Welcome to READSHIFT',
    onboardingSummary: 'Answer a prompt in a secret style, then read who wrote what. Play at your own pace across a few rounds.',
    onboardingSteps: [
      { title: 'Shift your voice', body: 'Each round you get a secret Signal — Tell (be yourself), Blur (be unreadable), or Frame (write like a specific player). Answer the prompt to match it.', iconKey: 'VenetianMask' },
      { title: 'Read the room', body: 'Everyone\'s answers appear anonymously. Guess who wrote each one — mark your most confident call as a Strong Read for bonus points.', iconKey: 'Eye' },
      { title: 'Reveal & score', body: 'Authors, Signals, and guesses are revealed together. Points come from good reads and from nailing your Signal. React and roast in the recap.', iconKey: 'Sparkles' },
    ],
    primaryCta: { label: 'Open READSHIFT', route: '/readshift' },
  },

  'narrative-rpg': {
    featureKey: 'narrative-rpg',
    displayName: 'Narrative RPG',
    shortDescription: 'Run cinematic text-based RPG campaigns with Game Master tools.',
    featureType: 'social',
    importance: 'important',
    version: 1,
    iconKey: 'ScrollText',
    tags: ['RPG', 'Storytelling', 'Game Master', 'Campaigns'],
    onboardingTitle: 'Narrative RPG is live',
    onboardingSummary: 'Propose a campaign, get club-owner approval, then play out cinematic story scenes with dice rolls, clues, and a living campaign log.',
    onboardingSteps: [
      {
        title: 'Propose a campaign',
        body: 'Any member can pitch a campaign — pick a template (Blank or The Flamingo Protocol), set the tone, and submit for club-owner approval.',
        iconKey: 'ScrollText',
      },
      {
        title: 'Play through Story Chat',
        body: 'Approved campaigns open into a premium story chat: narration, NPC dialogue, dice rolls, scene cards, and clues all live in one feed.',
        iconKey: 'MessageSquareText',
      },
      {
        title: 'Game Masters get a full console',
        body: 'GMs run scenes, manage clues + factions + clocks, and review AI suggestions — nothing changes the campaign until the GM approves it.',
        iconKey: 'Sparkles',
      },
    ],
    primaryCta: { label: 'Open Narrative RPG', route: '/narrative' },
  },

  'workout-competition': {
    featureKey: 'workout-competition',
    displayName: 'Workout Arena',
    shortDescription: 'A weekly at-home fitness competition you play by exercising.',
    featureType: 'game',
    importance: 'important',
    version: 1,
    iconKey: 'Dumbbell',
    tags: ['Fitness', 'Weekly', 'Competition', 'Leaderboard'],
    onboardingTitle: 'Workout Arena is live',
    onboardingSummary: 'Log push-ups, planks, runs and more in seconds. Every workout has its own logger, and your reps climb the weekly leaderboard.',
    onboardingSteps: [
      { title: 'Log in seconds', body: 'Each workout gives you the right tool — a tap counter for push-ups, a persistent timer for planks, a round tracker for circuits. No forms.', iconKey: 'Timer' },
      { title: 'Chase the weekly goal', body: 'Every week is a fresh competition with its own workouts and goals. Your activity earns competition points toward the leaderboard.', iconKey: 'Trophy' },
      { title: 'Level up for good', body: 'Competition score resets each week, but XP, records and milestones keep building the whole time you play.', iconKey: 'TrendingUp' },
    ],
    primaryCta: { label: 'Open Workout Arena', route: '/workouts' },
  },
};

/* ─── Selectors ─────────────────────────────────────────────────────── */

export function getOnboarding(featureKey: string): FeatureOnboarding | undefined {
  return REGISTRY[featureKey];
}

/**
 * Best-effort fallback when a PlatformAsset has no registered onboarding.
 * Builds a single-step tutorial from the asset's own metadata so the system
 * never has to display nothing — but signals 'minor' importance so it
 * won't trigger New Feature prompts on its own.
 */
export function deriveFallbackOnboarding(asset: PlatformAsset, route?: string): FeatureOnboarding {
  return {
    featureKey: asset.slug,
    displayName: asset.name,
    shortDescription: asset.short_description,
    featureType: 'plugin',
    importance: 'minor',
    version: 1,
    onboardingTitle: `Welcome to ${asset.name}`,
    onboardingSummary: asset.short_description,
    onboardingSteps: [
      { title: asset.name, body: asset.full_description || asset.short_description, iconKey: asset.icon_name },
    ],
    primaryCta: { label: `Open ${asset.name}`, route: route ?? '/' },
    iconKey: asset.icon_name,
  };
}

/**
 * Resolve onboarding for any asset — registered entry if present, otherwise
 * the fallback. Pass an optional `route` for the fallback's primary CTA.
 */
export function resolveOnboarding(asset: PlatformAsset, route?: string): FeatureOnboarding {
  return getOnboarding(asset.slug) ?? deriveFallbackOnboarding(asset, route);
}

/** Importance gate — only features at or above this level trigger prompts. */
export function isPromptable(o: FeatureOnboarding): boolean {
  return o.importance !== 'minor';
}

/** Filter helper — drops features the role can't access. */
export function isVisibleToRole(o: FeatureOnboarding, isAdmin: boolean): boolean {
  if (!o.requiredRole) return true;
  if (o.requiredRole === 'admin') return isAdmin;
  if (o.requiredRole === 'member') return !isAdmin;
  return true;
}
