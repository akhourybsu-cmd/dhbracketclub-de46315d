import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate, useLocation } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { ClubProvider } from "@/contexts/ClubContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { ClubGate } from "@/components/ClubGate";
import { AppLayout } from "@/components/AppLayout";
import { PageTransition } from "@/components/PageTransition";
import { AnimatePresence } from "framer-motion";
import { ThemeProvider } from "next-themes";
import { useAppUpdate } from "@/hooks/useAppUpdate";
import { useOfflineIndicator } from "@/hooks/useOfflineIndicator";
import { useRoutePrefetch } from "@/hooks/useRoutePrefetch";

// Lazy-loaded pages for code splitting
const LandingPage = lazy(() => import("./pages/LandingPage"));
const AuthPage = lazy(() => import("./pages/AuthPage"));
const DashboardPage = lazy(() => import("./pages/DashboardPage"));
const CreatePoolPage = lazy(() => import("./pages/CreatePoolPage"));
const JoinPoolPage = lazy(() => import("./pages/JoinPoolPage"));
const PoolDetailPage = lazy(() => import("./pages/PoolDetailPage"));
const PoolsListPage = lazy(() => import("./pages/PoolsListPage"));
const PoolSettingsPage = lazy(() => import("./pages/PoolSettingsPage"));
const BracketEntryPage = lazy(() => import("./pages/BracketEntryPage"));
const BracketDetailPage = lazy(() => import("./pages/BracketDetailPage"));
const BracketComparePage = lazy(() => import("./pages/BracketComparePage"));
const LeaderboardPage = lazy(() => import("./pages/LeaderboardPage"));
const AdminToolsPage = lazy(() => import("./pages/AdminToolsPage"));
const RuneDelveAnalyticsPage = lazy(() => import("./pages/RuneDelveAnalyticsPage"));
const RuneDelveSimulatorPage = lazy(() => import("./pages/RuneDelveSimulatorPage"));
const RuneDelveBalanceReportPage = lazy(() => import("./pages/RuneDelveBalanceReportPage"));
const GameCenterPage = lazy(() => import("./pages/GameCenterPage"));
const ProfilePage = lazy(() => import("./pages/ProfilePage"));
const ResetPasswordPage = lazy(() => import("./pages/ResetPasswordPage"));
const RankingsListPage = lazy(() => import("./pages/RankingsListPage"));
const CreateRankingPage = lazy(() => import("./pages/CreateRankingPage"));
const RankingDetailPage = lazy(() => import("./pages/RankingDetailPage"));
const PollsListPage = lazy(() => import("./pages/PollsListPage"));
const CreatePollPage = lazy(() => import("./pages/CreatePollPage"));
const PollDetailPage = lazy(() => import("./pages/PollDetailPage"));
const DraftsListPage = lazy(() => import("./pages/DraftsListPage"));
const CreateDraftPage = lazy(() => import("./pages/CreateDraftPage"));
const DraftDetailPage = lazy(() => import("./pages/DraftDetailPage"));
const ReadshiftListPage = lazy(() => import("./pages/ReadshiftListPage"));
const CreateReadshiftPage = lazy(() => import("./pages/CreateReadshiftPage"));
const ReadshiftGamePage = lazy(() => import("./pages/ReadshiftGamePage"));
const SeasonsArchivePage = lazy(() => import("./pages/SeasonsArchivePage"));
const SeasonArchiveDetailPage = lazy(() => import("./pages/SeasonArchiveDetailPage"));
const ChatPage = lazy(() => import("./pages/ChatPage"));
const EventsPage = lazy(() => import("./pages/EventsPage"));
const EventDetailPage = lazy(() => import("./pages/EventDetailPage"));
const CompetePage = lazy(() => import("./pages/CompetePage"));
const LockboxPage = lazy(() => import("./pages/LockboxPage"));
const LockboxCrackPage = lazy(() => import("./pages/LockboxCrackPage"));
const FeedPage = lazy(() => import("./pages/FeedPage"));
const LorePage = lazy(() => import("./pages/LorePage"));
const LoreDetailPage = lazy(() => import("./pages/LoreDetailPage"));
const PostsPage = lazy(() => import("./pages/PostsPage"));
const PostDetailPage = lazy(() => import("./pages/PostDetailPage"));
const SharedMediaPage = lazy(() => import("./pages/SharedMediaPage"));
const PickemHomePage = lazy(() => import("./pages/PickemHomePage"));
const PickemWeekPage = lazy(() => import("./pages/PickemWeekPage"));
const PickemWeekResultsPage = lazy(() => import("./pages/PickemWeekResultsPage"));
const PickemStandingsPage = lazy(() => import("./pages/PickemStandingsPage"));
const PickemHistoryPage = lazy(() => import("./pages/PickemHistoryPage"));
const PickemRulesPage = lazy(() => import("./pages/PickemRulesPage"));
const PickemAdminPage = lazy(() => import("./pages/PickemAdminPage"));
const RuneDelveHomePage = lazy(() => import("./pages/RuneDelveHomePage"));
const RuneDelveLevelMapPage = lazy(() => import("./pages/RuneDelveLevelMapPage"));
const RuneDelvePlayPage = lazy(() => import("./pages/RuneDelvePlayPage"));
const RuneDelveResultsPage = lazy(() => import("./pages/RuneDelveResultsPage"));
const RuneDelveLeaderboardPage = lazy(() => import("./pages/RuneDelveLeaderboardPage"));
const RuneDelveHeroPage = lazy(() => import("./pages/RuneDelveHeroPage"));
const RuneDelveHistoryPage = lazy(() => import("./pages/RuneDelveHistoryPage"));
const RuneDelveShopPage = lazy(() => import("./pages/RuneDelveShopPage"));
const RuneDelveArmoryPage = lazy(() => import("./pages/RuneDelveArmoryPage"));
const RuneDelveBestiaryPage = lazy(() => import("./pages/RuneDelveBestiaryPage"));
const RuneDelveDailyPage = lazy(() => import("./pages/RuneDelveDailyPage"));
const RuneDelveEndlessPage = lazy(() => import("./pages/RuneDelveEndlessPage"));
const RuneDelveQuestsPage = lazy(() => import("./pages/RuneDelveQuestsPage"));
const CelebrationsPage = lazy(() => import("./pages/CelebrationsPage"));
const WorkoutPage = lazy(() => import("./pages/WorkoutPage"));
const WorkoutAdminPage = lazy(() => import("./pages/WorkoutAdminPage"));
const WorkoutRecapPage = lazy(() => import("./pages/WorkoutRecapPage"));
const NarrativeCampaignsPage = lazy(() => import("./pages/NarrativeCampaignsPage"));
const NarrativeCampaignCreatePage = lazy(() => import("./pages/NarrativeCampaignCreatePage"));
const NarrativeCampaignDetailPage = lazy(() => import("./pages/NarrativeCampaignDetailPage"));
const RequestClubPage = lazy(() => import("./pages/RequestClubPage"));
const AdminClubsPage = lazy(() => import("./pages/AdminClubsPage"));
const ClubSettingsPage = lazy(() => import("./pages/ClubSettingsPage"));
const AdminDashboardPage = lazy(() => import("./pages/AdminDashboardPage"));
const AdminUsersPage = lazy(() => import("./pages/AdminUsersPage"));
const AdminCompetitionsPage = lazy(() => import("./pages/AdminCompetitionsPage"));
const AdminAuditPage = lazy(() => import("./pages/AdminAuditPage"));
const AdminDiagnosticsPage = lazy(() => import("./pages/AdminDiagnosticsPage"));
const AdminAnnouncementsPage = lazy(() => import("./pages/AdminAnnouncementsPage"));
const AdminFeatureFlagsPage = lazy(() => import("./pages/AdminFeatureFlagsPage"));
const AdminNotesPage = lazy(() => import("./pages/AdminNotesPage"));
const AdminAssetCatalogPage = lazy(() => import("./pages/AdminAssetCatalogPage"));
const ClubAssetsPage = lazy(() => import("./pages/ClubAssetsPage"));
import { AdminRoute } from "./components/auth/AdminRoute";
import { ClubAdminRoute } from "./components/auth/ClubAdminRoute";
import { AssetGuard } from "./components/auth/AssetGuard";
const NexusHomePage = lazy(() => import("./pages/NexusHomePage"));
const NexusMissionsPage = lazy(() => import("./pages/NexusMissionsPage"));
const NexusLoadoutPage = lazy(() => import("./pages/NexusLoadoutPage"));
const NexusBattlePage = lazy(() => import("./pages/NexusBattlePage"));
const NexusResultsPage = lazy(() => import("./pages/NexusResultsPage"));
const NexusLeaderboardPage = lazy(() => import("./pages/NexusLeaderboardPage"));
const NexusCodexPage = lazy(() => import("./pages/NexusCodexPage"));
const NexusBalancePage = lazy(() => import("./pages/NexusBalancePage"));
const NexusCalibrationPage = lazy(() => import("./pages/NexusCalibrationPage"));
const NexusOperationPage = lazy(() => import("./pages/NexusOperationPage"));
const NexusSigilVaultPage = lazy(() => import("./pages/NexusSigilVaultPage"));
const NexusSimulatorPage = lazy(() => import("./pages/NexusSimulatorPage"));
const NexusMissionWorkshopPage = lazy(() => import("./pages/NexusMissionWorkshopPage"));
const PortfolioWarsPage = lazy(() => import("./pages/PortfolioWarsPage"));
import { PwLayout } from "./components/portfolioWars/PwLayout";
import { RuneDelveLayout } from "./components/runedelve/RuneDelveLayout";
import { NexusLayout } from "./components/nexus/NexusLayout";
import { PickemLayout } from "./components/pickem/PickemLayout";
import { DraftArenaLayout } from "./components/drafts/DraftArenaLayout";
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2, // 2 minutes — prevents redundant refetches
      gcTime: 1000 * 60 * 5,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

