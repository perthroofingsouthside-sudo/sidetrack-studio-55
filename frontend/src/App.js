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
import ConnectPage from "@/pages/ConnectPage";
import GamerPage from "@/pages/GamerPage";
import BackstageScreen from "@/components/BackstageScreen";
import BottomNav from "@/components/BottomNav";
import GlobalPlayer from "@/components/GlobalPlayer";
import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

function App() {
  const [currentSong, setCurrentSong] = useState(null);
  const [currentView, setCurrentView] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("payment") || params.get("session_id")) return "pricing";
    const savedLane = localStorage.getItem("pp_lane") || "creator";
    return savedLane === "gamer" ? "gamer" : "home";
  });
  const [editingRecording, setEditingRecording] = useState(null);
  const [duetData, setDuetData] = useState(null);
  // ── Two-Lane Ecosystem ─────────────────────────
  const [lane, setLaneState] = useState(() => localStorage.getItem("pp_lane") || "creator");
  const [backstageTrack, setBackstageTrack] = useState(null);

  const setLane = useCallback((newLane) => {
    setLaneState(newLane);
    localStorage.setItem("pp_lane", newLane);
    // Persist server-side
    const uid = localStorage.getItem("sidetrack_voter_id") || "anon";
    axios.post(`${API}/lanes/set`, { user_id: uid, lane: newLane }).catch(() => {});
    // Snap to a sensible default tab on lane switch
    if (newLane === "gamer") setCurrentView("gamer");
    else setCurrentView("home");
  }, []);

  // ── Global Audio Player State ──────────────────
  const [nowPlaying, setNowPlaying] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const audioRef = useRef(null);

  // Use audio element's native timeupdate event — no rAF loops, no accumulation
  const attachProgressListener = useCallback((audio) => {
    const onTimeUpdate = () => {
      if (audio.duration) {
        setProgress((audio.currentTime / audio.duration) * 100);
      }
    };
    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("ended", () => {
      setIsPlaying(false);
      setProgress(0);
    });
    // Store cleanup ref
    audio._cleanupProgress = () => {
      audio.removeEventListener("timeupdate", onTimeUpdate);
    };
  }, []);

  const playTrack = useCallback((track) => {
    if (!track.preview_url) { toast.info("No preview available"); return; }
    // Clean up previous audio completely
    if (audioRef.current) {
      audioRef.current.pause();
      if (audioRef.current._cleanupProgress) audioRef.current._cleanupProgress();
      audioRef.current = null;
    }
    const audio = new Audio(track.preview_url);
    audio.volume = 0.8;
    audioRef.current = audio;
    setNowPlaying(track);
    setIsPlaying(true);
    setProgress(0);
    attachProgressListener(audio);
    audio.play().catch(() => toast.error("Playback failed"));
  }, [attachProgressListener]);

  const togglePlayPause = useCallback(() => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().catch(() => {});
      setIsPlaying(true);
    }
  }, [isPlaying]);

  const handleSeek = useCallback((pct) => {
    if (!audioRef.current || !audioRef.current.duration) return;
    audioRef.current.currentTime = pct * audioRef.current.duration;
    setProgress(pct * 100);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        if (audioRef.current._cleanupProgress) audioRef.current._cleanupProgress();
        audioRef.current = null;
      }
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
    // Gamer lane: store privately + switch to Viewer playback automatically
    if (lane === "gamer") {
      const uid = localStorage.getItem("sidetrack_voter_id") || "anon";
      axios.post(`${API}/gamer/recordings`, {
        user_id: uid,
        song_id: currentSong?.id || "",
        song_title: currentSong?.title || "Untitled",
        artist: currentSong?.artist || "",
        duration_sec: recording.duration || 0,
        blob_url: recording.url || null,
      }).catch((e) => console.error("Gamer save err", e));
      toast.success("Saved privately — switching to Viewer");
      setCurrentView("record"); // RecordingStudio's "viewer" layout handles playback
      return;
    }
    setCurrentView("edit");
  }, [lane, currentSong]);

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
        return <HomePage onSongRecognized={handleSongRecognized} nowPlaying={nowPlaying} />;
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
      case "connect":
        return <ConnectPage />;
      case "gamer":
        return (
          <GamerPage
            onPickedTrack={(t) => setCurrentSong({
              id: t.id || crypto.randomUUID(), title: t.title, artist: t.artist,
              album: t.album || "", cover_url: t.cover_url || "", genre: t.genre || "",
              preview_url: t.preview_url || "",
            })}
            onOpenBackstage={(t) => { setBackstageTrack(t); setCurrentView("backstage"); }}
          />
        );
      case "backstage":
        return (
          <BackstageScreen
            song={backstageTrack || currentSong}
            userId={localStorage.getItem("sidetrack_voter_id") || "anon"}
            onProceed={() => setCurrentView("record")}
            onBack={() => setCurrentView("gamer")}
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
        return (
          <PlayerStudio
            song={currentSong}
            onRecord={() => setCurrentView("record")}
            onSongSelect={handleTrackSelect}
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
      <div className={nowPlaying ? "pb-44" : "pb-28"}>
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
          onSeek={handleSeek}
        />
      )}
      <BottomNav
        currentView={currentView}
        onNavigate={handleNavigate}
        hasSong={!!currentSong}
        lane={lane}
        onLaneChange={setLane}
      />
      <Toaster position="top-center" theme="dark" />
    </div>
  );
}

export default App;
