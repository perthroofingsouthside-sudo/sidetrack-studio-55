import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Play, Pause, SkipBack, Mic, Upload, Loader2, Guitar, AlignLeft, ChevronDown, Search, Music2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { API } from "@/App";
import axios from "axios";
import StemMixer from "@/components/StemMixer";
import BeatMaker from "@/components/BeatMaker";

export default function PlayerStudio({ song, onRecord, onSongSelect }) {
  const [lyrics, setLyrics] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [stems, setStems] = useState(null);
  const [separating, setSeparating] = useState(false);
  const [showChords, setShowChords] = useState(false);
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
  const lyricsScrollRef = useRef(null);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [song?.id]);

  useEffect(() => {
    Object.keys(audioRefs.current).forEach((stem) => {
      const el = audioRefs.current[stem];
      if (el) {
        el.volume = mutedStems[stem] ? 0 : stemVolumes[stem] / 100;
      }
    });
  }, [stemVolumes, mutedStems]);

  const fetchLyrics = async () => {
    // Try song-specific endpoint first (works when song is in DB)
    try {
      const res = await axios.get(`${API}/songs/${song.id}/lyrics`);
      if (res.data.success) { setLyrics(res.data); return; }
    } catch (err) { console.error("Lyrics DB fetch failed, trying direct:", err); }

    // Fallback: fetch lyrics directly by title + artist (for iTunes/stream tracks)
    try {
      const params = new URLSearchParams({ track: song.title || "" });
      if (song.artist) params.set("artist", song.artist);
      const res = await axios.get(`${API}/lyrics/fetch?${params}`);
      if (res.data.success) { setLyrics(res.data); return; }
    } catch (err) { console.error("Direct lyrics fetch failed:", err); }
  };

  const checkExistingStems = async () => {
    try {
      const res = await axios.get(`${API}/songs/${song.id}/stems`);
      if (res.data.success && res.data.stems?.status === "completed" && res.data.stems.vocals_url?.startsWith("http")) {
        setStems(res.data.stems);
        initAudioPlayers(res.data.stems);
      }
    } catch (err) { console.error("Stems check failed:", err); }
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
    if (file.size > 50 * 1024 * 1024) { toast.error("File too large. Max 50MB."); return; }
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
            } catch (err) { console.error("Stem poll error:", err); }
          }, 5000);
        }
      }
    } catch (err) {
      setSeparating(false);
      toast.error(err.response?.data?.detail || "Separation failed");
    }
  };

  const togglePlay = useCallback(() => {
    const hasRealStems = stems && stems.vocals_url?.startsWith("http");
    if (isPlaying) {
      clearInterval(intervalRef.current);
      if (hasRealStems) Object.values(audioRefs.current).forEach((a) => a?.pause());
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
    if (hasRealStems) Object.values(audioRefs.current).forEach((a) => { if (a) a.currentTime = 0; });
    if (!isPlaying) {
      setIsPlaying(true);
      if (hasRealStems) Object.values(audioRefs.current).forEach((a) => { if (a) a.play().catch(() => {}); });
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

  // Lyrics tracking
  const activeLyricIdx = useMemo(() => {
    if (!lyrics?.lyrics) return -1;
    for (let i = lyrics.lyrics.length - 1; i >= 0; i--) {
      if (currentTime >= lyrics.lyrics[i].time) return i;
    }
    return 0;
  }, [lyrics?.lyrics, currentTime]);

  const currentChord = useMemo(() => {
    if (!lyrics?.chords) return null;
    for (let i = lyrics.chords.length - 1; i >= 0; i--) {
      if (currentTime >= lyrics.chords[i].time) return lyrics.chords[i];
    }
    return lyrics.chords[0] || null;
  }, [lyrics?.chords, currentTime]);

  const nextChords = useMemo(() => {
    if (!lyrics?.chords) return [];
    const idx = lyrics.chords.findIndex((c) => c.time > currentTime);
    if (idx === -1) return [];
    return lyrics.chords.slice(idx, idx + 4);
  }, [lyrics?.chords, currentTime]);

  // Lyrics auto-scroll DISABLED by user request.
  // The page was being hijacked on every active-line change. Users can manually
  // tap the "Sync to current line" button below the lyrics to jump.
  const scrollToActiveLyric = useCallback(() => {
    if (activeLyricIdx < 0 || !lyricsScrollRef.current) return;
    const container = lyricsScrollRef.current;
    const el = container.querySelector(`[data-lyric-idx="${activeLyricIdx}"]`);
    if (!el) return;
    const containerRect = container.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    const targetTop = container.scrollTop + (elRect.top - containerRect.top) - (containerRect.height / 2) + (elRect.height / 2);
    // Use 'auto' (not smooth) so even if scrolling propagates, it's instant —
    // and confined to this container only via scrollTop (not scrollTo).
    container.scrollTop = Math.max(0, targetTop);
  }, [activeLyricIdx]);

  if (!song) return <StudioSearchScreen onSongSelect={onSongSelect} />;

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
            <h2 className="font-['Outfit'] text-xl font-bold truncate" data-testid="song-title">{song.title}</h2>
            <p className="text-[#A0A0B0] text-sm truncate" data-testid="song-artist">{song.artist}</p>
            {song.genre && (
              <span className="text-xs text-[#FF6B00] uppercase tracking-[0.2em] font-bold mt-1 inline-block">{song.genre}</span>
            )}
            {lyrics?.source && (
              <span className="text-[10px] text-[#39FF14]/60 uppercase tracking-wider ml-2">
                {lyrics.source === "lrclib" ? (lyrics.synced ? "Synced" : "LRCLIB") : ""}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Playback Controls */}
      <div className="px-4 py-3" data-testid="playback-controls">
        <div className="relative h-1 bg-white/10 rounded-full mb-3 cursor-pointer"
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const pct = (e.clientX - rect.left) / rect.width;
            const newTime = pct * duration;
            setCurrentTime(newTime);
            if (hasRealStems) Object.values(audioRefs.current).forEach((a) => { if (a) a.currentTime = newTime; });
          }}
        >
          <div className="absolute top-0 left-0 h-full neon-progress transition-all" style={{ width: `${progress}%` }} />
          <div className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-lg" style={{ left: `${progress}%`, transform: `translate(-50%, -50%)` }} />
        </div>
        <div className="flex items-center justify-between text-xs text-[#606070] mb-3">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
        <div className="flex items-center justify-center gap-6">
          <Button data-testid="restart-btn" variant="ghost" size="icon" onClick={handleRestart} className="text-[#A0A0B0] hover:text-white">
            <SkipBack className="w-5 h-5" />
          </Button>
          <Button data-testid="play-pause-btn" onClick={togglePlay}
            className="w-14 h-14 rounded-full bg-[#FF6B00] hover:bg-[#FF8533] text-white glow-orange transition-all">
            {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 ml-1" />}
          </Button>
          <Button data-testid="record-btn" variant="ghost" size="icon" onClick={onRecord} className="text-[#A0A0B0] hover:text-[#39FF14]">
            <Mic className="w-5 h-5" />
          </Button>
        </div>
      </div>

      {/* ── Synced Lyrics ─────────────────────────── */}
      <div className="px-4 py-3" data-testid="synced-lyrics-section">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-['Outfit'] text-sm uppercase tracking-[0.2em] font-bold text-[#A0A0B0] flex items-center gap-2">
            <AlignLeft className="w-4 h-4 text-[#39FF14]" /> Lyrics
            {lyrics?.synced && <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-[#39FF14]/15 text-[#39FF14] uppercase font-bold">Synced</span>}
          </h3>
          <div className="flex items-center gap-2">
            {/* Manual Sync — opt-in, never hijacks the page */}
            <Button
              data-testid="lyrics-sync-btn"
              variant="ghost"
              onClick={scrollToActiveLyric}
              className="h-7 px-3 rounded-full text-[10px] font-bold uppercase tracking-wider gap-1 border border-[#39FF14]/30 text-[#39FF14] bg-[#39FF14]/10 hover:bg-[#39FF14]/20 transition-all"
            >
              <AlignLeft className="w-3 h-3" /> Sync
            </Button>
            {/* Chords Toggle */}
            <Button
              data-testid="chords-toggle-btn"
              variant="ghost"
              onClick={() => setShowChords(!showChords)}
              className={`h-7 px-3 rounded-full text-[10px] font-bold uppercase tracking-wider gap-1 border transition-all ${
                showChords
                  ? "border-[#FF6B00]/40 text-[#FF6B00] bg-[#FF6B00]/10"
                  : "border-white/10 text-[#5C5C6B] hover:border-white/20"
              }`}
            >
              <Guitar className="w-3 h-3" /> Chords {showChords ? "On" : "Off"}
            </Button>
          </div>
        </div>

        {/* Chords strip — visible when toggled on */}
        {showChords && currentChord && (
          <div className="mb-3 rounded-xl border border-[#FF6B00]/20 p-3 flex items-center gap-4" style={{ background: "rgba(255,107,0,0.05)" }} data-testid="chords-strip">
            <div className="text-center">
              <div className="text-3xl font-['Outfit'] font-black text-[#FF6B00] glow-text-orange">{currentChord.chord}</div>
              <ChordDots chord={currentChord.chord} />
            </div>
            <div className="flex gap-2 flex-wrap">
              {nextChords.map((c, i) => (
                <span key={`${c.time}-${i}`} className="text-sm font-['Outfit'] font-bold px-2.5 py-1 rounded-lg bg-[#FF6B00]/10 text-[#FF6B00]/60">{c.chord}</span>
              ))}
            </div>
          </div>
        )}

        {/* Lyrics body */}
        <div
          className="surface-card rounded-2xl overflow-hidden"
          style={{ maxHeight: showChords ? 280 : 340 }}
        >
          <div className="overflow-y-auto h-full px-4 py-3 space-y-1" ref={lyricsScrollRef} data-testid="lyrics-scroll-area">
            {lyrics?.lyrics ? (
              lyrics.lyrics.map((line, i) => {
                const lineKey = `${line.time}-${line.type}-${i}`;
                if (line.type === "section") {
                  return (
                    <p
                      key={lineKey}
                      data-lyric-idx={i}
                      className={`text-[10px] uppercase tracking-[0.2em] font-bold pt-3 pb-1 transition-colors duration-300 ${
                        i === activeLyricIdx ? "text-[#FF6B00]" : "text-[#5C5C6B]"
                      }`}
                    >
                      {line.text}
                    </p>
                  );
                }
                if (line.type === "break") return <div key={lineKey} data-lyric-idx={i} className="h-3" />;
                const isActive = i === activeLyricIdx;
                const isPast = i < activeLyricIdx;
                return (
                  <p
                    key={lineKey}
                    data-lyric-idx={i}
                    data-testid={isActive ? "active-lyric-line" : undefined}
                    className={`text-base leading-relaxed transition-all duration-300 ${
                      isActive
                        ? "text-[#39FF14] font-semibold scale-[1.01]"
                        : isPast
                        ? "text-[#5C5C6B]/40"
                        : "text-[#8F8F9D]"
                    }`}
                    style={
                      isActive
                        ? { textShadow: "0 0 18px rgba(57,255,20,0.6), 0 0 40px rgba(57,255,20,0.2)" }
                        : undefined
                    }
                  >
                    {line.text}
                  </p>
                );
              })
            ) : (
              <div className="py-10 text-center">
                <AlignLeft className="w-8 h-8 text-[#FF6B00]/15 mx-auto mb-2" />
                <p className="text-sm text-[#5C5C6B]">Loading lyrics...</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Stem Mixer */}
      <div className="px-4 py-3">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-['Outfit'] text-sm uppercase tracking-[0.2em] font-bold text-[#A0A0B0]">Stem Mixer</h3>
          {!hasRealStems && (
            <div>
              <input ref={fileInputRef} type="file" accept="audio/*" className="hidden" onChange={handleUploadForSeparation} data-testid="stem-upload-input" />
              <Button data-testid="upload-for-separation-btn" onClick={() => fileInputRef.current?.click()} disabled={separating}
                className="h-8 px-3 text-xs rounded-xl bg-[#FF6B00] hover:bg-[#FF8533] text-white gap-1.5 transition-all">
                {separating ? <><Loader2 className="w-3 h-3 animate-spin" /> Separating...</> : <><Upload className="w-3 h-3" /> Upload Song</>}
              </Button>
            </div>
          )}
          {hasRealStems && <span className="text-[10px] text-[#39FF14] uppercase tracking-widest font-bold">Live Stems</span>}
        </div>
        <StemMixer volumes={stemVolumes} muted={mutedStems} onVolumeChange={handleVolumeChange} onMuteToggle={handleMuteToggle} />
      </div>

      {/* Beat Maker (Studio AI) */}
      <div className="px-4 pb-6 pt-2">
        <BeatMaker userId={localStorage.getItem("sidetrack_voter_id") || "anon"} />
      </div>
    </div>
  );
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/* ── Studio Search + Original Screen ────────── */
function StudioSearchScreen({ onSongSelect }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [showOriginal, setShowOriginal] = useState(false);
  const [uploading, setUploading] = useState(null);
  const [importing, setImporting] = useState(false);
  const inputRef = useRef(null);
  const deviceImportRef = useRef(null);

  useEffect(() => { if (!showOriginal) inputRef.current?.focus(); }, [showOriginal]);

  const doSearch = async () => {
    if (!query.trim()) return;
    setSearching(true);
    try {
      const res = await axios.get(`${API}/music/search?q=${encodeURIComponent(query)}&limit=15`);
      if (res.data?.success) setResults(res.data.tracks);
    } catch { toast.error("Search failed"); }
    finally { setSearching(false); }
  };

  const selectTrack = (track) => {
    if (onSongSelect) onSongSelect({
      id: track.id || crypto.randomUUID(), title: track.title, artist: track.artist,
      album: track.album || "", cover_url: track.cover_url || "", genre: track.genre || "",
      preview_url: track.preview_url || "",
    });
  };

  // Import an audio/video file from device → open as a "song" in Studio.
  const handleDeviceImport = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 50 * 1024 * 1024) { toast.error("File too large (max 50MB)"); return; }
    setImporting(true);
    try {
      const url = URL.createObjectURL(file);
      const baseName = file.name.replace(/\.[^/.]+$/, "");
      const song = {
        id: `import-${Date.now()}`,
        title: baseName || "Imported Track",
        artist: localStorage.getItem("sidetrack_username") || "You",
        album: "Device Import",
        cover_url: "",
        genre: "imported",
        preview_url: url,
        is_local_import: true,
        local_blob: file,
      };
      if (onSongSelect) onSongSelect(song);
      toast.success(`Imported "${baseName}" — opening in Studio`);
    } catch (err) {
      toast.error("Couldn't import file");
    } finally {
      setImporting(false);
      // Reset input so the same file can be re-imported
      if (e.target) e.target.value = "";
    }
  };

  const handleStemUpload = async (stemType, file) => {
    if (!file) return;
    setUploading(stemType);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("stem_type", stemType);
      formData.append("username", localStorage.getItem("sidetrack_username") || "anonymous");
      await axios.post(`${API}/recordings`, { song_id: "original", title: `Original ${stemType}`, recording_type: stemType });
      toast.success(`${stemType} stem uploaded!`);
    } catch { toast.error(`Failed to upload ${stemType}`); }
    finally { setUploading(null); }
  };

  if (showOriginal) {
    return (
      <div className="min-h-screen bg-[#05050A] flex flex-col items-center px-6 pt-12" data-testid="original-mode">
        <Sparkles className="w-10 h-10 text-[#39FF14]/40 mb-3" />
        <h2 className="font-['Outfit'] text-2xl sm:text-3xl font-black text-white mb-1">
          Create <span className="text-[#39FF14]">Original</span> Music
        </h2>
        <p className="text-sm text-[#5C5C6B] mb-8 text-center">Upload your stems so other artists can cover your track</p>

        <div className="w-full max-w-md space-y-3" data-testid="stem-upload-section">
          {["Vocals", "Guitar", "Bass", "Drums"].map((stem) => (
            <label key={stem} className="flex items-center gap-4 p-4 rounded-xl border border-white/5 hover:border-[#39FF14]/30 transition-all cursor-pointer group" data-testid={`upload-stem-${stem.toLowerCase()}`}>
              <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ background: "rgba(57,255,20,0.08)" }}>
                <Upload className="w-4 h-4 text-[#39FF14]" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold text-white group-hover:text-[#39FF14] transition-colors">{stem}</p>
                <p className="text-[10px] text-[#5C5C6B]">Upload {stem.toLowerCase()} stem (.wav, .mp3)</p>
              </div>
              {uploading === stem.toLowerCase() ? (
                <Loader2 className="w-4 h-4 text-[#39FF14] animate-spin" />
              ) : (
                <span className="text-[10px] text-[#5C5C6B] uppercase tracking-wider font-bold opacity-0 group-hover:opacity-100">Choose File</span>
              )}
              <input type="file" accept="audio/*" className="hidden" onChange={(e) => handleStemUpload(stem.toLowerCase(), e.target.files?.[0])} />
            </label>
          ))}
        </div>

        <Button onClick={() => setShowOriginal(false)} variant="ghost" className="mt-6 text-[#5C5C6B]" data-testid="back-to-search">
          Back to Search
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#05050A] flex flex-col" data-testid="studio-search-screen">
      <div className={`flex-1 flex flex-col items-center px-6 ${results.length ? "pt-8" : "justify-center"}`}>
        <Music2 className="w-12 h-12 text-[#FF6B00]/30 mb-3" />
        <h2 className="font-['Outfit'] text-2xl sm:text-3xl font-black text-white mb-1" data-testid="studio-search-title">
          What do you want to <span className="text-[#FF6B00]">remix</span>?
        </h2>
        <p className="text-sm text-[#5C5C6B] mb-6 text-center">Find a track to open in the Studio, or create original music</p>

        <div className="w-full max-w-lg flex gap-2 mb-4">
          <Input ref={inputRef} data-testid="studio-search-input" value={query}
            onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === "Enter" && doSearch()}
            placeholder="Search songs, artists, albums..."
            className="h-12 bg-[#0F0F16] border-white/10 text-white placeholder:text-[#5C5C6B] rounded-xl text-base focus:border-[#FF6B00] focus:ring-[#FF6B00]/20" />
          <Button data-testid="studio-search-btn" onClick={doSearch} disabled={searching}
            className="h-12 px-6 rounded-xl bg-[#FF6B00] hover:bg-[#FF8533] text-white font-bold text-sm shrink-0"
            style={{ boxShadow: "0 0 20px rgba(255,107,0,0.3)" }}>
            {searching ? "..." : <><Search className="w-4 h-4 mr-1.5" /> Search</>}
          </Button>
        </div>

        {/* Action row: Original + Import from device */}
        <div className="flex flex-wrap items-center justify-center gap-2 mb-6">
          <Button onClick={() => setShowOriginal(true)} variant="ghost" data-testid="original-music-btn"
            className="h-10 px-5 rounded-full border border-[#39FF14]/30 text-[#39FF14] text-xs font-bold gap-2 hover:bg-[#39FF14]/10 transition-all">
            <Sparkles className="w-3.5 h-3.5" /> Start Original — Upload Stems
          </Button>

          <input
            ref={deviceImportRef}
            type="file"
            accept="audio/*,video/*"
            className="hidden"
            onChange={handleDeviceImport}
            data-testid="studio-device-import-input"
          />
          <Button
            onClick={() => deviceImportRef.current?.click()}
            disabled={importing}
            variant="ghost"
            data-testid="studio-device-import-btn"
            className="h-10 px-5 rounded-full border border-[#FF6B00]/30 text-[#FF6B00] text-xs font-bold gap-2 hover:bg-[#FF6B00]/10 transition-all"
          >
            {importing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
            Import from Device
          </Button>
        </div>

        {/* Results */}
        {results.length > 0 && (
          <div className="w-full max-w-lg space-y-1 pb-24" data-testid="studio-search-results">
            {results.map((track, idx) => (
              <button key={track.id || idx} data-testid={`studio-track-${idx}`} onClick={() => selectTrack(track)}
                className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-[#FF6B00]/8 transition-all text-left group">
                <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 border border-white/5 group-hover:border-[#FF6B00]/30 relative">
                  {track.cover_url ? (
                    <img src={track.cover_url} alt="" className="w-full h-full object-cover" loading="lazy" />
                  ) : (
                    <div className="w-full h-full bg-[#12121A] flex items-center justify-center"><Music2 className="w-5 h-5 text-[#5C5C6B]" /></div>
                  )}
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Play className="w-5 h-5 text-[#FF6B00]" />
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate group-hover:text-[#FF6B00] transition-colors">{track.title}</p>
                  <p className="text-[10px] text-[#5C5C6B] truncate">{track.artist}</p>
                </div>
                <span className="text-[10px] text-[#FF6B00] font-bold uppercase tracking-wider opacity-0 group-hover:opacity-100 transition-opacity shrink-0">Open</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ChordDots({ chord }) {
  const shapes = {
    Am: [-1,0,2,2,1,0], C: [-1,3,2,0,1,0], G: [3,2,0,0,0,3], F: [1,3,3,2,1,1],
    Dm: [-1,-1,0,2,3,1], Em: [0,2,2,0,0,0], D: [-1,-1,0,2,3,2], E: [0,2,2,1,0,0],
    A: [-1,0,2,2,2,0], B: [-1,2,4,4,4,2],
  };
  const frets = shapes[chord];
  if (!frets) return null;
  const W = 72, H = 64, sx = 8, sy = 6, gx = (W - 2 * sx) / 5, gy = (H - sy - 6) / 4;
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="mt-1" data-testid="chord-svg">
      {/* Nut line */}
      <line x1={sx} y1={sy} x2={W - sx} y2={sy} stroke="#FF6B00" strokeWidth="2.5" />
      {/* Fret lines */}
      {[1,2,3,4].map((f) => (
        <line key={f} x1={sx} y1={sy + f * gy} x2={W - sx} y2={sy + f * gy} stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
      ))}
      {/* String lines */}
      {[0,1,2,3,4,5].map((s) => (
        <line key={s} x1={sx + s * gx} y1={sy} x2={sx + s * gx} y2={H - 6} stroke="rgba(255,255,255,0.12)" strokeWidth="0.8" />
      ))}
      {/* Finger dots */}
      {frets.map((f, i) => {
        if (f <= 0) return null;
        const cx = sx + i * gx, cy = sy + (f - 0.5) * gy;
        return <circle key={`dot-${i}`} cx={cx} cy={cy} r={4} fill="#FF6B00" filter="url(#glow)" />;
      })}
      {/* Open / muted indicators */}
      {frets.map((f, i) => {
        const cx = sx + i * gx;
        if (f === 0) return <circle key={`o${i}`} cx={cx} cy={sy - 4} r={2.5} fill="none" stroke="#39FF14" strokeWidth="1" />;
        if (f === -1) return <text key={`x${i}`} x={cx} y={sy - 2} textAnchor="middle" fill="#5C5C6B" fontSize="6" fontWeight="bold">x</text>;
        return null;
      })}
      <defs><filter id="glow"><feGaussianBlur stdDeviation="2" result="b" /><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
    </svg>
  );
}
