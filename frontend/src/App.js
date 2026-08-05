import { useState, useCallback, useEffect } from "react";
import "@/App.css";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import axios from "axios";
import BottomNav from "@/components/BottomNav";
import GlobalPlayer from "@/components/GlobalPlayer";
import ViewRouter from "@/router/ViewRouter";
import AgeGate from "@/components/safety/AgeGate";
import GraduationModal from "@/components/safety/GraduationModal";
import { useGlobalAudioPlayer } from "@/hooks/useGlobalAudioPlayer";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

function App() {
  // ── View / song / lane / record-mode shell state ──────────────────────
  const [currentSong, setCurrentSong] = useState(null);
  const [currentView, setCurrentView] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("payment") || params.get("session_id")) return "pricing";
    const savedLane = localStorage.getItem("pp_lane") || "creator";
    return savedLane === "gamer" ? "battle" : "home";
  });
  const [editingRecording, setEditingRecording] = useState(null);
  const [duetData, setDuetData] = useState(null);
  const [lane, setLaneState] = useState(() => localStorage.getItem("pp_lane") || "creator");
  const [backstageTrack, setBackstageTrack] = useState(null);
  const [pendingBattleSong, setPendingBattleSong] = useState(null);
  const [recordMode, setRecordMode] = useState(() => localStorage.getItem("pp_record_mode") || "stadium");

  // ── Grommet safety (under-18 → Gamer lane only) ───────────────────────
  const [ageMode, setAgeMode] = useState(() => localStorage.getItem("pp_age_mode") || "");
  const [showGraduation, setShowGraduation] = useState(false);
  const isGrommet = ageMode === "grommet";

  const selectAgeMode = useCallback(async (mode) => {
    localStorage.setItem("pp_age_mode", mode);
    setAgeMode(mode);
    let uid = localStorage.getItem("sidetrack_voter_id");
    if (!uid) {
      uid = (crypto.randomUUID && crypto.randomUUID()) || `u_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      localStorage.setItem("sidetrack_voter_id", uid);
    }
    axios.post(`${API}/safety/age-mode`, { user_id: uid, mode }).catch(() => {});
    if (mode === "grommet") {
      localStorage.setItem("pp_lane", "gamer");
      setLaneState("gamer");
      setCurrentView("battle");
      toast.success("Gamer mode locked in — avatar identity protected");
    }
  }, []);

  const handleGraduated = useCallback(() => {
    localStorage.setItem("pp_age_mode", "adult");
    setAgeMode("adult");
    setShowGraduation(false);
    toast.success("Creator mode unlocked — welcome to the full ecosystem!");
  }, []);

  // Grommets can never sit in the creator lane (covers stale localStorage)
  useEffect(() => {
    if (isGrommet && lane !== "gamer") {
      localStorage.setItem("pp_lane", "gamer");
      setLaneState("gamer");
      setCurrentView("battle");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isGrommet]);

  const switchRecordMode = useCallback((m) => {
    setRecordMode(m);
    localStorage.setItem("pp_record_mode", m);
  }, []);

  const setLane = useCallback((newLane) => {
    if (newLane === "creator" && localStorage.getItem("pp_age_mode") === "grommet") {
      toast("Level up with a guardian to unlock Creator mode", { icon: "🔒" });
      setShowGraduation(true);
      return;
    }
    setLaneState(newLane);
    localStorage.setItem("pp_lane", newLane);
    const uid = localStorage.getItem("sidetrack_voter_id") || "anon";
    axios.post(`${API}/lanes/set`, { user_id: uid, lane: newLane }).catch(() => {});
    setCurrentView(newLane === "gamer" ? "battle" : "home");
  }, []);

  // ── Global audio player ───────────────────────────────────────────────
  const {
    nowPlaying, isPlaying, progress,
    playTrack, togglePlayPause, handleSeek,
  } = useGlobalAudioPlayer();

  // ── Navigation / song handlers ────────────────────────────────────────
  const handleTrackSelect = useCallback((song) => {
    setCurrentSong(song);
    if (song?.preview_url) playTrack(song);
  }, [playTrack]);

  const handleTrackSelectInStudio = useCallback((song) => {
    setCurrentSong(song);
    setCurrentView("studio");
  }, []);

  const handleTrackSelectForRecord = useCallback((song) => {
    setCurrentSong(song);
    setCurrentView("record");
  }, []);

  const handleRecordingComplete = useCallback((recording) => {
    setEditingRecording(recording);
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
      toast.success("Saved to Backstage — keep or discard");
      setCurrentView("backstage");
      return;
    }
    setCurrentView("edit");
  }, [lane, currentSong]);

  const handleNavigate = useCallback((view) => setCurrentView(view), []);

  const handleStartDuet = useCallback((battle, cover) => {
    setDuetData({ battle, cover });
    setCurrentView("duet");
  }, []);

  const openInStudio = useCallback((track) => {
    setCurrentSong({
      id: track.id || crypto.randomUUID(),
      title: track.title,
      artist: track.artist,
      album: track.album || "",
      cover_url: track.cover_url || "",
      genre: track.genre || "",
      preview_url: track.preview_url || "",
    });
    setCurrentView("studio");
  }, []);

  return (
    <div className="min-h-screen bg-[#05050A] text-white">
      <div className={nowPlaying ? "pb-44" : "pb-28"}>
        <ViewRouter
          currentView={currentView}
          lane={lane}
          currentSong={currentSong}
          setCurrentSong={setCurrentSong}
          setCurrentView={setCurrentView}
          nowPlaying={nowPlaying}
          isPlaying={isPlaying}
          progress={progress}
          playTrack={playTrack}
          togglePlayPause={togglePlayPause}
          handleSeek={handleSeek}
          handleTrackSelect={handleTrackSelect}
          handleTrackSelectInStudio={handleTrackSelectInStudio}
          handleTrackSelectForRecord={handleTrackSelectForRecord}
          handleRecordingComplete={handleRecordingComplete}
          handleNavigate={handleNavigate}
          handleStartDuet={handleStartDuet}
          openInStudio={openInStudio}
          pendingBattleSong={pendingBattleSong}
          setPendingBattleSong={setPendingBattleSong}
          backstageTrack={backstageTrack}
          setBackstageTrack={setBackstageTrack}
          duetData={duetData}
          editingRecording={editingRecording}
          setEditingRecording={setEditingRecording}
          recordMode={recordMode}
          switchRecordMode={switchRecordMode}
        />
      </div>

      {/* Slim GlobalPlayer bar is scoped ONLY to the two playback-oriented
          tabs — Discover (creator lane home) and Tracks (gamer lane
          `playlists` view routes to GamerTracksPage). Audio playback
          continues across tabs but the UI bar disappears everywhere else
          so it never obscures Connect / Studio / Record / Backstage /
          Profile chrome. */}
      {nowPlaying && (
        currentView === "home" ||
        (currentView === "playlists" && lane === "gamer")
      ) && (
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
        isGrommet={isGrommet}
      />

      {!ageMode && <AgeGate onSelect={selectAgeMode} />}
      <GraduationModal open={showGraduation} onClose={() => setShowGraduation(false)} onGraduated={handleGraduated} />

      <Toaster position="top-center" theme="dark" />
    </div>
  );
}

export default App;
