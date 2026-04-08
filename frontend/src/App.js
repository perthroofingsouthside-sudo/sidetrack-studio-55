import { useState, useCallback } from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import HomePage from "@/pages/HomePage";
import PlayerStudio from "@/pages/PlayerStudio";
import RecordingStudio from "@/pages/RecordingStudio";
import EditSharePage from "@/pages/EditSharePage";
import BottomNav from "@/components/BottomNav";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

function App() {
  const [currentSong, setCurrentSong] = useState(null);
  const [currentView, setCurrentView] = useState("home");
  const [recordings, setRecordings] = useState([]);
  const [editingRecording, setEditingRecording] = useState(null);

  const handleSongRecognized = useCallback((song) => {
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
        return <HomePage onSongRecognized={handleSongRecognized} />;
    }
  };

  return (
    <div className="min-h-screen bg-[#05050A] text-white">
      <BrowserRouter>
        <div className="pb-20">
          {renderView()}
        </div>
        <BottomNav
          currentView={currentView}
          onNavigate={handleNavigate}
          hasSong={!!currentSong}
        />
        <Toaster position="top-center" theme="dark" />
      </BrowserRouter>
    </div>
  );
}

export default App;
