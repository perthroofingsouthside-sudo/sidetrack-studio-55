import { useState, useCallback } from "react";
import "@/App.css";
import { Toaster } from "@/components/ui/sonner";
import HomePage from "@/pages/HomePage";
import PlayerStudio from "@/pages/PlayerStudio";
import RecordingStudio from "@/pages/RecordingStudio";
import EditSharePage from "@/pages/EditSharePage";
import StreamPage from "@/pages/StreamPage";
import BattleArena from "@/pages/BattleArena";
import PlaylistsPage from "@/pages/PlaylistsPage";
import DuetStudio from "@/pages/DuetStudio";
import BecomeAStar from "@/pages/BecomeAStar";
import BottomNav from "@/components/BottomNav";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

function App() {
  const [currentSong, setCurrentSong] = useState(null);
  const [currentView, setCurrentView] = useState("stream");
  const [editingRecording, setEditingRecording] = useState(null);
  const [duetData, setDuetData] = useState(null);

  const handleSongRecognized = useCallback((song) => {
    setCurrentSong(song);
    setCurrentView("studio");
  }, []);

  const handleTrackSelect = useCallback((song) => {
    setCurrentSong(song);
    setCurrentView("studio");
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

  const renderView = () => {
    switch (currentView) {
      case "home":
        return <HomePage onSongRecognized={handleSongRecognized} />;
      case "stream":
        return <StreamPage onTrackSelect={handleTrackSelect} />;
      case "battle":
        return <BattleArena currentSong={currentSong} onStartDuet={handleStartDuet} />;
      case "playlists":
        return <PlaylistsPage onTrackSelect={handleTrackSelect} />;
      case "star":
        return <BecomeAStar />;
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
        return <StreamPage onTrackSelect={handleTrackSelect} />;
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
