import { useState, useEffect, useRef, useCallback } from "react";
import { Play, Pause, SkipBack, Mic, Upload, Loader2 } from "lucide-react";
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
  const [stems, setStems] = useState(null);
  const [separating, setSeparating] = useState(false);
  const [stemVolumes, setStemVolumes] = useState({
    vocals: 80, guitar: 80, bass: 80, drums: 80,
  });
  const [mutedStems, setMutedStems] = useState({
    vocals: false, guitar: false, bass: false, drums: false,
  });
  const intervalRef = useRef(null);
  const fileInputRef = useRef(null);
  const audioRefs = useRef({ vocals: null, guitar: null, bass: null, drums: null });
  const pollRef = useRef(null);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (song?.id) {
      fetchLyrics();
      checkExistingStems();
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (pollRef.current) clearInterval(pollRef.current);
      Object.values(audioRefs.current).forEach((a) => { if (a) { a.pause(); a.src = ""; } });
    };
  }, [song?.id]);

  // Apply volume/mute changes to audio elements
  useEffect(() => {
    Object.keys(audioRefs.current).forEach((stem) => {
      const el = audioRefs.current[stem];
      if (el) {
        el.volume = mutedStems[stem] ? 0 : stemVolumes[stem] / 100;
      }
    });
  }, [stemVolumes, mutedStems]);

  const fetchLyrics = async () => {
    try {
      const res = await axios.get(`${API}/songs/${song.id}/lyrics`);
      if (res.data.success) setLyrics(res.data);
    } catch (err) {
      toast.error("Failed to load lyrics");
    }
  };

  const checkExistingStems = async () => {
    try {
      const res = await axios.get(`${API}/songs/${song.id}/stems`);
      if (res.data.success && res.data.stems?.status === "completed" && res.data.stems.vocals_url?.startsWith("http")) {
        setStems(res.data.stems);
        initAudioPlayers(res.data.stems);
      }
    } catch (err) {
      // No existing stems
    }
  };

  const initAudioPlayers = (stemData) => {
    const mapping = { vocals: "vocals_url", guitar: "guitar_url", bass: "bass_url", drums: "drums_url" };
    Object.entries(mapping).forEach(([key, urlKey]) => {
      if (stemData[urlKey] && stemData[urlKey].startsWith("http")) {
        const audio = new Audio(stemData[urlKey]);
        audio.crossOrigin = "anonymous";
        audio.volume = mutedStems[key] ? 0 : stemVolumes[key] / 100;
        audioRefs.current[key] = audio;
      }
    });
  };

  const handleUploadForSeparation = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const maxSize = 50 * 1024 * 1024; // 50MB
    if (file.size > maxSize) {
      toast.error("File too large. Max 50MB.");
      return;
    }

    setSeparating(true);
    toast.info("Uploading audio for stem separation...");

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await axios.post(`${API}/songs/${song.id}/separate`, formData);

      if (res.data.success) {
        if (res.data.cached) {
          setStems(res.data.stems);
          initAudioPlayers(res.data.stems);
          toast.success("Stems loaded from cache!");
          setSeparating(false);
        } else {
          toast.info("Separation in progress... This may take 1-3 minutes.");
          // Poll for completion
          pollRef.current = setInterval(async () => {
            try {
              const pollRes = await axios.get(`${API}/songs/${song.id}/stems`);
              if (pollRes.data.success && pollRes.data.stems?.status === "completed") {
                clearInterval(pollRef.current);
                setStems(pollRes.data.stems);
                initAudioPlayers(pollRes.data.stems);
                setSeparating(false);
                toast.success("Stems separated successfully!");
              } else if (pollRes.data.stems?.status === "failed") {
                clearInterval(pollRef.current);
                setSeparating(false);
                toast.error("Separation failed: " + (pollRes.data.stems?.error || "Unknown error"));
              }
            } catch (err) { /* keep polling */ }
          }, 5000);
        }
      }
    } catch (err) {
      setSeparating(false);
      const detail = err.response?.data?.detail || "Separation failed";
      toast.error(detail);
    }
  };

  const togglePlay = useCallback(() => {
    const hasRealStems = stems && stems.vocals_url?.startsWith("http");

    if (isPlaying) {
      clearInterval(intervalRef.current);
      if (hasRealStems) {
        Object.values(audioRefs.current).forEach((a) => a?.pause());
      }
      setIsPlaying(false);
    } else {
      setIsPlaying(true);
      if (hasRealStems) {
        Object.values(audioRefs.current).forEach((a) => {
          if (a) { a.currentTime = currentTime; a.play().catch(() => {}); }
        });
      }
      intervalRef.current = setInterval(() => {
        setCurrentTime((prev) => {
          const dur = hasRealStems ? (audioRefs.current.vocals?.duration || 92) : 92;
          if (prev >= dur) {
            clearInterval(intervalRef.current);
            if (hasRealStems) Object.values(audioRefs.current).forEach((a) => a?.pause());
            setIsPlaying(false);
            return 0;
          }
          return prev + 0.5;
        });
      }, 500);
    }
  }, [isPlaying, stems, currentTime]);

  const handleRestart = useCallback(() => {
    setCurrentTime(0);
    const hasRealStems = stems && stems.vocals_url?.startsWith("http");
    if (hasRealStems) {
      Object.values(audioRefs.current).forEach((a) => { if (a) a.currentTime = 0; });
    }
    if (!isPlaying) {
      setIsPlaying(true);
      if (hasRealStems) {
        Object.values(audioRefs.current).forEach((a) => { if (a) a.play().catch(() => {}); });
      }
      intervalRef.current = setInterval(() => {
        setCurrentTime((prev) => {
          const dur = hasRealStems ? (audioRefs.current.vocals?.duration || 92) : 92;
          if (prev >= dur) {
            clearInterval(intervalRef.current);
            if (hasRealStems) Object.values(audioRefs.current).forEach((a) => a?.pause());
            setIsPlaying(false);
            return 0;
          }
          return prev + 0.5;
        });
      }, 500);
    }
  }, [isPlaying, stems]);

  const handleVolumeChange = useCallback((stem, value) => {
    setStemVolumes((prev) => ({ ...prev, [stem]: value }));
  }, []);

  const handleMuteToggle = useCallback((stem) => {
    setMutedStems((prev) => ({ ...prev, [stem]: !prev[stem] }));
  }, []);

  if (!song) return null;

  const hasRealStems = stems && stems.vocals_url?.startsWith("http");
  const duration = hasRealStems ? (audioRefs.current.vocals?.duration || 92) : 92;
  const progress = (currentTime / duration) * 100;

  return (
    <div className="min-h-screen bg-[#05050A] pb-4" data-testid="player-studio">
      {/* Song Header */}
      <div className="relative">
        <div className="absolute inset-0 bg-gradient-to-b from-[#FF6B00]/10 to-[#05050A] z-0" />
        <div className="relative z-10 px-4 pt-6 pb-4 flex items-center gap-4">
          <div className="w-20 h-20 rounded-2xl overflow-hidden border border-white/10 flex-shrink-0">
            {song.cover_url ? (
              <img src={song.cover_url} alt={song.title} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-[#12121A] flex items-center justify-center text-[#FF6B00] text-2xl font-bold">
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
              <span className="text-xs text-[#FF6B00] uppercase tracking-[0.2em] font-bold mt-1 inline-block">
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
            className="absolute top-0 left-0 h-full bg-[#FF6B00] rounded-full transition-all"
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
            className="w-14 h-14 rounded-full bg-[#FF6B00] hover:bg-[#FF8533] text-white glow-orange transition-all"
          >
            {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 ml-1" />}
          </Button>
          <Button
            data-testid="record-btn"
            variant="ghost"
            size="icon"
            onClick={onRecord}
            className="text-[#A0A0B0] hover:text-[#39FF14]"
          >
            <Mic className="w-5 h-5" />
          </Button>
        </div>
      </div>

      {/* Stem Mixer */}
      <div className="px-4 py-3">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-['Outfit'] text-sm uppercase tracking-[0.2em] font-bold text-[#A0A0B0]">
            Stem Mixer
          </h3>
          {!hasRealStems && (
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept="audio/*"
                className="hidden"
                onChange={handleUploadForSeparation}
                data-testid="stem-upload-input"
              />
              <Button
                data-testid="upload-for-separation-btn"
                onClick={() => fileInputRef.current?.click()}
                disabled={separating}
                className="h-8 px-3 text-xs rounded-xl bg-[#FF6B00] hover:bg-[#FF8533] text-white gap-1.5 transition-all"
              >
                {separating ? (
                  <><Loader2 className="w-3 h-3 animate-spin" /> Separating...</>
                ) : (
                  <><Upload className="w-3 h-3" /> Upload Song</>
                )}
              </Button>
            </div>
          )}
          {hasRealStems && (
            <span className="text-[10px] text-[#39FF14] uppercase tracking-widest font-bold">Live Stems</span>
          )}
        </div>
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
