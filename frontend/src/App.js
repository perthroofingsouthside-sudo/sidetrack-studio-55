import { useState, useCallback, useEffect } from "react";
import "@/App.css";
import { Toaster } from "@/components/ui/sonner";
import HomePage from "@/pages/HomePage";
import PlayerStudio from "@/pages/PlayerStudio";
import RecordingStudio from "@/pages/RecordingStudio";
import EditSharePage from "@/pages/EditSharePage";
import StreamPage from "@/pages/StreamPage";
import BottomNav from "@/components/BottomNav";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

function App() {
  const [currentSong, setCurrentSong] = useState(null);
  const [currentView, setCurrentView] = useState("stream");
  const [recordings, setRecordings] = useState([]);
  const [editingRecording, setEditingRecording] = useState(null);
  const [spotifyToken, setSpotifyToken] = useState(null);

  // Handle Spotify OAuth callback
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    if (code) {
      handleSpotifyCallback(code);
      window.history.replaceState({}, document.title, "/");
    }
    // Check stored token
    const stored = localStorage.getItem("spotify_access_token");
    if (stored) setSpotifyToken(stored);

    // Load Spotify SDK only if needed
    if (!document.getElementById("spotify-sdk")) {
      const script = document.createElement("script");
      script.id = "spotify-sdk";
      script.src = "https://sdk.scdn.co/spotify-player.js";
      script.async = true;
      script.onerror = () => console.log("Spotify SDK not available");
      document.body.appendChild(script);
      // Set a no-op ready handler to prevent errors when SDK loads without token
      window.onSpotifyWebPlaybackSDKReady = () => {};
    }
  }, []);

  const handleSpotifyCallback = async (code) => {
    try {
      const formData = new FormData();
      formData.append("code", code);
      const res = await fetch(`${API}/spotify/callback`, { method: "POST", body: formData });
      const data = await res.json();
      if (data.access_token) {
        setSpotifyToken(data.access_token);
        localStorage.setItem("spotify_access_token", data.access_token);
        if (data.refresh_token) localStorage.setItem("spotify_refresh_token", data.refresh_token);
      }
    } catch (err) {
      console.error("Spotify callback failed:", err);
    }
  };

  const handleSongRecognized = useCallback((song) => {
    setCurrentSong(song);
    setCurrentView("studio");
  }, []);

  const handleTrackSelect = useCallback((song) => {
    setCurrentSong(song);
    setCurrentView("studio");
  }, []);

  const handleRecordingComplete = useCallback((recording) => {
    setRecordings((prev) => [recording, ...prev]);
    setEditingRecording(recording);
    setCurrentView("edit");
  }, []);

  const handleNavigate = useCallback((view) => {
    setCurrentView(view);
  }, []);

  const renderView = () => {
    switch (currentView) {
      case "home":
        return <HomePage onSongRecognized={handleSongRecognized} />;
      case "stream":
        return (
          <StreamPage
            spotifyToken={spotifyToken}
            onTrackSelect={handleTrackSelect}
            onNavigateStudio={() => setCurrentView("studio")}
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
            spotifyToken={spotifyToken}
            onTrackSelect={handleTrackSelect}
            onNavigateStudio={() => setCurrentView("studio")}
          />
        );
    }
  };

  return (
    <div className="min-h-screen bg-[#05050A] text-white">
      <div className="pb-20">
        {renderView()}
      </div>
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
