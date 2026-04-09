import { useState, useEffect, useCallback, useRef } from "react";
import { Search, Play, Pause, Music2, Disc3, Clock, TrendingUp, Album } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { API } from "@/App";
import axios from "axios";

export default function StreamPage({ onTrackSelect }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [topSongs, setTopSongs] = useState([]);
  const [topAlbums, setTopAlbums] = useState([]);
  const [searching, setSearching] = useState(false);
  const [activeTab, setActiveTab] = useState("browse");
  const [nowPlaying, setNowPlaying] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef(null);

  useEffect(() => {
    loadBrowseData();
    return () => { if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; } };
  }, []);

  const loadBrowseData = async () => {
    try {
      const [songsRes, albumsRes] = await Promise.all([
        axios.get(`${API}/music/top-songs?limit=20`).catch(() => null),
        axios.get(`${API}/music/top-albums?limit=12`).catch(() => null),
      ]);
      if (songsRes?.data?.success) setTopSongs(songsRes.data.tracks);
      if (albumsRes?.data?.success) setTopAlbums(albumsRes.data.albums);
    } catch (err) {
      // Will show empty state
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
    } catch (err) {
      toast.error("Search failed. Try again.");
    } finally {
      setSearching(false);
    }
  }, [searchQuery]);

  const playTrack = (track) => {
    if (!track.preview_url) {
      toast.info("No preview available for this track");
      return;
    }
    if (audioRef.current) {
      audioRef.current.pause();
    }
    const audio = new Audio(track.preview_url);
    audio.volume = 0.8;
    audio.play().catch(() => toast.error("Playback failed"));
    audioRef.current = audio;
    setNowPlaying(track);
    setIsPlaying(true);
    audio.onended = () => { setIsPlaying(false); };
  };

  const togglePlayPause = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().catch(() => {});
      setIsPlaying(true);
    }
  };

  const handleSelectForStudio = (track) => {
    const song = {
      id: track.id || crypto.randomUUID(),
      title: track.title,
      artist: track.artist,
      album: track.album || "",
      cover_url: track.cover_url || "",
      genre: track.genre || "",
      preview_url: track.preview_url || "",
    };
    onTrackSelect(song);
  };

  const formatMs = (ms) => {
    if (!ms) return "--:--";
    const m = Math.floor(ms / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div className="min-h-screen bg-[#05050A]" data-testid="stream-page">
      {/* Header */}
      <div className="px-4 pt-6 pb-2">
        <h1 className="font-['Outfit'] text-2xl font-extrabold tracking-tight">
          <span className="text-white">SIDE</span>
          <span className="text-[#8A2BE2]">TRACK</span>
        </h1>
        <p className="text-[#606070] text-xs mt-1">studios | Discover, play, and create</p>
      </div>

      {/* Search Bar */}
      <div className="px-4 py-3" data-testid="search-bar">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#606070]" />
            <Input
              data-testid="search-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="Search songs, artists, albums..."
              className="pl-10 h-11 bg-[#12121A] border-white/10 text-white placeholder:text-[#606070] rounded-2xl focus:border-[#8A2BE2]"
            />
          </div>
          <Button
            data-testid="search-btn"
            onClick={handleSearch}
            disabled={searching}
            className="h-11 px-5 bg-[#8A2BE2] hover:bg-[#9D4CDD] text-white rounded-2xl"
          >
            {searching ? "..." : "Search"}
          </Button>
        </div>
      </div>

      {/* Tab Toggle */}
      <div className="px-4 flex gap-2 mb-4">
        {[
          { key: "browse", label: "Browse", icon: TrendingUp },
          { key: "search", label: "Search", icon: Search },
        ].map((tab) => (
          <Button
            key={tab.key}
            data-testid={`tab-${tab.key}`}
            onClick={() => setActiveTab(tab.key)}
            className={`h-8 px-4 rounded-full text-xs gap-1.5 transition-all ${
              activeTab === tab.key
                ? "bg-[#8A2BE2] text-white"
                : "bg-[#12121A] text-[#A0A0B0] border border-white/10"
            }`}
          >
            <tab.icon className="w-3 h-3" />
            {tab.label}
          </Button>
        ))}
      </div>

      {/* Content */}
      <ScrollArea className="h-[calc(100vh-280px)]">
        {activeTab === "browse" ? (
          <div className="px-4 space-y-6 pb-32">
            {/* Top Albums */}
            {topAlbums.length > 0 && (
              <section data-testid="top-albums">
                <h3 className="font-['Outfit'] text-sm uppercase tracking-[0.2em] font-bold text-[#A0A0B0] mb-3 flex items-center gap-2">
                  <Album className="w-4 h-4 text-[#8A2BE2]" />
                  Top Albums
                </h3>
                <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
                  {topAlbums.map((album) => (
                    <div key={album.id} className="flex-shrink-0 w-36 group cursor-pointer">
                      <div className="w-36 h-36 rounded-2xl overflow-hidden mb-2 border border-white/5 group-hover:border-[#8A2BE2]/40 transition-all">
                        <img
                          src={album.cover_url || album.cover_thumb}
                          alt={album.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                          loading="lazy"
                        />
                      </div>
                      <p className="text-xs font-medium text-white truncate">{album.name}</p>
                      <p className="text-[10px] text-[#606070] truncate">{album.artist}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Top Songs */}
            {topSongs.length > 0 && (
              <section data-testid="top-songs">
                <h3 className="font-['Outfit'] text-sm uppercase tracking-[0.2em] font-bold text-[#A0A0B0] mb-3 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-[#00E5FF]" />
                  Top Songs
                </h3>
                <div className="space-y-1">
                  {topSongs.slice(0, 15).map((track, idx) => (
                    <TrackRow
                      key={track.id || idx}
                      track={track}
                      idx={idx}
                      nowPlaying={nowPlaying}
                      isPlaying={isPlaying}
                      onPlay={playTrack}
                      onStudio={handleSelectForStudio}
                      formatMs={formatMs}
                    />
                  ))}
                </div>
              </section>
            )}

            {topSongs.length === 0 && topAlbums.length === 0 && (
              <div className="text-center py-16" data-testid="loading-browse">
                <Disc3 className="w-12 h-12 text-[#8A2BE2]/30 mx-auto mb-4 animate-spin" />
                <p className="text-sm text-[#606070]">Loading music...</p>
              </div>
            )}
          </div>
        ) : (
          /* Search Results */
          <div className="px-4 space-y-1 pb-32" data-testid="search-results">
            {searchResults.length === 0 && !searching && (
              <p className="text-center text-[#606070] text-sm py-8">
                {searchQuery ? "No results found" : "Search for songs, artists, or albums"}
              </p>
            )}
            {searchResults.map((track, idx) => (
              <TrackRow
                key={track.id || idx}
                track={track}
                idx={idx}
                nowPlaying={nowPlaying}
                isPlaying={isPlaying}
                onPlay={playTrack}
                onStudio={handleSelectForStudio}
                formatMs={formatMs}
              />
            ))}
          </div>
        )}
      </ScrollArea>

      {/* Now Playing Mini Bar */}
      {nowPlaying && (
        <div
          className="fixed bottom-16 left-0 right-0 glass-heavy border-t border-white/5 px-4 py-2 z-40"
          data-testid="now-playing-bar"
        >
          <div className="flex items-center gap-3 max-w-lg mx-auto">
            <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0">
              <img
                src={nowPlaying.cover_url || nowPlaying.cover_thumb || ""}
                alt=""
                className="w-full h-full object-cover"
              />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-white truncate">{nowPlaying.title}</p>
              <p className="text-[10px] text-[#606070] truncate">{nowPlaying.artist}</p>
            </div>
            <Button
              data-testid="mini-play-pause"
              variant="ghost"
              size="icon"
              onClick={togglePlayPause}
              className="text-white rounded-full"
            >
              {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" fill="white" />}
            </Button>
            <Button
              data-testid="mini-studio-btn"
              variant="ghost"
              size="icon"
              onClick={() => handleSelectForStudio(nowPlaying)}
              className="text-[#8A2BE2] hover:text-[#00E5FF] rounded-full"
              title="Open in Studio"
            >
              <Music2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function TrackRow({ track, idx, nowPlaying, isPlaying, onPlay, onStudio, formatMs }) {
  const isActive = nowPlaying?.id === track.id;
  return (
    <div
      className={`flex items-center gap-3 p-3 rounded-xl transition-all group ${
        isActive ? "bg-[#8A2BE2]/10 border border-[#8A2BE2]/20" : "hover:bg-white/5"
      }`}
      data-testid={`track-row-${idx}`}
    >
      {/* Number / Play button */}
      <div className="w-8 text-center flex-shrink-0">
        <span className="text-xs text-[#606070] group-hover:hidden">{idx + 1}</span>
        <button
          onClick={() => onPlay(track)}
          className="hidden group-hover:block"
          data-testid={`play-btn-${idx}`}
        >
          <Play className="w-4 h-4 text-[#8A2BE2]" fill="#8A2BE2" />
        </button>
      </div>

      {/* Cover art */}
      <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0">
        {track.cover_url || track.cover_thumb ? (
          <img
            src={track.cover_thumb || track.cover_url}
            alt={track.title}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full bg-[#12121A] flex items-center justify-center">
            <Disc3 className="w-5 h-5 text-[#606070]" />
          </div>
        )}
      </div>

      {/* Track info */}
      <div className="flex-1 min-w-0 cursor-pointer" onClick={() => onPlay(track)}>
        <p className={`text-sm font-medium truncate ${isActive ? "text-[#8A2BE2]" : "text-white"}`}>
          {track.title}
        </p>
        <p className="text-xs text-[#606070] truncate">{track.artist}</p>
      </div>

      {/* Duration */}
      <span className="text-xs text-[#606070] flex-shrink-0 hidden sm:block">
        {formatMs(track.duration_ms)}
      </span>

      {/* Studio button */}
      <Button
        data-testid={`studio-btn-${idx}`}
        onClick={() => onStudio(track)}
        variant="ghost"
        size="icon"
        className="text-[#8A2BE2]/50 hover:text-[#00E5FF] hover:bg-[#8A2BE2]/10 rounded-full flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
        title="Open in Studio"
      >
        <Music2 className="w-4 h-4" />
      </Button>
    </div>
  );
}
