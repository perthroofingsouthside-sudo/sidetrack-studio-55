import { useState, useEffect, useCallback, useRef } from "react";
import { Search, Play, Pause, Music2, Disc3, ChevronRight, Clock, Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { API } from "@/App";
import axios from "axios";

const DEMO_ALBUMS = [
  { id: "d1", name: "Midnight Frequencies", artists: [{ name: "The Neon Waves" }], images: [{ url: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=300" }] },
  { id: "d2", name: "Electric Dreams", artists: [{ name: "Synth Horizon" }], images: [{ url: "https://images.unsplash.com/photo-1514320291840-2e0a9bf2a9ae?w=300" }] },
  { id: "d3", name: "Bass Culture", artists: [{ name: "Deep Current" }], images: [{ url: "https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=300" }] },
  { id: "d4", name: "Violet Hour", artists: [{ name: "Aurora Skies" }], images: [{ url: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=300" }] },
  { id: "d5", name: "Rhythm & Code", artists: [{ name: "Digital Pulse" }], images: [{ url: "https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=300" }] },
  { id: "d6", name: "Soundscape", artists: [{ name: "Aether" }], images: [{ url: "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=300" }] },
];

const DEMO_PLAYLISTS = [
  { id: "p1", name: "Chill Vibes", description: "Relax and unwind", images: [{ url: "https://images.unsplash.com/photo-1507838153414-b4b713384a76?w=300" }] },
  { id: "p2", name: "Workout Energy", description: "Push your limits", images: [{ url: "https://images.unsplash.com/photo-1571902943202-507ec2618e8f?w=300" }] },
  { id: "p3", name: "Late Night Jazz", description: "Smooth and mellow", images: [{ url: "https://images.unsplash.com/photo-1415201364774-f6f0bb35f28f?w=300" }] },
  { id: "p4", name: "Indie Discoveries", description: "Fresh new sounds", images: [{ url: "https://images.unsplash.com/photo-1446057032654-9d8885db76c6?w=300" }] },
  { id: "p5", name: "Electronic Beats", description: "Dance the night away", images: [{ url: "https://images.unsplash.com/photo-1571330735066-03aaa9429d89?w=300" }] },
  { id: "p6", name: "Acoustic Sessions", description: "Raw and authentic", images: [{ url: "https://images.unsplash.com/photo-1510915361894-db8b60106cb1?w=300" }] },
];

export default function StreamPage({ spotifyToken, onTrackSelect, onNavigateStudio }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [newReleases, setNewReleases] = useState([]);
  const [featuredPlaylists, setFeaturedPlaylists] = useState([]);
  const [searching, setSearching] = useState(false);
  const [activeTab, setActiveTab] = useState("browse"); // browse | search
  const [nowPlaying, setNowPlaying] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [deviceId, setDeviceId] = useState(null);
  const playerRef = useRef(null);

  useEffect(() => {
    loadBrowseData();
    if (spotifyToken) initSpotifyPlayer();
    return () => { if (playerRef.current) playerRef.current.disconnect(); };
  }, [spotifyToken]);

  const loadBrowseData = async () => {
    try {
      const tokenParam = spotifyToken ? `&token=${spotifyToken}` : "";
      const [releasesRes, playlistsRes] = await Promise.all([
        axios.get(`${API}/spotify/new-releases?limit=10${tokenParam}`).catch(() => null),
        axios.get(`${API}/spotify/featured-playlists?limit=10${tokenParam}`).catch(() => null),
      ]);
      if (releasesRes?.data?.albums?.items) setNewReleases(releasesRes.data.albums.items);
      if (playlistsRes?.data?.playlists?.items) setFeaturedPlaylists(playlistsRes.data.playlists.items);
    } catch (err) {
      // Use curated demo data when Spotify not configured
    }
    // If no data loaded, show curated demo content
    if (newReleases.length === 0) {
      setNewReleases(DEMO_ALBUMS);
    }
    if (featuredPlaylists.length === 0) {
      setFeaturedPlaylists(DEMO_PLAYLISTS);
    }
  };

  const initSpotifyPlayer = () => {
    if (!spotifyToken) return;
    // Wait for SDK to be ready
    const initPlayer = () => {
      if (!window.Spotify) return;
      try {
        const player = new window.Spotify.Player({
          name: "SIDETRACK Studios Player",
          getOAuthToken: (cb) => cb(spotifyToken),
          volume: 0.5,
        });
        player.addListener("ready", ({ device_id }) => {
          setDeviceId(device_id);
        });
        player.addListener("player_state_changed", (state) => {
          if (!state) return;
          setIsPlaying(!state.paused);
          if (state.track_window?.current_track) {
            setNowPlaying(state.track_window.current_track);
          }
        });
        player.addListener("initialization_error", ({ message }) => {
          console.log("Spotify init error:", message);
        });
        player.connect();
        playerRef.current = player;
      } catch (err) {
        console.log("Spotify player init failed:", err);
      }
    };
    window.onSpotifyWebPlaybackSDKReady = initPlayer;
    if (window.Spotify) initPlayer();
  };

  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    setActiveTab("search");
    try {
      const tokenParam = spotifyToken ? `&token=${spotifyToken}` : "";
      const res = await axios.get(`${API}/spotify/search?q=${encodeURIComponent(searchQuery)}&type=track${tokenParam}`);
      setSearchResults(res.data?.tracks?.items || []);
    } catch (err) {
      toast.error("Search failed. Check Spotify credentials.");
    } finally {
      setSearching(false);
    }
  }, [searchQuery, spotifyToken]);

  const playTrack = async (track) => {
    if (spotifyToken && deviceId) {
      try {
        const formData = new FormData();
        formData.append("token", spotifyToken);
        formData.append("track_uri", track.uri);
        formData.append("device_id", deviceId);
        await axios.post(`${API}/spotify/play`, formData);
        setNowPlaying(track);
        setIsPlaying(true);
      } catch (err) {
        toast.error("Playback failed. Make sure Spotify Premium is active.");
      }
    } else {
      // Preview mode - use 30s preview URL
      if (track.preview_url) {
        const audio = new Audio(track.preview_url);
        audio.play();
        setNowPlaying(track);
        setIsPlaying(true);
        audio.onended = () => setIsPlaying(false);
      } else {
        toast.info("No preview available. Connect Spotify Premium for full playback.");
      }
    }
  };

  const pauseTrack = async () => {
    if (spotifyToken && deviceId) {
      try {
        const formData = new FormData();
        formData.append("token", spotifyToken);
        formData.append("device_id", deviceId);
        await axios.post(`${API}/spotify/pause`, formData);
        setIsPlaying(false);
      } catch (err) { /* ignore */ }
    }
  };

  const handleSelectForStudio = (track) => {
    const song = {
      id: track.id,
      title: track.name,
      artist: track.artists?.map((a) => a.name).join(", ") || "Unknown",
      album: track.album?.name || "",
      cover_url: track.album?.images?.[0]?.url || "",
      genre: "",
      spotify_uri: track.uri,
      preview_url: track.preview_url,
    };
    onTrackSelect(song);
  };

  const formatMs = (ms) => {
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
        {["browse", "search"].map((tab) => (
          <Button
            key={tab}
            data-testid={`tab-${tab}`}
            onClick={() => setActiveTab(tab)}
            className={`h-8 px-4 rounded-full text-xs capitalize transition-all ${
              activeTab === tab
                ? "bg-[#8A2BE2] text-white"
                : "bg-[#12121A] text-[#A0A0B0] border border-white/10"
            }`}
          >
            {tab}
          </Button>
        ))}
      </div>

      {/* Content */}
      <ScrollArea className="h-[calc(100vh-280px)]">
        {activeTab === "browse" ? (
          <div className="px-4 space-y-6 pb-32">
            {/* New Releases */}
            {newReleases.length > 0 && (
              <section data-testid="new-releases">
                <h3 className="font-['Outfit'] text-sm uppercase tracking-[0.2em] font-bold text-[#A0A0B0] mb-3">
                  New Releases
                </h3>
                <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
                  {newReleases.map((album) => (
                    <div
                      key={album.id}
                      className="flex-shrink-0 w-36 group cursor-pointer"
                      onClick={() => {
                        if (album.tracks?.items?.[0]) playTrack(album.tracks.items[0]);
                      }}
                    >
                      <div className="w-36 h-36 rounded-2xl overflow-hidden mb-2 border border-white/5 group-hover:border-[#8A2BE2]/40 transition-all">
                        <img
                          src={album.images?.[0]?.url || ""}
                          alt={album.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        />
                      </div>
                      <p className="text-xs font-medium text-white truncate">{album.name}</p>
                      <p className="text-[10px] text-[#606070] truncate">
                        {album.artists?.map((a) => a.name).join(", ")}
                      </p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Featured Playlists */}
            {featuredPlaylists.length > 0 && (
              <section data-testid="featured-playlists">
                <h3 className="font-['Outfit'] text-sm uppercase tracking-[0.2em] font-bold text-[#A0A0B0] mb-3">
                  Featured Playlists
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  {featuredPlaylists.slice(0, 6).map((pl) => (
                    <div
                      key={pl.id}
                      className="surface-card p-3 flex gap-3 items-center cursor-pointer hover:border-[#8A2BE2]/30 transition-all group"
                    >
                      <div className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0">
                        <img
                          src={pl.images?.[0]?.url || ""}
                          alt={pl.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-white truncate">{pl.name}</p>
                        <p className="text-[10px] text-[#606070] truncate">{pl.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Spotify connection hint */}
            {!spotifyToken && (
              <div className="surface-card p-4 text-center" data-testid="spotify-connect-hint">
                <p className="text-xs text-[#606070]">
                  Connect Spotify Premium for full streaming.
                  <span className="text-[#8A2BE2] ml-1">Showing curated picks.</span>
                </p>
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
              <div
                key={track.id}
                className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 transition-all group"
                data-testid={`search-result-${idx}`}
              >
                {/* Album art */}
                <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 relative">
                  <img
                    src={track.album?.images?.[2]?.url || track.album?.images?.[0]?.url || ""}
                    alt={track.name}
                    className="w-full h-full object-cover"
                  />
                  <button
                    onClick={() => playTrack(track)}
                    className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                  >
                    <Play className="w-5 h-5 text-white" fill="white" />
                  </button>
                </div>

                {/* Track info */}
                <div className="flex-1 min-w-0" onClick={() => playTrack(track)}>
                  <p className="text-sm font-medium text-white truncate">{track.name}</p>
                  <p className="text-xs text-[#606070] truncate">
                    {track.artists?.map((a) => a.name).join(", ")}
                  </p>
                </div>

                {/* Duration */}
                <span className="text-xs text-[#606070] flex-shrink-0">
                  {formatMs(track.duration_ms)}
                </span>

                {/* Studio button */}
                <Button
                  data-testid={`studio-btn-${idx}`}
                  onClick={() => handleSelectForStudio(track)}
                  variant="ghost"
                  size="icon"
                  className="text-[#8A2BE2] hover:text-[#00E5FF] hover:bg-[#8A2BE2]/10 rounded-full flex-shrink-0"
                  title="Open in Studio"
                >
                  <Music2 className="w-4 h-4" />
                </Button>
              </div>
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
                src={nowPlaying.album?.images?.[2]?.url || nowPlaying.cover_url || ""}
                alt=""
                className="w-full h-full object-cover"
              />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-white truncate">{nowPlaying.name || nowPlaying.title}</p>
              <p className="text-[10px] text-[#606070] truncate">
                {nowPlaying.artists?.map((a) => a.name).join(", ") || nowPlaying.artist}
              </p>
            </div>
            <Button
              data-testid="mini-play-pause"
              variant="ghost"
              size="icon"
              onClick={() => isPlaying ? pauseTrack() : playTrack(nowPlaying)}
              className="text-white"
            >
              {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" fill="white" />}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
