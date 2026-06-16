import { useState, useRef, useEffect, useCallback } from "react";
import { Mic, Loader2, Search, ListMusic, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { API } from "@/App";
import axios from "axios";
import NowPlayingHero from "@/components/NowPlayingHero";

export default function HomePage({
  onSongRecognized, onTrackSelect, onOpenPlaylists, nowPlaying,
  isPlaying, progress, togglePlayPause, handleSeek, openInStudio,
}) {
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState([]);
  const [hipHop, setHipHop] = useState([]);
  const [altRock, setAltRock] = useState([]);
  const [playlists, setPlaylists] = useState([]);
  // When something is playing, allow user to *temporarily* override the hero
  // to find another track (search/recognize). Reset to hero on track change.
  const [showSearchOverlay, setShowSearchOverlay] = useState(false);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);
  const userId = useRef(localStorage.getItem("sidetrack_voter_id") || "anon");

  // Reset the overlay whenever the playing track changes so the hero re-appears
  useEffect(() => {
    setShowSearchOverlay(false);
  }, [nowPlaying?.id]);

  useEffect(() => {
    return () => {
      if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
    };
  }, []);

  // Load side rail albums on mount (Hip-Hop left, Alt-Rock right) + user playlists
  useEffect(() => {
    const load = async () => {
      try {
        const [hh1, hh2, ar1, ar2, pls] = await Promise.all([
          axios.get(`${API}/music/search?q=${encodeURIComponent("hip hop")}&limit=20`),
          axios.get(`${API}/music/search?q=${encodeURIComponent("rap")}&limit=20`),
          axios.get(`${API}/music/search?q=${encodeURIComponent("alternative rock")}&limit=20`),
          axios.get(`${API}/music/search?q=${encodeURIComponent("indie rock")}&limit=20`),
          axios.get(`${API}/playlists?owner=${encodeURIComponent(userId.current)}`),
        ]);
        const pickFour = (lists) => {
          const seen = new Set();
          const out = [];
          for (const list of lists) {
            for (const t of (list || [])) {
              const key = t.cover_url;
              if (!key || seen.has(key)) continue;
              seen.add(key);
              out.push(t);
              if (out.length >= 4) return out;
            }
          }
          return out;
        };
        setHipHop(pickFour([hh1.data?.tracks, hh2.data?.tracks]));
        setAltRock(pickFour([ar1.data?.tracks, ar2.data?.tracks]));
        setPlaylists(pls.data?.playlists || []);
      } catch (err) { console.error("[Discover] side-rail load failed:", err); }
    };
    load();
  }, []);

  const startListening = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];
      mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        await recognizeSong(blob);
      };
      mediaRecorder.start();
      setIsListening(true);
      setTimeout(() => {
        if (mediaRecorder.state === "recording") { mediaRecorder.stop(); setIsListening(false); }
      }, 5000);
    } catch (err) { toast.error("Microphone access denied"); }
  };

  const stopListening = () => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
      setIsListening(false);
    }
  };

  const recognizeSong = async (blob) => {
    setIsProcessing(true);
    try {
      const formData = new FormData();
      formData.append("audio", blob, "recording.webm");
      const res = await axios.post(`${API}/recognize`, formData, { headers: { "Content-Type": "multipart/form-data" } });
      if (res.data.success && res.data.song) {
        toast.success(`Recognized: ${res.data.song.title}`);
        onSongRecognized && onSongRecognized(res.data.song);
      } else {
        toast.error("Couldn't recognize this track — try again");
      }
    } catch (err) {
      toast.error("Recognition failed. Please try again.");
    } finally { setIsProcessing(false); }
  };

  const doSearch = useCallback(async () => {
    if (!query.trim()) return;
    setSearching(true);
    try {
      const res = await axios.get(`${API}/music/search?q=${encodeURIComponent(query)}&limit=20`);
      setResults(res.data?.tracks || []);
    } catch (err) { toast.error("Search failed"); }
    finally { setSearching(false); }
  }, [query]);

  const pickTrack = (t) => {
    if (onTrackSelect) onTrackSelect(t);
  };

  return (
    <>
      {/* IMMERSIVE NOW-PLAYING HERO — shown whenever a track is playing on Discover.
          Users can tap recognize/search to overlay the hero with the picker layout. */}
      {nowPlaying && !showSearchOverlay && (
        <NowPlayingHero
          nowPlaying={nowPlaying}
          isPlaying={isPlaying}
          progress={progress}
          togglePlayPause={togglePlayPause}
          handleSeek={handleSeek}
          openInStudio={openInStudio}
          onTapRecognize={() => { setShowSearchOverlay(true); startListening(); }}
          onTapSearch={() => setShowSearchOverlay(true)}
        />
      )}
      {(!nowPlaying || showSearchOverlay) && (
    <div className="min-h-screen flex flex-col items-center justify-start relative overflow-hidden px-4 pt-10 pb-16"
         data-testid="home-page">
      {/* Background abstract */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-[#FF6B00]/5 blur-[120px]" />
        <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] rounded-full bg-[#39FF14]/5 blur-[100px]" />
      </div>

      {/* Logo + Title */}
      <div className="relative z-10 mb-6 animate-fade-in" data-testid="discover-logo">
        <div className="w-16 h-16 mx-auto mb-3 rounded-2xl bg-[#FF6B00]/10 border border-[#FF6B00]/30 flex items-center justify-center glow-orange">
          <svg width="36" height="36" viewBox="0 0 40 40" fill="none">
            <path d="M8 30V10L16 6V34L8 30Z" fill="#FF6B00"/>
            <path d="M18 28V12L26 8V32L18 28Z" fill="#39FF14" opacity="0.8"/>
            <path d="M28 26V14L34 11V29L28 26Z" fill="#FF6B00" opacity="0.6"/>
          </svg>
        </div>
        <h1 className="font-['Outfit'] text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tighter text-center">
          <span className="text-white">Pocket </span>
          <span className="text-[#FF6B00] glow-text-orange">Products</span>
        </h1>
        <p className="text-[#A0A0B0] text-xs sm:text-sm mt-2 text-center font-['Manrope']">Recognize. Separate. Create.</p>
      </div>

      {/* Mic with radar rings */}
      <div className="relative z-10 flex items-center justify-center" data-testid="recognize-section">
        {isListening && (
          <>
            <div className="absolute w-40 h-40 rounded-full border border-[#FF6B00]/30 animate-pulse-ring" style={{ animationDelay: "0s" }} />
            <div className="absolute w-56 h-56 rounded-full border border-[#FF6B00]/20 animate-pulse-ring" style={{ animationDelay: "0.5s" }} />
            <div className="absolute w-72 h-72 rounded-full border border-[#FF6B00]/10 animate-pulse-ring" style={{ animationDelay: "1s" }} />
          </>
        )}
        <Button
          data-testid="shazam-button"
          onClick={isListening ? stopListening : startListening}
          disabled={isProcessing}
          className={`relative w-28 h-28 sm:w-32 sm:h-32 rounded-full flex items-center justify-center transition-all duration-300 ${
            isListening ? "bg-[#FF6B00] glow-orange scale-110"
              : isProcessing ? "bg-[#12121A] border border-white/10"
              : "bg-[#12121A] border border-[#FF6B00]/40 hover:border-[#FF6B00] hover:glow-orange hover:-translate-y-1"
          }`}
        >
          {isProcessing ? <Loader2 className="w-9 h-9 text-[#FF6B00] animate-spin" />
            : <Mic className={`w-9 h-9 ${isListening ? "text-white" : "text-[#FF6B00]"}`} />}
        </Button>
      </div>

      <p className="relative z-10 mt-4 text-xs text-[#A0A0B0] font-['Manrope'] text-center" data-testid="status-text">
        {isProcessing ? "Analyzing audio..." : isListening ? "Listening... Tap to stop" : "Tap to recognize a song"}
      </p>

      {/* SEARCH BAR — below the mic */}
      <div className="relative z-10 mt-7 w-full max-w-md" data-testid="discover-search">
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#5C5C6B]" />
            <Input
              data-testid="discover-search-input"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && doSearch()}
              placeholder="Search songs, artists, albums..."
              className="pl-10 h-11 bg-[#0F0F16]/80 border-white/10 focus-visible:ring-[#FF6B00]/50 text-sm rounded-xl"
            />
          </div>
          <Button onClick={doSearch} disabled={searching} data-testid="discover-search-btn"
            className="h-11 px-5 rounded-xl bg-[#FF6B00] hover:bg-[#FF8533] text-white font-bold text-sm"
            style={{ boxShadow: "0 0 18px rgba(255,107,0,0.35)" }}>
            {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4 mr-1.5" />}
            Search
          </Button>
        </div>
      </div>

      {/* YOUR PLAYLISTS — quick selector */}
      <div className="relative z-10 mt-5 w-full max-w-md" data-testid="discover-playlists">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <ListMusic className="w-3.5 h-3.5 text-[#39FF14]" />
            <p className="text-[10px] uppercase tracking-[0.25em] text-[#39FF14] font-black">Your Playlists</p>
          </div>
          <button
            onClick={() => onOpenPlaylists && onOpenPlaylists()}
            data-testid="discover-playlists-manage"
            className="text-[10px] text-[#5C5C6B] hover:text-white font-bold uppercase tracking-wider transition-colors"
          >
            Manage →
          </button>
        </div>

        {playlists.length === 0 ? (
          <button
            onClick={() => onOpenPlaylists && onOpenPlaylists()}
            data-testid="discover-playlists-empty"
            className="w-full flex items-center gap-3 p-3 rounded-xl border border-dashed border-[#39FF14]/25 hover:border-[#39FF14]/60 hover:bg-[#39FF14]/5 transition-all text-left group"
          >
            <div className="w-10 h-10 rounded-lg bg-[#39FF14]/10 flex items-center justify-center group-hover:bg-[#39FF14]/20 transition-colors">
              <Plus className="w-4 h-4 text-[#39FF14]" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-white">Create a playlist</p>
              <p className="text-[10px] text-[#5C5C6B]">Tap to start collecting your tracks</p>
            </div>
          </button>
        ) : (
          <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1" data-testid="discover-playlists-row">
            {playlists.slice(0, 8).map((pl, idx) => (
              <button
                key={pl.id || idx}
                onClick={() => onOpenPlaylists && onOpenPlaylists(pl)}
                data-testid={`discover-playlist-${idx}`}
                className="flex-shrink-0 w-28 rounded-xl border border-white/5 hover:border-[#39FF14]/40 hover:bg-[#39FF14]/5 transition-all text-left p-2 group"
              >
                <div className="w-full aspect-square rounded-lg overflow-hidden mb-1.5 border border-white/5 bg-gradient-to-br from-[#39FF14]/15 via-[#0F0F16] to-[#FF6B00]/10 flex items-center justify-center">
                  {pl.cover_url ? (
                    <img src={pl.cover_url} alt={pl.name} className="w-full h-full object-cover" />
                  ) : (
                    <ListMusic className="w-7 h-7 text-[#39FF14]/40 group-hover:text-[#39FF14] transition-colors" />
                  )}
                </div>
                <p className="text-xs font-bold text-white truncate">{pl.name || "Untitled"}</p>
                <p className="text-[10px] text-[#5C5C6B] truncate">
                  {pl.track_count != null ? `${pl.track_count} tracks` : (pl.tracks?.length || 0) + " tracks"}
                </p>
              </button>
            ))}
            <button
              onClick={() => onOpenPlaylists && onOpenPlaylists()}
              data-testid="discover-playlists-add"
              className="flex-shrink-0 w-28 rounded-xl border border-dashed border-white/10 hover:border-[#39FF14]/40 hover:bg-[#39FF14]/5 transition-all flex flex-col items-center justify-center p-2 gap-1.5"
            >
              <div className="w-9 h-9 rounded-lg bg-[#39FF14]/10 flex items-center justify-center">
                <Plus className="w-4 h-4 text-[#39FF14]" />
              </div>
              <p className="text-[10px] text-[#5C5C6B] font-bold uppercase tracking-wider">New</p>
            </button>
          </div>
        )}
      </div>

      {/* SIDE ALBUM RAILS — hidden on tiny screens, shown sm+ */}
      <SideRail side="left" label="Hip-Hop" tracks={hipHop} onPick={pickTrack} />
      <SideRail side="right" label="Alt-Rock" tracks={altRock} onPick={pickTrack} />

      {/* Search Results */}
      {results.length > 0 && (
        <div className="relative z-10 w-full max-w-md mt-6 space-y-1.5" data-testid="discover-search-results">
          <p className="text-[10px] uppercase tracking-[0.25em] text-[#5C5C6B] font-bold mb-2">Results</p>
          {results.slice(0, 12).map((t, idx) => (
            <button key={t.id || idx} onClick={() => pickTrack(t)} data-testid={`discover-result-${idx}`}
              className="w-full flex items-center gap-3 p-2.5 rounded-xl border border-white/5 hover:border-[#FF6B00]/30 hover:bg-[#FF6B00]/5 transition-all text-left">
              <div className="w-10 h-10 rounded-lg overflow-hidden border border-white/5 flex-shrink-0">
                {t.cover_url ? <img src={t.cover_url} alt={t.title} className="w-full h-full object-cover" />
                  : <div className="w-full h-full bg-[#12121A] flex items-center justify-center text-[#FF6B00] text-sm font-bold">{t.title?.[0] || "?"}</div>}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-white truncate">{t.title}</p>
                <p className="text-[10px] text-[#5C5C6B] truncate">{t.artist}</p>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Back-to-now-playing pill when overlay is shown */}
      {nowPlaying && showSearchOverlay && (
        <button
          onClick={() => setShowSearchOverlay(false)}
          data-testid="back-to-now-playing"
          className="fixed top-3 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 px-4 h-9 rounded-full border border-[#39FF14]/40 bg-[#0F0F16]/90 backdrop-blur-md text-[11px] font-bold uppercase tracking-wider text-[#39FF14]"
          style={{ boxShadow: "0 0 18px rgba(57,255,20,0.25)" }}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-[#39FF14] animate-pulse" /> Back to Now Playing
        </button>
      )}
    </div>
      )}
    </>
  );
}

function SideRail({ side, label, tracks, onPick }) {
  if (!tracks || tracks.length === 0) return null;
  const isLeft = side === "left";
  return (
    <div
      className={`hidden md:flex absolute ${isLeft ? "left-4 lg:left-8" : "right-4 lg:right-8"} top-1/2 -translate-y-1/2 z-10 flex-col gap-3`}
      data-testid={`discover-rail-${side}`}
    >
      <p className={`text-[10px] uppercase tracking-[0.3em] font-black ${isLeft ? "text-[#FF6B00]" : "text-[#39FF14]"} ${isLeft ? "text-left" : "text-right"}`}>
        {label}
      </p>
      {tracks.map((t, idx) => (
        <button
          key={t.id || `${side}-${idx}`}
          onClick={() => onPick(t)}
          data-testid={`discover-rail-${side}-${idx}`}
          className="group block animate-float"
          style={{ animationDelay: `${idx * 0.2}s` }}
        >
          <div className={`w-24 h-24 lg:w-28 lg:h-28 rounded-2xl overflow-hidden border ${isLeft ? "border-[#FF6B00]/25 hover:border-[#FF6B00]" : "border-[#39FF14]/25 hover:border-[#39FF14]"} transition-all hover:-translate-y-1`}
            style={{ boxShadow: isLeft ? "0 0 24px rgba(255,107,0,0.12)" : "0 0 24px rgba(57,255,20,0.12)" }}>
            {t.cover_url ? (
              <img src={t.cover_url} alt={t.title} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-[#12121A] flex items-center justify-center">
                <Mic className={`w-7 h-7 ${isLeft ? "text-[#FF6B00]/30" : "text-[#39FF14]/30"}`} />
              </div>
            )}
          </div>
          <p className={`text-[10px] mt-1.5 truncate max-w-[112px] font-bold text-white/80 group-hover:text-white ${isLeft ? "text-left" : "text-right"}`}>{t.title}</p>
          <p className={`text-[9px] truncate max-w-[112px] text-[#5C5C6B] ${isLeft ? "text-left" : "text-right"}`}>{t.artist}</p>
        </button>
      ))}
    </div>
  );
}
