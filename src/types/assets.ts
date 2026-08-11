export type AssetCategory =
  | 'games'
  | 'social'
  | 'events'
  | 'admin-tools'
  | 'experimental';

export type PlacementArea =
  | 'games'
  | 'navigation'
  | 'community'
  | 'social'
  | 'admin';

export interface PlatformAsset {
  id: string;
  name: string;
  slug: string;
  category: AssetCategory;
  short_description: string;
  full_description: string;
  icon_name: string;
  placement_area: PlacementArea;
  requires_configuration: boolean;
  default_configuration_json: Record<string, unknown>;
  is_active: boolean;
  is_premium: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface InstalledAsset {
  id: string;
  club_id: string;
  asset_id: string;
  installed_by: string | null;
  installed_at: string;
  enabled: boolean;
  visible_to_members: boolean;
  configuration_json: Record<string, unknown>;
  sort_order: number;
  created_at: string;
  updated_at: string;
  asset: PlatformAsset;
}

/** Map from nav path → asset slug for filtering */
export const NAV_ASSET_SLUGS: Record<string, string> = {
  '/drafts':          'draft-arena',
  '/readshift':       'readshift',
  '/rune-delve':      'rune-delve',
  '/nexus':           'nexus-defense',
  '/pickem':          'nfl-pickem',
  '/brackets':        'brackets',
  '/portfolio-wars':  'portfolio-wars',
  '/lockbox':         'lockbox',
  '/chat':            'chat',
  '/events':          'events',
  '/lore':            'lore',
  '/feed':            'feed',
  '/polls':           'polls',
  '/rankings':        'rankings',
  '/posts':           'posts',
  '/shared':          'shared-media',
  '/celebrations':    'birthdays-milestones',
  '/narrative':       'narrative-rpg',
  '/workouts':        'workout-competition',
};

export const CATEGORY_META: Record<string, { label: string; color: string }> = {
  games:          { label: 'Games',       color: 'hsl(var(--primary))' },
  social:         { label: 'Social',      color: 'hsl(200 80% 55%)' },
  events:         { label: 'Events',      color: 'hsl(38 100% 60%)' },
  'admin-tools':  { label: 'Admin Tools', color: 'hsl(var(--gold))' },
  experimental:   { label: 'Experimental', color: 'hsl(270 70% 65%)' },
};
