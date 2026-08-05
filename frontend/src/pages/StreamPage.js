import { useState, useEffect, useCallback, useRef } from "react";
import { Search, Play, Pause, Music2, Disc3, Clock, TrendingUp, Album, Plus, ListMusic, SkipForward, Sparkles, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { API } from "@/App";
import axios from "axios";
import LiveChat from "@/components/LiveChat";

export default function StreamPage({ onTrackSelect, nowPlaying, isPlaying, playTrack, togglePlayPause, progress, openInStudio }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [topSongs, setTopSongs] = useState([]);
  const [topAlbums, setTopAlbums] = useState([]);
  const [forYou, setForYou] = useState([]);
  const [searching, setSearching] = useState(false);
  const [activeTab, setActiveTab] = useState("browse");
  const [showChat, setShowChat] = useState(false);
  const [playlists, setPlaylists] = useState([]);
  const [addingTrack, setAddingTrack] = useState(null);
  const [skipsRemaining, setSkipsRemaining] = useState(50);
  const [skipLimit] = useState(50);
  const owner = localStorage.getItem("sidetrack_username") || "anonymous";
  const userId = useRef(localStorage.getItem("sidetrack_voter_id") || (() => { const id = crypto.randomUUID(); localStorage.setItem("sidetrack_voter_id", id); return id; })());

  useEffect(() => {
    loadBrowseData();
    loadSkipCount();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadBrowseData = async () => {
    try {
      const [songsRes, albumsRes, forYouRes] = await Promise.all([
        axios.get(`${API}/music/top-songs?limit=20`).catch(() => null),
        axios.get(`${API}/music/top-albums?limit=12`).catch(() => null),
        axios.get(`${API}/discover/for-you?user_id=${owner}&limit=10`).catch(() => null),
      ]);
      if (songsRes?.data?.success) setTopSongs(songsRes.data.tracks);
      if (albumsRes?.data?.success) setTopAlbums(albumsRes.data.albums);
      if (forYouRes?.data?.success && forYouRes.data.tracks?.length) setForYou(forYouRes.data.tracks);
    } catch (err) { console.error("Load browse data failed:", err); }
  };

  const loadSkipCount = async () => {
    try {
      const res = await axios.get(`${API}/skips/${userId.current}`);
      if (res.data.success) setSkipsRemaining(res.data.skips_remaining);
    } catch (err) { console.error("Load skip count failed:", err); }
  };

  const skipTrack = async () => {
    if (skipsRemaining <= 0) { toast.error("Daily skip limit reached! Resets at midnight UTC."); return; }
    try {
      const res = await axios.post(`${API}/skips/${userId.current}/use`);
      if (res.data.success) {
        setSkipsRemaining(res.data.skips_remaining);
        // Skip to next track in current list
        const list = activeTab === "search" ? searchResults : topSongs;
        if (nowPlaying && list.length > 0) {
          const idx = list.findIndex((t) => t.id === nowPlaying.id);
          const next = list[(idx + 1) % list.length];
          if (next) playTrack(next);
        }
      }
    } catch (err) {
      if (err.response?.status === 429) {
        setSkipsRemaining(0);
        toast.error("Daily skip limit reached! Resets at midnight UTC.");
      }
    }
  };

  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    setActiveTab("search");
    try {
      const res = await axios.get(`${API}/music/search?q=${encodeURIComponent(searchQuery)}&limit=25`);
      if (res.data?.success) {
        setSearchResults(res.data.tracks);
        if (res.data.tracks.length === 0) toast.info("No results found");
      }
    } catch { toast.error("Search failed. Try again."); }
    finally { setSearching(false); }
  }, [searchQuery]);

  const handleSelectForStudio = (track) => {
    if (openInStudio) openInStudio(track);
    else onTrackSelect({
      id: track.id || crypto.randomUUID(), title: track.title, artist: track.artist,
      album: track.album || "", cover_url: track.cover_url || "", genre: track.genre || "",
      preview_url: track.preview_url || "",
    });
  };

  const formatMs = (ms) => {
    if (!ms) return "--:--";
    const m = Math.floor(ms / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const loadPlaylists = async () => {
    try {
      const res = await axios.get(`${API}/playlists?owner=${owner}`);
      if (res.data?.success) setPlaylists(res.data.playlists);
    } catch (err) { console.error("Failed to load playlists:", err); }
  };

  const addToPlaylist = async (playlistId, track) => {
    try {
      await axios.post(`${API}/playlists/${playlistId}/tracks`, {
        track_id: track.id || "", title: track.title || "", artist: track.artist || "",
        album: track.album || "", cover_url: track.cover_url || "",
        preview_url: track.preview_url || "", duration_ms: track.duration_ms || 0,
      });
      toast.success("Added to playlist!");
      setAddingTrack(null);
    } catch { toast.error("Failed to add track"); }
  };

  const showAddToPlaylist = (track) => { loadPlaylists(); setAddingTrack(track); };

  const HERO_BG = "https://images.unsplash.com/photo-1648237409808-aa4649c07ec8?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjAzMjh8MHwxfHNlYXJjaHwzfHxzaW5nZXIlMjBtaWNyb3Bob25lJTIwbmVvbnxlbnwwfHx8fDE3Nzc2OTUxNzB8MA&ixlib=rb-4.1.0&q=85&w=800";

  return (
    <div className="min-h-screen bg-[#05050A]" data-testid="stream-page">
      <div className="flex flex-col lg:flex-row">
        {/* Main content area */}
        <div className={`flex-1 min-w-0 ${showChat ? "lg:mr-[320px]" : ""}`}>
          {/* Header */}
          <div className="px-4 sm:px-6 pt-5 pb-2 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#FF5F1F] to-[#39FF14] flex items-center justify-center shadow-[0_0_20px_rgba(255,95,31,0.3)]">
                <Music2 className="w-5 h-5 text-black" />
              </div>
              <div>
                <h1 className="font-['Outfit'] text-2xl sm:text-3xl font-black tracking-[-0.03em] leading-none">
                  <span className="text-white">Pocket</span><span className="text-[#FF5F1F]"> Products</span>
                </h1>
              </div>
            </div>
            <Button data-testid="toggle-chat-btn" onClick={() => setShowChat(!showChat)} variant="ghost"
              className={`hidden lg:flex h-9 px-3 rounded-full text-xs gap-1.5 border ${showChat ? "border-[#39FF14]/40 text-[#39FF14]" : "border-white/10 text-[#5C5C6B]"}`}>
              <MessageCircle className="w-3.5 h-3.5" /> Chat
            </Button>
          </div>

          {/* Search */}
          <div className="px-4 sm:px-6 py-3" data-testid="search-bar">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#5C5C6B]" />
                <Input data-testid="search-input" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  placeholder="Search songs, artists, albums..."
                  className="pl-10 h-12 bg-[#0F0F16] border-white/5 text-white placeholder:text-[#5C5C6B] rounded-2xl focus:border-[#FF5F1F] text-sm" />
              </div>
              <Button data-testid="search-btn" onClick={handleSearch} disabled={searching}
                className="h-12 px-6 bg-[#FF5F1F] hover:bg-[#FF7A42] hover:shadow-[0_0_20px_rgba(255,95,31,0.6)] text-white rounded-2xl font-bold transition-all">
                {searching ? "..." : "Search"}
              </Button>
            </div>
          </div>

          {/* Tab Toggle */}
          <div className="px-4 sm:px-6 flex gap-2 mb-4">
            {[{ key: "browse", label: "Browse", icon: TrendingUp }, { key: "search", label: "Results", icon: Search }].map((tab) => (
              <Button key={tab.key} data-testid={`tab-${tab.key}`} onClick={() => setActiveTab(tab.key)}
                className={`h-9 px-4 rounded-full text-xs gap-1.5 transition-all ${
                  activeTab === tab.key ? "bg-[#FF5F1F] text-white shadow-[0_0_16px_rgba(255,95,31,0.4)]" : "bg-[#0F0F16] text-[#8F8F9D] border border-white/5 hover:border-white/15"
                }`}>
                <tab.icon className="w-3 h-3" />{tab.label}
              </Button>
            ))}
          </div>

          {/* Content */}
          <ScrollArea className="h-[calc(100vh-280px)]">
            {activeTab === "browse" ? (
              <div className="px-4 sm:px-6 space-y-8 pb-36">
                {/* Hero Section */}
                <div className="relative rounded-2xl overflow-hidden h-44 sm:h-52" data-testid="hero-section">
                  <img src={HERO_BG} alt="" className="absolute inset-0 w-full h-full object-cover opacity-40" />
                  <div className="absolute inset-0 bg-gradient-to-r from-[#05050A] via-[#05050A]/80 to-transparent" />
                  <div className="relative z-10 h-full flex flex-col justify-end p-5 sm:p-6">
                    <p className="uppercase tracking-[0.2em] text-xs font-bold text-[#39FF14] mb-1">Now Streaming</p>
                    <h2 className="font-['Outfit'] text-2xl sm:text-3xl font-black text-white tracking-tight">
                      Discover. Play. Create.
                    </h2>
                    <p className="text-sm text-[#8F8F9D] mt-1">Millions of tracks at your fingertips</p>
                  </div>
                </div>

                {/* For You — Vibe-Match Recommendations */}
                {forYou.length > 0 && (
                  <section data-testid="for-you-section">
                    <h3 className="font-['Outfit'] text-sm uppercase tracking-[0.2em] font-bold text-[#8F8F9D] mb-4 flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-[#FF5F1F]" /> For You
                    </h3>
                    <div className="flex gap-4 overflow-x-auto pb-2 -mx-4 px-4 sm:-mx-6 sm:px-6 scrollbar-hide">
                      {forYou.map((track) => (
                        <div key={track.id} className="flex-shrink-0 w-36 group cursor-pointer" onClick={() => handleSelectForStudio(track)}>
                          <div className="w-36 h-36 rounded-2xl overflow-hidden mb-2 border border-[#FF5F1F]/20 group-hover:border-[#FF5F1F]/50 group-hover:shadow-[0_0_20px_rgba(255,95,31,0.25)] transition-all duration-300 relative">
                            <img src={track.cover_url} alt={track.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy" />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-2">
                              <Play className="w-5 h-5 text-white" />
                            </div>
                          </div>
                          <p className="text-xs font-medium text-white truncate">{track.title}</p>
                          <p className="text-[10px] text-[#5C5C6B] truncate">{track.artist}</p>
                          {track.reason && <p className="text-[8px] text-[#FF5F1F]/60 truncate mt-0.5">{track.reason}</p>}
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* Top Albums */}
                {topAlbums.length > 0 && (
                  <section data-testid="top-albums">
                    <h3 className="font-['Outfit'] text-sm uppercase tracking-[0.2em] font-bold text-[#8F8F9D] mb-4 flex items-center gap-2">
                      <Album className="w-4 h-4 text-[#FF5F1F]" /> Top Albums
                    </h3>
                    <div className="flex gap-4 overflow-x-auto pb-2 -mx-4 px-4 sm:-mx-6 sm:px-6 scrollbar-hide">
                      {topAlbums.map((album) => (
                        <div key={album.id} className="flex-shrink-0 w-36 group cursor-pointer">
                          <div className="w-36 h-36 rounded-2xl overflow-hidden mb-2 border border-white/5 group-hover:border-[#FF5F1F]/40 group-hover:shadow-[0_0_20px_rgba(255,95,31,0.2)] transition-all duration-300">
                            <img src={album.cover_url || album.cover_thumb} alt={album.name}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy" />
                          </div>
                          <p className="text-xs font-medium text-white truncate">{album.name}</p>
                          <p className="text-[10px] text-[#5C5C6B] truncate">{album.artist}</p>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* Top Songs */}
                {topSongs.length > 0 && (
                  <section data-testid="top-songs">
                    <h3 className="font-['Outfit'] text-sm uppercase tracking-[0.2em] font-bold text-[#8F8F9D] mb-4 flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-[#39FF14]" /> Top Songs
                    </h3>
                    <div className="space-y-1">
                      {topSongs.slice(0, 15).map((track, idx) => (
                        <TrackRow key={track.id || idx} track={track} idx={idx} nowPlaying={nowPlaying}
                          isPlaying={isPlaying} onPlay={playTrack} onStudio={handleSelectForStudio}
                          onAddToPlaylist={showAddToPlaylist} formatMs={formatMs} />
                      ))}
                    </div>
                  </section>
                )}

                {topSongs.length === 0 && topAlbums.length === 0 && (
                  <div className="text-center py-16" data-testid="loading-browse">
                    <Disc3 className="w-12 h-12 text-[#FF5F1F]/30 mx-auto mb-4 animate-spin" />
                    <p className="text-sm text-[#5C5C6B]">Loading music...</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="px-4 sm:px-6 space-y-1 pb-36" data-testid="search-results">
                {searchResults.length === 0 && !searching && (
                  <p className="text-center text-[#5C5C6B] text-sm py-8">
                    {searchQuery ? "No results found" : "Search for songs, artists, or albums"}
                  </p>
                )}
                {searchResults.map((track, idx) => (
                  <TrackRow key={track.id || idx} track={track} idx={idx} nowPlaying={nowPlaying}
                    isPlaying={isPlaying} onPlay={playTrack} onStudio={handleSelectForStudio}
                    onAddToPlaylist={showAddToPlaylist} formatMs={formatMs} />
                ))}
              </div>
            )}
          </ScrollArea>
        </div>

        {/* Live Chat Sidebar (desktop) */}
        {showChat && (
          <div className="hidden lg:block fixed right-0 top-0 bottom-16 w-[320px] z-30 p-3" data-testid="chat-sidebar">
            <LiveChat trackTitle={nowPlaying?.title} />
          </div>
        )}
      </div>

      {/* Add to Playlist Modal */}
      {addingTrack && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-end sm:items-center justify-center" onClick={() => setAddingTrack(null)} data-testid="playlist-picker-modal">
          <div className="w-full max-w-sm bg-[#0F0F16] border border-white/10 rounded-t-2xl sm:rounded-2xl p-4 max-h-[60vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-['Outfit'] text-base font-bold text-white mb-1">Add to Playlist</h3>
            <p className="text-xs text-[#5C5C6B] mb-3 truncate">{addingTrack.title} — {addingTrack.artist}</p>
            {playlists.length === 0 ? (
              <p className="text-sm text-[#5C5C6B] text-center py-4">No playlists yet. Create one from the Playlists tab.</p>
            ) : (
              <div className="space-y-1">
                {playlists.map((pl) => (
                  <button key={pl.id} data-testid={`add-to-pl-${pl.id}`} onClick={() => addToPlaylist(pl.id, addingTrack)}
                    className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 transition-all text-left">
                    <div className="w-10 h-10 rounded-lg bg-[#FF5F1F]/10 flex items-center justify-center flex-shrink-0">
                      <ListMusic className="w-4 h-4 text-[#FF5F1F]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white truncate">{pl.name}</p>
                      <p className="text-[10px] text-[#5C5C6B]">{pl.track_count || 0} tracks</p>
                    </div>
                    <Plus className="w-4 h-4 text-[#FF5F1F]" />
                  </button>
                ))}
              </div>
            )}
            <Button onClick={() => setAddingTrack(null)} variant="ghost" className="w-full mt-3 text-[#5C5C6B] text-sm">Cancel</Button>
          </div>
        </div>
      )}
    </div>
  );
}

function TrackRow({ track, idx, nowPlaying, isPlaying, onPlay, onStudio, onAddToPlaylist, formatMs }) {
  const isActive = nowPlaying?.id === track.id;
  return (
    <div className={`flex items-center gap-3 p-3 rounded-xl transition-all duration-200 group ${
      isActive ? "bg-[#FF5F1F]/8 border border-[#FF5F1F]/20" : "hover:bg-white/[0.03]"
    }`} data-testid={`track-row-${idx}`}>
      <div className="w-7 text-center flex-shrink-0">
        <span className="text-xs text-[#5C5C6B] group-hover:hidden font-mono">{String(idx + 1).padStart(2, "0")}</span>
        <button onClick={() => onPlay(track)} className="hidden group-hover:block" data-testid={`play-btn-${idx}`}>
          <Play className="w-4 h-4 text-[#39FF14]" fill="#39FF14" />
        </button>
      </div>
      <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 border border-white/5">
        {track.cover_url || track.cover_thumb ? (
          <img src={track.cover_thumb || track.cover_url} alt={track.title} className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <div className="w-full h-full bg-[#0F0F16] flex items-center justify-center"><Disc3 className="w-5 h-5 text-[#5C5C6B]" /></div>
        )}
      </div>
      <div className="flex-1 min-w-0 cursor-pointer" onClick={() => onPlay(track)}>
        <p className={`text-sm font-medium truncate ${isActive ? "text-[#39FF14]" : "text-white"}`}>{track.title}</p>
        <p className="text-xs text-[#5C5C6B] truncate">{track.artist}</p>
      </div>
      <span className="text-xs text-[#5C5C6B] flex-shrink-0 hidden sm:block font-mono">{formatMs(track.duration_ms)}</span>
      <Button data-testid={`add-playlist-btn-${idx}`} onClick={() => onAddToPlaylist(track)} variant="ghost" size="icon"
        className="text-[#5C5C6B]/50 hover:text-[#39FF14] hover:bg-[#39FF14]/10 rounded-full flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" title="Add to playlist">
        <Plus className="w-4 h-4" />
      </Button>
      <Button data-testid={`studio-btn-${idx}`} onClick={() => onStudio(track)} variant="ghost" size="icon"
        className="text-[#FF5F1F]/50 hover:text-[#39FF14] hover:bg-[#FF5F1F]/10 rounded-full flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" title="Open in Studio">
        <Music2 className="w-4 h-4" />
      </Button>
    </div>
  );
}
