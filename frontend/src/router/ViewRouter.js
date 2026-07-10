import HomePage from "@/pages/HomePage";
import PlayerStudio from "@/pages/PlayerStudio";
import KoalaStudio from "@/pages/KoalaStudio";
import RecordingStudio from "@/pages/RecordingStudio";
import StadiumStudio from "@/pages/StadiumStudio";
import EditSharePage from "@/pages/EditSharePage";
import StreamPage from "@/pages/StreamPage";
import BattleArena from "@/pages/BattleArena";
import PlaylistsPage from "@/pages/PlaylistsPage";
import GamerTracksPage from "@/pages/GamerTracksPage";
import DuetStudio from "@/pages/DuetStudio";
import BecomeAStar from "@/pages/BecomeAStar";
import SocialProfile from "@/pages/SocialProfile";
import PricingPage from "@/pages/PricingPage";
import ConnectPage from "@/pages/ConnectPage";
import GamerPage from "@/pages/GamerPage";
import LearnPage from "@/pages/LearnPage";
import BackstageScreen from "@/components/BackstageScreen";
import BackstagePage from "@/pages/BackstagePage";

/**
 * ViewRouter — pure dispatch for the App's `currentView` state.
 * Keeps all per-page wiring in one place so App.js only owns shell state.
 */
export default function ViewRouter({
  currentView,
  // Shared / lane
  lane,
  currentSong,
  setCurrentSong,
  setCurrentView,
  // Audio
  nowPlaying,
  isPlaying,
  progress,
  playTrack,
  togglePlayPause,
  handleSeek,
  // Navigation handlers
  handleTrackSelect,
  handleTrackSelectInStudio,
  handleTrackSelectForRecord,
  handleRecordingComplete,
  handleNavigate,
  handleStartDuet,
  openInStudio,
  // Inter-page payloads
  pendingBattleSong,
  setPendingBattleSong,
  backstageTrack,
  setBackstageTrack,
  duetData,
  editingRecording,
  setEditingRecording,
  recordMode,
  switchRecordMode,
}) {
  switch (currentView) {
    case "home":
      return (
        <HomePage
          onTrackSelect={handleTrackSelect}
          onOpenPlaylists={() => setCurrentView("playlists")}
          nowPlaying={nowPlaying}
          isPlaying={isPlaying}
          progress={progress}
          togglePlayPause={togglePlayPause}
          handleSeek={handleSeek}
          openInStudio={openInStudio}
        />
      );

    case "stream":
      return (
        <StreamPage
          onTrackSelect={handleTrackSelect}
          nowPlaying={nowPlaying}
          isPlaying={isPlaying}
          playTrack={playTrack}
          togglePlayPause={togglePlayPause}
          progress={progress}
          openInStudio={openInStudio}
        />
      );

    case "battle":
      return (
        <BattleArena
          currentSong={currentSong}
          pendingBattleSong={pendingBattleSong}
          onPendingBattleConsumed={() => setPendingBattleSong(null)}
          onStartDuet={handleStartDuet}
        />
      );

    case "playlists":
      return lane === "gamer" ? (
        <GamerTracksPage
          onTrackSelect={handleTrackSelect}
          onBattleTrack={(song) => {
            setCurrentSong(song);
            setPendingBattleSong(song);
            setCurrentView("battle");
          }}
        />
      ) : (
        <PlaylistsPage onTrackSelect={handleTrackSelect} />
      );

    case "catalog":
      return (
        <GamerTracksPage
          onTrackSelect={handleTrackSelect}
          onBattleTrack={(song) => {
            setCurrentSong(song);
            setPendingBattleSong(song);
            setCurrentView("battle");
          }}
        />
      );

    case "star":
      return <BecomeAStar />;

    case "connect":
      return <ConnectPage />;

    case "gamer":
      return (
        <GamerPage
          onPickedTrack={(t) =>
            setCurrentSong({
              id: t.id || crypto.randomUUID(),
              title: t.title,
              artist: t.artist,
              album: t.album || "",
              cover_url: t.cover_url || "",
              genre: t.genre || "",
              preview_url: t.preview_url || "",
            })
          }
          onOpenBackstage={(t) => {
            setBackstageTrack(t);
            setCurrentView("backstage-intro");
          }}
        />
      );

    case "learn":
      return <LearnPage />;

    case "backstage":
      return <BackstagePage />;

    case "backstage-intro":
      return (
        <BackstageScreen
          song={backstageTrack || currentSong}
          userId={localStorage.getItem("sidetrack_voter_id") || "anon"}
          onProceed={() => setCurrentView("record")}
          onBack={() => setCurrentView("battle")}
        />
      );

    case "pricing":
      return <PricingPage onBack={() => setCurrentView("profile")} />;

    case "profile":
      return <SocialProfile onNavigate={handleNavigate} />;

    case "duet":
      return (
        <DuetStudio
          battle={duetData?.battle}
          cover={duetData?.cover}
          onRecordingComplete={(rec) => {
            setEditingRecording(rec);
            setCurrentView("edit");
          }}
          onBack={() => setCurrentView("battle")}
        />
      );

    case "studio":
      return <KoalaStudio onBack={() => setCurrentView("home")} />;

    case "player-studio":
      return (
        <PlayerStudio
          song={currentSong}
          onRecord={() => setCurrentView("record")}
          onSongSelect={handleTrackSelectInStudio}
        />
      );

    case "record":
      return recordMode === "stadium" ? (
        <StadiumStudio
          song={currentSong}
          onSwitchClassic={() => switchRecordMode("classic")}
        />
      ) : (
        <RecordingStudio
          song={currentSong}
          onSongSelect={handleTrackSelectForRecord}
          onRecordingComplete={handleRecordingComplete}
          onBack={() => setCurrentView("studio")}
          onSwitchStadium={() => switchRecordMode("stadium")}
        />
      );

    case "edit":
      return (
        <EditSharePage
          recording={editingRecording}
          song={currentSong}
          onBack={() => setCurrentView("studio")}
          onOpenInStudio={(rec) => {
            const recSong = {
              id: rec.id || `rec-${Date.now()}`,
              title: currentSong?.title ? `${currentSong.title} — Your Take` : "Your Recording",
              artist: localStorage.getItem("sidetrack_username") || "You",
              album: "Personal Recording",
              cover_url: currentSong?.cover_url || "",
              genre: currentSong?.genre || "original",
              preview_url: rec.url || "",
              is_recording: true,
            };
            setCurrentSong(recSong);
            if (rec.url && playTrack) playTrack(recSong);
            setCurrentView("studio");
          }}
        />
      );

    default:
      return (
        <StreamPage
          onTrackSelect={handleTrackSelect}
          nowPlaying={nowPlaying}
          isPlaying={isPlaying}
          playTrack={playTrack}
          togglePlayPause={togglePlayPause}
          progress={progress}
          openInStudio={openInStudio}
        />
      );
  }
}