// Minimal loading fallback that matches the app's visual language
function PageFallback() {
  return (
    <div className="flex items-center justify-center py-24">
      <div className="loading-spinner-ring" />
    </div>
  );
}

const ProtectedPage = ({
  children,
  assetSlug,
}: {
  children: React.ReactNode;
  /** When set, also requires the named asset to be installed for the active club. App admins bypass. */
  assetSlug?: string;
}) => (
  <ProtectedRoute>
    <ClubGate>
      <AppLayout>
        <PageTransition>
          <Suspense fallback={<PageFallback />}>
            {assetSlug ? <AssetGuard slug={assetSlug}>{children}</AssetGuard> : children}
          </Suspense>
        </PageTransition>
      </AppLayout>
    </ClubGate>
  </ProtectedRoute>
);

function AnimatedRoutes() {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<Suspense fallback={<PageFallback />}><LandingPage /></Suspense>} />
        <Route path="/auth" element={<Suspense fallback={<PageFallback />}><AuthPage /></Suspense>} />
        <Route path="/reset-password" element={<Suspense fallback={<PageFallback />}><ResetPasswordPage /></Suspense>} />

        {/* Dashboard / Home */}
        <Route path="/dashboard" element={<ProtectedPage><DashboardPage /></ProtectedPage>} />

        {/* Chat */}
        <Route path="/chat" element={<ProtectedPage assetSlug="chat"><ChatPage /></ProtectedPage>} />
        <Route path="/shared" element={<ProtectedPage assetSlug="shared-media"><SharedMediaPage /></ProtectedPage>} />

        {/* Events */}
        <Route path="/events" element={<ProtectedPage assetSlug="events"><EventsPage /></ProtectedPage>} />
        <Route path="/events/:eventId" element={<ProtectedPage assetSlug="events"><EventDetailPage /></ProtectedPage>} />

        {/* Compete hub */}
        <Route path="/compete" element={<ProtectedPage><CompetePage /></ProtectedPage>} />

        {/* Portfolio Wars — weekly stock-picking challenge */}
        <Route path="/portfolio-wars" element={<ProtectedPage assetSlug="portfolio-wars"><PwLayout><PortfolioWarsPage /></PwLayout></ProtectedPage>} />

        {/* Lockbox module */}
        <Route path="/lockbox" element={<ProtectedPage assetSlug="lockbox"><LockboxPage /></ProtectedPage>} />
        <Route path="/lockbox/:lockId" element={<ProtectedPage assetSlug="lockbox"><LockboxCrackPage /></ProtectedPage>} />

        {/* DH Lore */}
        <Route path="/lore" element={<ProtectedPage assetSlug="lore"><LorePage /></ProtectedPage>} />
        <Route path="/lore/:loreId" element={<ProtectedPage assetSlug="lore"><LoreDetailPage /></ProtectedPage>} />

        {/* Feed + Posts */}
        <Route path="/feed" element={<ProtectedPage assetSlug="feed"><FeedPage /></ProtectedPage>} />
        <Route path="/posts" element={<ProtectedPage assetSlug="posts"><PostsPage /></ProtectedPage>} />
        <Route path="/posts/create" element={<ProtectedPage assetSlug="posts"><PostsPage /></ProtectedPage>} />
        <Route path="/posts/:postId" element={<ProtectedPage assetSlug="posts"><PostDetailPage /></ProtectedPage>} />

        {/* Brackets module */}
        <Route path="/brackets" element={<ProtectedPage assetSlug="brackets"><PoolsListPage /></ProtectedPage>} />
        <Route path="/pools" element={<Navigate to="/brackets" replace />} />
        <Route path="/pools/create" element={<ProtectedPage assetSlug="brackets"><CreatePoolPage /></ProtectedPage>} />
        <Route path="/pools/join" element={<ProtectedPage assetSlug="brackets"><JoinPoolPage /></ProtectedPage>} />
        <Route path="/pools/:poolId" element={<ProtectedPage assetSlug="brackets"><PoolDetailPage /></ProtectedPage>} />
        <Route path="/pools/:poolId/settings" element={<ProtectedPage assetSlug="brackets"><PoolSettingsPage /></ProtectedPage>} />
        <Route path="/pools/:poolId/bracket/edit" element={<ProtectedPage assetSlug="brackets"><BracketEntryPage /></ProtectedPage>} />
        <Route path="/pools/:poolId/bracket/compare" element={<ProtectedPage assetSlug="brackets"><BracketComparePage /></ProtectedPage>} />
        <Route path="/pools/:poolId/bracket/:bracketId" element={<ProtectedPage assetSlug="brackets"><BracketDetailPage /></ProtectedPage>} />
        <Route path="/pools/:poolId/leaderboard" element={<ProtectedPage assetSlug="brackets"><LeaderboardPage /></ProtectedPage>} />
        <Route path="/pools/:poolId/admin" element={<ProtectedPage assetSlug="brackets"><AdminToolsPage /></ProtectedPage>} />
        <Route path="/pools/:poolId/games" element={<ProtectedPage assetSlug="brackets"><GameCenterPage /></ProtectedPage>} />

        {/* Rankings module */}
        <Route path="/rankings" element={<ProtectedPage assetSlug="rankings"><RankingsListPage /></ProtectedPage>} />
        <Route path="/rankings/create" element={<ProtectedPage assetSlug="rankings"><CreateRankingPage /></ProtectedPage>} />
        <Route path="/rankings/:rankingId" element={<ProtectedPage assetSlug="rankings"><RankingDetailPage /></ProtectedPage>} />

        {/* Polls module */}
        <Route path="/polls" element={<ProtectedPage assetSlug="polls"><PollsListPage /></ProtectedPage>} />
        <Route path="/polls/create" element={<ProtectedPage assetSlug="polls"><CreatePollPage /></ProtectedPage>} />
        <Route path="/polls/:pollId" element={<ProtectedPage assetSlug="polls"><PollDetailPage /></ProtectedPage>} />

        {/* Drafts module — standalone Draft Arena shell (own boot, HUD, no DH chrome) */}
        <Route path="/drafts" element={<ProtectedPage assetSlug="draft-arena"><DraftArenaLayout><DraftsListPage /></DraftArenaLayout></ProtectedPage>} />
        <Route path="/drafts/seasons" element={<ProtectedPage assetSlug="draft-arena"><DraftArenaLayout><SeasonsArchivePage /></DraftArenaLayout></ProtectedPage>} />
        <Route path="/drafts/seasons/:seasonId" element={<ProtectedPage assetSlug="draft-arena"><DraftArenaLayout><SeasonArchiveDetailPage /></DraftArenaLayout></ProtectedPage>} />
        <Route path="/drafts/create" element={<ProtectedPage assetSlug="draft-arena"><DraftArenaLayout><CreateDraftPage /></DraftArenaLayout></ProtectedPage>} />
        <Route path="/drafts/:draftId" element={<ProtectedPage assetSlug="draft-arena"><DraftArenaLayout><DraftDetailPage /></DraftArenaLayout></ProtectedPage>} />
        <Route path="/readshift" element={<ProtectedPage assetSlug="readshift"><ReadshiftListPage /></ProtectedPage>} />
        <Route path="/readshift/create" element={<ProtectedPage assetSlug="readshift"><CreateReadshiftPage /></ProtectedPage>} />
        <Route path="/readshift/:gameId" element={<ProtectedPage assetSlug="readshift"><ReadshiftGamePage /></ProtectedPage>} />

        {/* NFL Pick'em module — standalone shell (own boot, HUD, no DH chrome) */}
        <Route path="/pickem" element={<ProtectedPage assetSlug="nfl-pickem"><PickemLayout><PickemHomePage /></PickemLayout></ProtectedPage>} />
        <Route path="/pickem/week/:weekNumber" element={<ProtectedPage assetSlug="nfl-pickem"><PickemLayout><PickemWeekPage /></PickemLayout></ProtectedPage>} />
        <Route path="/pickem/week/:weekNumber/results" element={<ProtectedPage assetSlug="nfl-pickem"><PickemLayout><PickemWeekResultsPage /></PickemLayout></ProtectedPage>} />
        <Route path="/pickem/standings" element={<ProtectedPage assetSlug="nfl-pickem"><PickemLayout><PickemStandingsPage /></PickemLayout></ProtectedPage>} />
        <Route path="/pickem/history" element={<ProtectedPage assetSlug="nfl-pickem"><PickemLayout><PickemHistoryPage /></PickemLayout></ProtectedPage>} />
        <Route path="/pickem/rules" element={<ProtectedPage assetSlug="nfl-pickem"><PickemLayout><PickemRulesPage /></PickemLayout></ProtectedPage>} />
        <Route path="/pickem/admin" element={<ProtectedPage assetSlug="nfl-pickem"><PickemLayout><PickemAdminPage /></PickemLayout></ProtectedPage>} />

        {/* Rune Delve module — campaign */}
        <Route path="/rune-delve" element={<ProtectedPage assetSlug="rune-delve"><RuneDelveLayout><RuneDelveHomePage /></RuneDelveLayout></ProtectedPage>} />
        <Route path="/rune-delve/levels" element={<ProtectedPage assetSlug="rune-delve"><RuneDelveLayout><RuneDelveLevelMapPage /></RuneDelveLayout></ProtectedPage>} />
        <Route path="/rune-delve/play/:levelNumber" element={<ProtectedPage assetSlug="rune-delve"><RuneDelveLayout><RuneDelvePlayPage /></RuneDelveLayout></ProtectedPage>} />
        <Route path="/rune-delve/results/:levelNumber" element={<ProtectedPage assetSlug="rune-delve"><RuneDelveLayout><RuneDelveResultsPage /></RuneDelveLayout></ProtectedPage>} />
        {/* Back-compat redirects from old daily routes */}
        <Route path="/rune-delve/play" element={<Navigate to="/rune-delve/levels" replace />} />
        <Route path="/rune-delve/results" element={<Navigate to="/rune-delve" replace />} />
        <Route path="/rune-delve/leaderboard" element={<ProtectedPage assetSlug="rune-delve"><RuneDelveLayout><RuneDelveLeaderboardPage /></RuneDelveLayout></ProtectedPage>} />
        <Route path="/rune-delve/hero" element={<ProtectedPage assetSlug="rune-delve"><RuneDelveLayout><RuneDelveHeroPage /></RuneDelveLayout></ProtectedPage>} />
        <Route path="/rune-delve/history" element={<ProtectedPage assetSlug="rune-delve"><RuneDelveLayout><RuneDelveHistoryPage /></RuneDelveLayout></ProtectedPage>} />
        <Route path="/rune-delve/shop" element={<ProtectedPage assetSlug="rune-delve"><RuneDelveLayout><RuneDelveShopPage /></RuneDelveLayout></ProtectedPage>} />
        <Route path="/rune-delve/armory" element={<ProtectedPage assetSlug="rune-delve"><RuneDelveLayout><RuneDelveArmoryPage /></RuneDelveLayout></ProtectedPage>} />
        <Route path="/rune-delve/bestiary" element={<ProtectedPage assetSlug="rune-delve"><RuneDelveLayout><RuneDelveBestiaryPage /></RuneDelveLayout></ProtectedPage>} />
        <Route path="/rune-delve/daily" element={<ProtectedPage assetSlug="rune-delve"><RuneDelveLayout><RuneDelveDailyPage /></RuneDelveLayout></ProtectedPage>} />
        <Route path="/rune-delve/endless" element={<ProtectedPage assetSlug="rune-delve"><RuneDelveLayout><RuneDelveEndlessPage /></RuneDelveLayout></ProtectedPage>} />
        <Route path="/rune-delve/quests" element={<ProtectedPage assetSlug="rune-delve"><RuneDelveLayout><RuneDelveQuestsPage /></RuneDelveLayout></ProtectedPage>} />
        <Route path="/rune-delve/analytics" element={<ProtectedPage assetSlug="rune-delve"><RuneDelveAnalyticsPage /></ProtectedPage>} />
        <Route path="/rune-delve/simulator" element={<ProtectedPage assetSlug="rune-delve"><RuneDelveSimulatorPage /></ProtectedPage>} />
        <Route path="/rune-delve/balance" element={<ProtectedPage assetSlug="rune-delve"><RuneDelveBalanceReportPage /></ProtectedPage>} />

        {/* Nexus Defense — sci-fi tower defense (full-screen game shell) */}
        <Route path="/nexus" element={<ProtectedPage assetSlug="nexus-defense"><NexusLayout><NexusHomePage /></NexusLayout></ProtectedPage>} />
        <Route path="/nexus/missions" element={<ProtectedPage assetSlug="nexus-defense"><NexusLayout><NexusMissionsPage /></NexusLayout></ProtectedPage>} />
        <Route path="/nexus/loadout/:missionId" element={<ProtectedPage assetSlug="nexus-defense"><NexusLayout><NexusLoadoutPage /></NexusLayout></ProtectedPage>} />
        <Route path="/nexus/battle/:missionId" element={<ProtectedPage assetSlug="nexus-defense"><NexusLayout><NexusBattlePage /></NexusLayout></ProtectedPage>} />
        <Route path="/nexus/results/:missionId" element={<ProtectedPage assetSlug="nexus-defense"><NexusLayout><NexusResultsPage /></NexusLayout></ProtectedPage>} />
        <Route path="/nexus/leaderboard" element={<ProtectedPage assetSlug="nexus-defense"><NexusLayout><NexusLeaderboardPage /></NexusLayout></ProtectedPage>} />
        <Route path="/nexus/codex" element={<ProtectedPage assetSlug="nexus-defense"><NexusLayout><NexusCodexPage /></NexusLayout></ProtectedPage>} />
        <Route path="/nexus/balance" element={<ProtectedPage assetSlug="nexus-defense"><NexusLayout><NexusBalancePage /></NexusLayout></ProtectedPage>} />
        <Route path="/nexus/calibration" element={<ProtectedPage assetSlug="nexus-defense"><NexusLayout><NexusCalibrationPage /></NexusLayout></ProtectedPage>} />
        <Route path="/nexus/operation" element={<ProtectedPage assetSlug="nexus-defense"><NexusLayout><NexusOperationPage /></NexusLayout></ProtectedPage>} />
        <Route path="/nexus/sigils" element={<ProtectedPage assetSlug="nexus-defense"><NexusLayout><NexusSigilVaultPage /></NexusLayout></ProtectedPage>} />
        <Route path="/nexus/simulator" element={<ProtectedPage assetSlug="nexus-defense"><NexusLayout><NexusSimulatorPage /></NexusLayout></ProtectedPage>} />
        <Route path="/nexus/mission-workshop" element={<ProtectedPage assetSlug="nexus-defense"><NexusLayout><NexusMissionWorkshopPage /></NexusLayout></ProtectedPage>} />

        <Route path="/profile" element={<ProtectedPage><ProfilePage /></ProtectedPage>} />
        <Route path="/celebrations" element={<ProtectedPage assetSlug="birthdays-milestones"><CelebrationsPage /></ProtectedPage>} />
        <Route path="/workouts" element={<ProtectedPage assetSlug="workout-competition"><WorkoutPage /></ProtectedPage>} />
        <Route path="/workouts/admin" element={<ProtectedPage assetSlug="workout-competition"><ClubAdminRoute><WorkoutAdminPage /></ClubAdminRoute></ProtectedPage>} />
        <Route path="/workouts/recap/:weekId" element={<ProtectedPage assetSlug="workout-competition"><WorkoutRecapPage /></ProtectedPage>} />
        <Route path="/narrative" element={<ProtectedPage assetSlug="narrative-rpg"><NarrativeCampaignsPage /></ProtectedPage>} />
        <Route path="/narrative/new" element={<ProtectedPage assetSlug="narrative-rpg"><NarrativeCampaignCreatePage /></ProtectedPage>} />
        <Route path="/narrative/:campaignId" element={<ProtectedPage assetSlug="narrative-rpg"><NarrativeCampaignDetailPage /></ProtectedPage>} />

        {/* Clubs (multi-tenant) */}
        <Route path="/club/request" element={<ProtectedRoute><Suspense fallback={<PageFallback />}><RequestClubPage /></Suspense></ProtectedRoute>} />
        <Route path="/club/settings" element={<ProtectedPage><ClubAdminRoute><ClubSettingsPage /></ClubAdminRoute></ProtectedPage>} />
        <Route path="/clubs/:clubId/settings" element={<ProtectedPage><ClubAdminRoute><ClubSettingsPage /></ClubAdminRoute></ProtectedPage>} />
        <Route path="/club/assets" element={<ProtectedPage><ClubAdminRoute><ClubAssetsPage /></ClubAdminRoute></ProtectedPage>} />

        {/* Admin Portal — global platform controls (gated to is_app_admin / platform owner) */}
        <Route path="/admin" element={<ProtectedPage><AdminRoute><AdminDashboardPage /></AdminRoute></ProtectedPage>} />
        <Route path="/admin/clubs" element={<ProtectedPage><AdminRoute><AdminClubsPage /></AdminRoute></ProtectedPage>} />
        <Route path="/admin/users" element={<ProtectedPage><AdminRoute><AdminUsersPage /></AdminRoute></ProtectedPage>} />
        <Route path="/admin/competitions" element={<ProtectedPage><AdminRoute><AdminCompetitionsPage /></AdminRoute></ProtectedPage>} />
        <Route path="/admin/announcements" element={<ProtectedPage><AdminRoute><AdminAnnouncementsPage /></AdminRoute></ProtectedPage>} />
        <Route path="/admin/feature-flags" element={<ProtectedPage><AdminRoute><AdminFeatureFlagsPage /></AdminRoute></ProtectedPage>} />
        <Route path="/admin/notes" element={<ProtectedPage><AdminRoute><AdminNotesPage /></AdminRoute></ProtectedPage>} />
        <Route path="/admin/audit" element={<ProtectedPage><AdminRoute><AdminAuditPage /></AdminRoute></ProtectedPage>} />
        <Route path="/admin/diagnostics" element={<ProtectedPage><AdminRoute><AdminDiagnosticsPage /></AdminRoute></ProtectedPage>} />
        <Route path="/admin/assets" element={<ProtectedPage><AdminRoute><AdminAssetCatalogPage /></AdminRoute></ProtectedPage>} />
        {/* Legacy alias */}
        <Route path="/club-settings" element={<Navigate to="/club/settings" replace />} />

        <Route path="*" element={<Suspense fallback={<PageFallback />}><NotFound /></Suspense>} />
      </Routes>
    </AnimatePresence>
  );
}

function AppWithUpdate() {
  useAppUpdate();
  useOfflineIndicator();
  useRoutePrefetch();
  return <AnimatedRoutes />;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
      <AuthProvider>
        <ClubProvider>
          <TooltipProvider>
            <Sonner />
            <BrowserRouter>
              <AppWithUpdate />
            </BrowserRouter>
          </TooltipProvider>
        </ClubProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
