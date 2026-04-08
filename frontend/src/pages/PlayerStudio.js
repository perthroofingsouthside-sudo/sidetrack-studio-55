import { useState, useEffect, useRef, useCallback } from "react";
import { Play, Pause, SkipBack, Mic, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { API } from "@/App";
import axios from "axios";
import StemMixer from "@/components/StemMixer";
import SplitScreen from "@/components/SplitScreen";

export default function PlayerStudio({ song, onRecord }) {
  const [lyrics, setLyrics] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [stemVolumes, setStemVolumes] = useState({
    vocals: 80,
    guitar: 80,
    bass: 80,
    drums: 80,
  });
  const [mutedStems, setMutedStems] = useState({
    vocals: false,
    guitar: false,
    bass: false,
    drums: false,
  });
  const intervalRef = useRef(null);

  useEffect(() => {
    if (song?.id) {
      fetchLyrics();
      fetchStems();
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [song?.id]);

  const fetchLyrics = async () => {
    try {
      const res = await axios.get(`${API}/songs/${song.id}/lyrics`);
      if (res.data.success) setLyrics(res.data);
    } catch (err) {
      toast.error("Failed to load lyrics");
    }
  };

  const fetchStems = async () => {
    try {
      await axios.post(`${API}/songs/${song.id}/separate`);
    } catch (err) {
      // Stems separation may fail silently - mixer still works as UI
    }
  };

  const togglePlay = useCallback(() => {
    if (isPlaying) {
      clearInterval(intervalRef.current);
      setIsPlaying(false);
    } else {
      setIsPlaying(true);
      intervalRef.current = setInterval(() => {
        setCurrentTime((prev) => {
          if (prev >= 92) {
            clearInterval(intervalRef.current);
            setIsPlaying(false);
            return 0;
          }
          return prev + 0.5;
        });
      }, 500);
    }
  }, [isPlaying]);

  const handleRestart = useCallback(() => {
    setCurrentTime(0);
    if (!isPlaying) {
      setIsPlaying(true);
      intervalRef.current = setInterval(() => {
        setCurrentTime((prev) => {
          if (prev >= 92) {
            clearInterval(intervalRef.current);
            setIsPlaying(false);
            return 0;
          }
          return prev + 0.5;
        });
      }, 500);
    }
  }, [isPlaying]);

  const handleVolumeChange = useCallback((stem, value) => {
    setStemVolumes((prev) => ({ ...prev, [stem]: value }));
  }, []);

  const handleMuteToggle = useCallback((stem) => {
    setMutedStems((prev) => ({ ...prev, [stem]: !prev[stem] }));
  }, []);

  if (!song) return null;

  const progress = (currentTime / 92) * 100;

  return (
    <div className="min-h-screen bg-[#05050A] pb-4" data-testid="player-studio">
      {/* Song Header */}
      <div className="relative">
        <div className="absolute inset-0 bg-gradient-to-b from-[#8A2BE2]/10 to-[#05050A] z-0" />
        <div className="relative z-10 px-4 pt-6 pb-4 flex items-center gap-4">
          <div className="w-20 h-20 rounded-2xl overflow-hidden border border-white/10 flex-shrink-0">
            {song.cover_url ? (
              <img src={song.cover_url} alt={song.title} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-[#12121A] flex items-center justify-center text-[#8A2BE2] text-2xl font-bold">
                {song.title?.[0] || "?"}
              </div>
            )}
          </div>
          <div className="min-w-0">
            <h2
              className="font-['Outfit'] text-xl font-bold truncate"
              data-testid="song-title"
            >
              {song.title}
            </h2>
            <p className="text-[#A0A0B0] text-sm truncate" data-testid="song-artist">
              {song.artist}
            </p>
            {song.genre && (
              <span className="text-xs text-[#8A2BE2] uppercase tracking-[0.2em] font-bold mt-1 inline-block">
                {song.genre}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Playback Controls */}
      <div className="px-4 py-3" data-testid="playback-controls">
        {/* Progress bar */}
        <div className="relative h-1 bg-white/10 rounded-full mb-3 cursor-pointer"
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const pct = (e.clientX - rect.left) / rect.width;
            setCurrentTime(pct * 92);
          }}
        >
          <div
            className="absolute top-0 left-0 h-full bg-[#8A2BE2] rounded-full transition-all"
            style={{ width: `${progress}%` }}
          />
          <div
            className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-lg"
            style={{ left: `${progress}%`, transform: `translate(-50%, -50%)` }}
          />
        </div>
        <div className="flex items-center justify-between text-xs text-[#606070] mb-3">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(92)}</span>
        </div>

        {/* Play/Pause */}
        <div className="flex items-center justify-center gap-6">
          <Button
            data-testid="restart-btn"
            variant="ghost"
            size="icon"
            onClick={handleRestart}
            className="text-[#A0A0B0] hover:text-white"
          >
            <SkipBack className="w-5 h-5" />
          </Button>
          <Button
            data-testid="play-pause-btn"
            onClick={togglePlay}
            className="w-14 h-14 rounded-full bg-[#8A2BE2] hover:bg-[#9D4CDD] text-white glow-violet transition-all"
          >
            {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 ml-1" />}
          </Button>
          <Button
            data-testid="record-btn"
            variant="ghost"
            size="icon"
            onClick={onRecord}
            className="text-[#A0A0B0] hover:text-[#00E5FF]"
          >
            <Mic className="w-5 h-5" />
          </Button>
        </div>
      </div>

      {/* Stem Mixer */}
      <div className="px-4 py-3">
        <h3 className="font-['Outfit'] text-sm uppercase tracking-[0.2em] font-bold text-[#A0A0B0] mb-3">
          Stem Mixer
        </h3>
        <StemMixer
          volumes={stemVolumes}
          muted={mutedStems}
          onVolumeChange={handleVolumeChange}
          onMuteToggle={handleMuteToggle}
        />
      </div>

      {/* Split Screen - Chords | Lyrics */}
      <div className="px-4 py-3">
        <h3 className="font-['Outfit'] text-sm uppercase tracking-[0.2em] font-bold text-[#A0A0B0] mb-3">
          Chords & Lyrics
        </h3>
        <SplitScreen lyrics={lyrics} currentTime={currentTime} />
      </div>
    </div>
  );
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}
