import { useState, useRef, useEffect, useCallback } from "react";
import { Search, ListMusic, Plus, Play, Pause, Loader2, Check, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { API } from "@/App";
import axios from "axios";
import NowPlayingHero from "@/components/NowPlayingHero";

/**
 * Discover — Creator Lane Utility Tab
 *
 * Strictly three things:
 *  1. SEARCH the ~3,800 track Hottest 100 + Top 200 Hip-Hop catalog.
 *  2. LISTEN via the global player (and the NowPlayingHero overlay).
 *  3. PLAYLISTS — quick access + inline "Add to playlist" on each result.
 *
 * No mic recognition, no Battle buttons, no Studio CTAs. Other lanes/tabs
 * handle those flows.
 */
export default function HomePage({
  onTrackSelect, onOpenPlaylists, nowPlaying,
  isPlaying, progress, togglePlayPause, handleSeek, openInStudio,
}) {
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [mosaic, setMosaic] = useState([]);
  const [playlists, setPlaylists] = useState([]);
  // When something is playing, allow user to temporarily override the hero
  // to find another track. Reset to hero on track change.
  const [showSearchOverlay, setShowSearchOverlay] = useState(false);
  // Track id of result whose "add-to-playlist" picker is open
  const [pickerOpen, setPickerOpen] = useState(null);
  // Track ids that just got added (to flash a check)
  const [justAdded, setJustAdded] = useState({});
  const userId = useRef(localStorage.getItem("sidetrack_voter_id") || "anon");

  useEffect(() => { setShowSearchOverlay(false); }, [nowPlaying?.id]);

  // Load initial mosaic (random sample of catalog) + user playlists
  useEffect(() => {
    const load = async () => {
      try {
        const [hh, ar, pls] = await Promise.all([
          axios.get(`${API}/gamer/catalog/tracks`, { params: { collection: "hip_hop_top_200", limit: 12, offset: 0 } }),
          axios.get(`${API}/gamer/catalog/tracks`, { params: { collection: "hottest_100", limit: 12, offset: 0 } }),
          axios.get(`${API}/playlists`, { params: { owner: userId.current } }),
        ]);
        const merged = [...(hh.data?.tracks || []), ...(ar.data?.tracks || [])]
          .filter(t => t.cover_url)
          .sort(() => Math.random() - 0.5)
          .slice(0, 12);
        setMosaic(merged);
        setPlaylists(pls.data?.playlists || []);
      } catch (err) { console.error("[Discover] mosaic load failed:", err); }
    };
    load();
  }, []);

  const refreshPlaylists = useCallback(async () => {
    try {
      const pls = await axios.get(`${API}/playlists`, { params: { owner: userId.current } });
      setPlaylists(pls.data?.playlists || []);
    } catch (err) { /* silent */ }
  }, []);

  const doSearch = useCallback(async () => {
    const q = query.trim();
    if (!q) return;
    setSearching(true);
    setHasSearched(true);
    try {
      const res = await axios.get(`${API}/gamer/catalog/tracks`, {
        params: { q, limit: 30, offset: 0, enrich: true },
      });
      setResults(res.data?.tracks || []);
    } catch (err) {
      toast.error("Search failed");
      setResults([]);
    } finally { setSearching(false); }
  }, [query]);

  const clearSearch = () => {
    setQuery("");
    setResults([]);
    setHasSearched(false);
  };

  const trackToSong = (t) => ({
    id: t.track_id || t.id || crypto.randomUUID(),
    title: t.title,
    artist: t.artist,
    album: t.album || "",
    cover_url: t.cover_url || "",
    genre: t.genre || "",
    preview_url: t.preview_url || "",
  });

  const pickTrack = (t) => {
    const song = trackToSong(t);
    if (!song.preview_url) {
      toast.info("Preview unavailable for this track");
      return;
    }
    onTrackSelect && onTrackSelect(song);
  };

  const addToPlaylist = async (track, playlist) => {
    try {
      await axios.post(`${API}/playlists/${playlist.id}/tracks`, {
        track_id: track.track_id || track.id,
        title: track.title || "",
        artist: track.artist || "",
        album: track.album || "",
        cover_url: track.cover_url || "",
        preview_url: track.preview_url || "",
        duration_ms: track.duration_ms || 0,
      });
      toast.success(`Added to ${playlist.name}`);
      setPickerOpen(null);
      setJustAdded(prev => ({ ...prev, [track.track_id || track.id]: true }));
      setTimeout(() => setJustAdded(prev => {
        const next = { ...prev };
        delete next[track.track_id || track.id];
        return next;
      }), 1800);
      refreshPlaylists();
    } catch (err) {
      console.error("[Discover] add-to-playlist failed:", err);
      toast.error("Couldn't add to playlist");
    }
  };

  const createPlaylistAndAdd = async (track) => {
    const name = window.prompt("New playlist name");
    if (!name?.trim()) return;
    try {
      const res = await axios.post(`${API}/playlists`, {
        name: name.trim(), is_public: false, owner: userId.current,
      });
      const newPl = res.data?.playlist;
      if (newPl?.id) {
        await addToPlaylist(track, newPl);
      }
    } catch (err) {
      toast.error("Couldn't create playlist");
    }
  };

  return (
    <>
      {/* IMMERSIVE NOW-PLAYING — shown while a track is streaming on Discover */}
      {nowPlaying && !showSearchOverlay && (
        <NowPlayingHero
          nowPlaying={nowPlaying}
          isPlaying={isPlaying}
          progress={progress}
          togglePlayPause={togglePlayPause}
          handleSeek={handleSeek}
          openInStudio={openInStudio}
          onTapSearch={() => setShowSearchOverlay(true)}
        />
      )}
      {(!nowPlaying || showSearchOverlay) && (
        <div className="min-h-screen relative overflow-hidden px-4 pt-8 pb-16" data-testid="home-page">
          {/* Ambient background */}
          <div className="absolute inset-0 z-0 pointer-events-none">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[500px] rounded-full bg-[#FF6B00]/6 blur-[140px]" />
            <div className="absolute bottom-0 right-0 w-[420px] h-[420px] rounded-full bg-[#39FF14]/5 blur-[120px]" />
          </div>

          <div className="relative z-10 max-w-2xl mx-auto">
            {/* Header */}
            <div className="flex items-center gap-3 mb-5" data-testid="discover-header">
              <div className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0"
                style={{ background: "rgba(255,107,0,0.12)", boxShadow: "0 0 22px rgba(255,107,0,0.25)" }}>
                <Search className="w-5 h-5 text-[#FF6B00]" />
              </div>
              <div>
                <h1 className="font-['Outfit'] text-2xl sm:text-3xl font-black text-white tracking-tight">
                  <span className="text-[#FF6B00] glow-text-orange">Discover</span>
                </h1>
                <p className="text-[10px] uppercase tracking-[0.25em] text-[#5C5C6B] font-bold">
                  Search · Listen · Save
                </p>
              </div>
            </div>

            {/* SEARCH BAR */}
            <div className="mb-4" data-testid="discover-search">
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#5C5C6B]" />
                  <Input
                    data-testid="discover-search-input"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && doSearch()}
                    placeholder="Search the catalog…  songs, artists"
                    className="pl-10 pr-9 h-12 bg-[#0F0F16]/80 border-white/10 focus-visible:ring-[#FF6B00]/50 text-sm rounded-2xl"
                  />
                  {query && (
                    <button
                      onClick={clearSearch}
                      data-testid="discover-search-clear"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#5C5C6B] hover:text-white text-xs font-bold"
                      aria-label="Clear search"
                    >
                      ✕
                    </button>
                  )}
                </div>
                <Button
                  onClick={doSearch}
                  disabled={searching || !query.trim()}
                  data-testid="discover-search-btn"
                  className="h-12 px-5 rounded-2xl bg-[#FF6B00] hover:bg-[#FF8533] text-white font-black text-sm disabled:opacity-40"
                  style={{ boxShadow: "0 0 18px rgba(255,107,0,0.35)" }}
                >
                  {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : "Search"}
                </Button>
              </div>
              <p className="mt-1.5 text-[10px] text-[#5C5C6B]">
                Searching the Hottest 100 + Top 200 Hip-Hop library · 3,800+ tracks
              </p>
            </div>

            {/* YOUR PLAYLISTS — utility row */}
            <div className="mb-5" data-testid="discover-playlists">
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
                  className="w-full flex items-center gap-3 p-3 rounded-2xl border border-dashed border-[#39FF14]/25 hover:border-[#39FF14]/60 hover:bg-[#39FF14]/5 transition-all text-left"
                >
                  <div className="w-10 h-10 rounded-xl bg-[#39FF14]/10 flex items-center justify-center">
                    <Plus className="w-4 h-4 text-[#39FF14]" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-white">Create your first playlist</p>
                    <p className="text-[10px] text-[#5C5C6B]">Save tracks you love for later</p>
                  </div>
                </button>
              ) : (
                <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1" data-testid="discover-playlists-row">
                  {playlists.slice(0, 10).map((pl, idx) => (
                    <button
                      key={pl.id || idx}
                      onClick={() => onOpenPlaylists && onOpenPlaylists(pl)}
                      data-testid={`discover-playlist-${idx}`}
                      className="flex-shrink-0 w-28 rounded-2xl border border-white/5 hover:border-[#39FF14]/40 hover:bg-[#39FF14]/5 transition-all text-left p-2 group"
                    >
                      <div className="w-full aspect-square rounded-xl overflow-hidden mb-1.5 border border-white/5 bg-gradient-to-br from-[#39FF14]/15 via-[#0F0F16] to-[#FF6B00]/10 flex items-center justify-center">
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
                    className="flex-shrink-0 w-28 rounded-2xl border border-dashed border-white/10 hover:border-[#39FF14]/40 hover:bg-[#39FF14]/5 transition-all flex flex-col items-center justify-center p-2 gap-1.5"
                  >
                    <div className="w-9 h-9 rounded-xl bg-[#39FF14]/10 flex items-center justify-center">
                      <Plus className="w-4 h-4 text-[#39FF14]" />
                    </div>
                    <p className="text-[10px] text-[#5C5C6B] font-bold uppercase tracking-wider">New</p>
                  </button>
                </div>
              )}
            </div>

            {/* SEARCH RESULTS or MOSAIC */}
            {hasSearched ? (
              <div className="space-y-1.5" data-testid="discover-search-results">
                <p className="text-[10px] uppercase tracking-[0.25em] text-[#5C5C6B] font-bold mb-2 flex items-center justify-between">
                  <span>{results.length > 0 ? `${results.length} Result${results.length === 1 ? "" : "s"}` : "No matches"}</span>
                  {results.length > 0 && (
                    <button onClick={clearSearch} className="text-[#5C5C6B] hover:text-white text-[10px] font-bold normal-case tracking-normal">
                      Clear
                    </button>
                  )}
                </p>
                {results.length === 0 && !searching && (
                  <div className="py-10 rounded-2xl border border-dashed border-white/10 text-center">
                    <p className="text-sm font-bold text-white">No tracks matched &ldquo;{query}&rdquo;</p>
                    <p className="text-[11px] text-[#5C5C6B] mt-1">Try a different artist or song name.</p>
                  </div>
                )}
                {results.map((t, idx) => (
                  <ResultRow
                    key={t.track_id || t.id || idx}
                    track={t}
                    idx={idx}
                    nowPlayingId={nowPlaying?.id}
                    isPlaying={isPlaying}
                    pickerOpen={pickerOpen === (t.track_id || t.id)}
                    setPickerOpen={(open) => setPickerOpen(open ? (t.track_id || t.id) : null)}
                    onPick={() => pickTrack(t)}
                    onAdd={(pl) => addToPlaylist(t, pl)}
                    onCreatePlaylist={() => createPlaylistAndAdd(t)}
                    playlists={playlists}
                    justAdded={!!justAdded[t.track_id || t.id]}
                  />
                ))}
              </div>
            ) : (
              <CoverMosaic tracks={mosaic} onPick={pickTrack} />
            )}
          </div>

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

/* ──────────────────────────────────────────────────────────────────────── */

function ResultRow({
  track, idx, nowPlayingId, isPlaying, pickerOpen, setPickerOpen,
  onPick, onAdd, onCreatePlaylist, playlists, justAdded,
}) {
  const isCurrent = nowPlayingId === (track.track_id || track.id);
  return (
    <div
      data-testid={`discover-result-${idx}`}
      className={`flex items-center gap-3 p-2.5 rounded-2xl border transition-all ${
        isCurrent
          ? "border-[#FF6B00]/50 bg-[#FF6B00]/8"
          : "border-white/5 hover:border-[#FF6B00]/30 hover:bg-[#FF6B00]/5"
      }`}
    >
      <button
        onClick={onPick}
        data-testid={`discover-result-play-${idx}`}
        className={`relative w-11 h-11 rounded-xl overflow-hidden border flex-shrink-0 group ${
          isCurrent ? "border-[#FF6B00]/60" : "border-white/5"
        }`}
        aria-label={`Play ${track.title}`}
      >
        {track.cover_url ? (
          <img src={track.cover_url} alt={track.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-[#12121A] flex items-center justify-center text-[#FF6B00] text-sm font-bold">
            {track.title?.[0] || "?"}
          </div>
        )}
        <div className={`absolute inset-0 flex items-center justify-center transition-opacity ${
          isCurrent ? "bg-[#05050A]/55 opacity-100" : "bg-[#05050A]/55 opacity-0 group-hover:opacity-100"
        }`}>
          {isCurrent && isPlaying
            ? <Pause className="w-4 h-4 text-white" />
            : <Play className="w-4 h-4 text-white ml-0.5" />}
        </div>
      </button>

      <button
        onClick={onPick}
        className="min-w-0 flex-1 text-left"
        data-testid={`discover-result-info-${idx}`}
      >
        <p className={`text-sm font-bold truncate ${isCurrent ? "text-[#FF6B00]" : "text-white"}`}>
          {track.title}
        </p>
        <p className="text-[11px] text-[#5C5C6B] truncate">
          {track.artist}{track.year ? ` · ${track.year}` : ""}
        </p>
      </button>

      {/* Add-to-playlist */}
      <div className="relative flex-shrink-0">
        {justAdded ? (
          <div className="w-9 h-9 rounded-xl bg-[#39FF14]/15 flex items-center justify-center"
               data-testid={`discover-result-added-${idx}`}>
            <Check className="w-4 h-4 text-[#39FF14]" />
          </div>
        ) : (
          <button
            onClick={(e) => { e.stopPropagation(); setPickerOpen(!pickerOpen); }}
            data-testid={`discover-result-add-${idx}`}
            className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${
              pickerOpen
                ? "bg-[#39FF14]/20 text-[#39FF14]"
                : "bg-white/5 hover:bg-[#39FF14]/15 text-[#5C5C6B] hover:text-[#39FF14]"
            }`}
            aria-label="Add to playlist"
          >
            <Plus className="w-4 h-4" />
          </button>
        )}
        {pickerOpen && (
          <div
            className="absolute right-0 top-11 z-30 w-56 rounded-2xl border border-white/10 bg-[#0A0A12] shadow-2xl p-1.5 space-y-0.5 max-h-72 overflow-y-auto"
            style={{ boxShadow: "0 12px 40px rgba(0,0,0,0.6), 0 0 0 1px rgba(57,255,20,0.08)" }}
            data-testid={`discover-playlist-picker-${idx}`}
          >
            <p className="px-2 pt-1.5 pb-1 text-[9px] uppercase tracking-[0.25em] text-[#5C5C6B] font-black">
              Add to playlist
            </p>
            {playlists.length === 0 && (
              <p className="px-2 py-3 text-[11px] text-[#5C5C6B]">No playlists yet.</p>
            )}
            {playlists.map((pl) => (
              <button
                key={pl.id}
                onClick={(e) => { e.stopPropagation(); onAdd(pl); }}
                data-testid={`discover-playlist-pick-${idx}-${pl.id}`}
                className="w-full flex items-center gap-2 px-2 py-2 rounded-xl hover:bg-[#39FF14]/8 text-left transition-colors"
              >
                <div className="w-7 h-7 rounded-lg bg-[#39FF14]/10 flex items-center justify-center flex-shrink-0">
                  {pl.cover_url
                    ? <img src={pl.cover_url} alt="" className="w-full h-full object-cover rounded-lg" />
                    : <ListMusic className="w-3.5 h-3.5 text-[#39FF14]" />}
                </div>
                <span className="text-xs font-bold text-white truncate flex-1">{pl.name}</span>
              </button>
            ))}
            <button
              onClick={(e) => { e.stopPropagation(); onCreatePlaylist(); }}
              data-testid={`discover-playlist-create-${idx}`}
              className="w-full flex items-center gap-2 px-2 py-2 rounded-xl border border-dashed border-[#39FF14]/30 hover:bg-[#39FF14]/8 text-left transition-colors mt-1"
            >
              <div className="w-7 h-7 rounded-lg bg-[#39FF14]/10 flex items-center justify-center flex-shrink-0">
                <Plus className="w-3.5 h-3.5 text-[#39FF14]" />
              </div>
              <span className="text-xs font-black text-[#39FF14] uppercase tracking-wider">New playlist</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────── */

function CoverMosaic({ tracks, onPick }) {
  if (!tracks || tracks.length === 0) return null;
  return (
    <div data-testid="discover-mosaic">
      <p className="text-[10px] uppercase tracking-[0.25em] text-[#5C5C6B] font-bold mb-2 flex items-center gap-1.5">
        <ChevronDown className="w-3 h-3" /> From the catalog
      </p>
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
        {tracks.map((t, idx) => (
          <button
            key={t.track_id || t.id || idx}
            onClick={() => onPick(t)}
            data-testid={`discover-mosaic-${idx}`}
            className="group relative aspect-square rounded-2xl overflow-hidden border border-white/5 hover:border-[#FF6B00]/50 transition-all"
            style={{ boxShadow: "0 6px 22px rgba(0,0,0,0.45)" }}
          >
            {t.cover_url ? (
              <img src={t.cover_url} alt={t.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
            ) : (
              <div className="w-full h-full bg-[#12121A]" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-[#05050A] via-[#05050A]/40 to-transparent opacity-90" />
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <div className="w-10 h-10 rounded-full bg-[#FF6B00] flex items-center justify-center"
                   style={{ boxShadow: "0 0 22px rgba(255,107,0,0.55)" }}>
                <Play className="w-4 h-4 text-white ml-0.5" />
              </div>
            </div>
            <div className="absolute bottom-0 left-0 right-0 p-2 text-left">
              <p className="text-[11px] font-black text-white truncate">{t.title}</p>
              <p className="text-[9px] text-white/60 truncate">{t.artist}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
