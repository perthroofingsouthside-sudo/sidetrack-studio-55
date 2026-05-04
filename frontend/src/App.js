import { useState, useCallback, useRef, useEffect } from "react";
import "@/App.css";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import HomePage from "@/pages/HomePage";
import PlayerStudio from "@/pages/PlayerStudio";
import RecordingStudio from "@/pages/RecordingStudio";
import EditSharePage from "@/pages/EditSharePage";
import StreamPage from "@/pages/StreamPage";
import BattleArena from "@/pages/BattleArena";
import PlaylistsPage from "@/pages/PlaylistsPage";
import DuetStudio from "@/pages/DuetStudio";
import BecomeAStar from "@/pages/BecomeAStar";
import SocialProfile from "@/pages/SocialProfile";
import PricingPage from "@/pages/PricingPage";
import BottomNav from "@/components/BottomNav";
import GlobalPlayer from "@/components/GlobalPlayer";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

function App() {
  const [currentSong, setCurrentSong] = useState(null);
  const [currentView, setCurrentView] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("payment") || params.get("session_id")) return "pricing";
    return "stream";
  });
  const [editingRecording, setEditingRecording] = useState(null);
  const [duetData, setDuetData] = useState(null);

  // ── Global Audio Player State ──────────────────
  const [nowPlaying, setNowPlaying] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const audioRef = useRef(null);
  const progressRef = useRef(null);

  const trackProgress = useCallback((audio) => {
    const update = () => {
      if (audio && audio.duration) {
        setProgress((audio.currentTime / audio.duration) * 100);
      }
      if (!audio.paused) progressRef.current = requestAnimationFrame(update);
    };
    progressRef.current = requestAnimationFrame(update);
  }, []);

  const playTrack = useCallback((track) => {
    if (!track.preview_url) { toast.info("No preview available"); return; }
    if (audioRef.current) audioRef.current.pause();
    if (progressRef.current) cancelAnimationFrame(progressRef.current);
    const audio = new Audio(track.preview_url);
    audio.volume = 0.8;
    audio.play().catch(() => toast.error("Playback failed"));
    audioRef.current = audio;
    setNowPlaying(track);
    setIsPlaying(true);
    setProgress(0);
    trackProgress(audio);
    audio.onended = () => { setIsPlaying(false); setProgress(0); };
  }, [trackProgress]);

  const togglePlayPause = useCallback(() => {
    if (!audioRef.current) return;
    if (isPlaying) { audioRef.current.pause(); setIsPlaying(false); }
    else { audioRef.current.play().catch(() => {}); setIsPlaying(true); trackProgress(audioRef.current); }
  }, [isPlaying, trackProgress]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
      if (progressRef.current) cancelAnimationFrame(progressRef.current);
    };
  }, []);

  const handleSongRecognized = useCallback((song) => {
    setCurrentSong(song);
    setCurrentView("studio");
  }, []);

  const handleTrackSelect = useCallback((song) => {
    setCurrentSong(song);
    setCurrentView("studio");
  }, []);

  const handleTrackSelectForRecord = useCallback((song) => {
    setCurrentSong(song);
    setCurrentView("record");
  }, []);

  const handleRecordingComplete = useCallback((recording) => {
    setEditingRecording(recording);
    setCurrentView("edit");
  }, []);

  const handleNavigate = useCallback((view) => {
    setCurrentView(view);
  }, []);

  const handleStartDuet = useCallback((battle, cover) => {
    setDuetData({ battle, cover });
    setCurrentView("duet");
  }, []);

  const openInStudio = useCallback((track) => {
    setCurrentSong({
      id: track.id || crypto.randomUUID(), title: track.title, artist: track.artist,
      album: track.album || "", cover_url: track.cover_url || "", genre: track.genre || "",
      preview_url: track.preview_url || "",
    });
    setCurrentView("studio");
  }, []);

  const renderView = () => {
    switch (currentView) {
      case "home":
        return <HomePage onSongRecognized={handleSongRecognized} />;
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
        return <BattleArena currentSong={currentSong} onStartDuet={handleStartDuet} />;
      case "playlists":
        return <PlaylistsPage onTrackSelect={handleTrackSelect} />;
      case "star":
        return <BecomeAStar />;
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
        return (
          <PlayerStudio
            song={currentSong}
            onRecord={() => setCurrentView("record")}
          />
        );
      case "record":
        return (
          <RecordingStudio
            song={currentSong}
            onSongSelect={handleTrackSelectForRecord}
            onRecordingComplete={handleRecordingComplete}
            onBack={() => setCurrentView("studio")}
          />
        );
      case "edit":
        return (
          <EditSharePage
            recording={editingRecording}
            song={currentSong}
            onBack={() => setCurrentView("studio")}
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
  };

  return (
    <div className="min-h-screen bg-[#05050A] text-white">
      <div className={nowPlaying ? "pb-36" : "pb-20"}>
        {renderView()}
      </div>
      {/* Global Now Playing Bar — persists across all tabs */}
      {nowPlaying && (
        <GlobalPlayer
          nowPlaying={nowPlaying}
          isPlaying={isPlaying}
          progress={progress}
          onTogglePlayPause={togglePlayPause}
          onOpenStudio={openInStudio}
        />
      )}
      <BottomNav
        currentView={currentView}
        onNavigate={handleNavigate}
        hasSong={!!currentSong}
      />
      <Toaster position="top-center" theme="dark" />
    </div>
  );
}

export default App;
