/* NowPlayingHero — Immersive "song-is-playing" state for the Discover page.
   Replaces the normal Discover layout when a track is playing, with a
   full-bleed blurred album-art backdrop, animated vinyl, and inline controls. */
import { useRef } from "react";
import { Play, Pause, Music2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatTime } from "@/utils/format";

export default function NowPlayingHero({
  nowPlaying,
  isPlaying,
  progress,
  togglePlayPause,
  handleSeek,
  onTapSearch,
}) {
  const seekRef = useRef(null);

  if (!nowPlaying) return null;

  const onSeekClick = (e) => {
    if (!seekRef.current || !handleSeek) return;
    const rect = seekRef.current.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    handleSeek(pct);
  };

  // Approximate elapsed time from progress % (preview is ~30s per iTunes)
  const totalSec = 30;
  const elapsedSec = (progress / 100) * totalSec;

  return (
    <div className="min-h-screen relative overflow-hidden" data-testid="now-playing-hero">
      {/* Full-bleed blurred album art backdrop */}
      <div className="absolute inset-0 z-0">
        {nowPlaying.cover_url ? (
          <>
            <img
              src={nowPlaying.cover_url}
              alt=""
              className="absolute inset-0 w-full h-full object-cover scale-125 opacity-30"
              style={{ filter: "blur(48px) saturate(1.4)" }}
            />
            <div className="absolute inset-0 bg-gradient-to-b from-[#05050A]/40 via-[#05050A]/70 to-[#05050A]" />
          </>
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-[#FF6B00]/10 via-[#0A0A0F] to-[#39FF14]/10" />
        )}
        {/* Neon ambient glow */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[480px] h-[480px] rounded-full bg-[#FF6B00]/10 blur-[120px]" />
      </div>

      {/* Foreground content */}
      <div className="relative z-10 px-6 pt-10 pb-32 flex flex-col items-center max-w-md mx-auto">
        {/* NOW PLAYING label */}
        <div className="flex items-center gap-2 mb-5" data-testid="hero-now-playing-label">
          <div className="w-2 h-2 rounded-full bg-[#39FF14] animate-pulse" style={{ boxShadow: "0 0 12px #39FF14" }} />
          <p className="text-[10px] uppercase tracking-[0.35em] text-[#39FF14] font-black">Now Playing</p>
        </div>

        {/* Vinyl-style album art */}
        <div className="relative w-64 h-64 sm:w-72 sm:h-72 mb-6" data-testid="hero-album-art">
          {/* Outer vinyl ring */}
          <div
            className={`absolute -inset-3 rounded-full border-2 border-[#FF6B00]/20 ${isPlaying ? "vinyl-spin" : ""}`}
            style={{
              background: "radial-gradient(circle at center, transparent 45%, rgba(255,107,0,0.08) 60%, transparent 75%)",
              boxShadow: isPlaying ? "0 0 60px rgba(255,107,0,0.25), 0 0 120px rgba(57,255,20,0.1)" : "0 0 40px rgba(0,0,0,0.5)",
            }}
          />
          {/* Album cover */}
          <div className="absolute inset-0 rounded-2xl overflow-hidden border border-white/10" style={{ boxShadow: "0 20px 60px rgba(0,0,0,0.6)" }}>
            {nowPlaying.cover_url ? (
              <img src={nowPlaying.cover_url} alt={nowPlaying.title} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-[#12121A] flex items-center justify-center">
                <Music2 className="w-20 h-20 text-[#FF6B00]/40" />
              </div>
            )}
          </div>
          {/* Center "hole" suggestion */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-[#05050A] border border-white/20" />
        </div>

        {/* Title + artist */}
        <h2 className="font-['Outfit'] text-2xl sm:text-3xl font-black text-white text-center leading-tight" data-testid="hero-track-title">
          {nowPlaying.title}
        </h2>
        <p className="text-sm text-[#A0A0B0] mt-1 text-center" data-testid="hero-track-artist">{nowPlaying.artist}</p>
        {nowPlaying.album && (
          <p className="text-[10px] uppercase tracking-[0.2em] text-[#5C5C6B] mt-1 font-bold">{nowPlaying.album}</p>
        )}

        {/* Seek bar */}
        <div className="w-full mt-7" data-testid="hero-seek-section">
          <div
            ref={seekRef}
            onClick={onSeekClick}
            className="relative h-1.5 bg-white/8 rounded-full cursor-pointer group"
            data-testid="hero-seek-bar"
          >
            <div
              className="absolute top-0 left-0 h-full rounded-full transition-[width] duration-100 linear"
              style={{
                width: `${progress}%`,
                background: "linear-gradient(90deg, #FF6B00 0%, #39FF14 100%)",
                boxShadow: "0 0 12px rgba(255,107,0,0.5)",
              }}
            />
            <div
              className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 bg-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
              style={{ left: `${progress}%`, transform: "translate(-50%, -50%)", boxShadow: "0 0 10px rgba(255,255,255,0.6)" }}
            />
          </div>
          <div className="flex items-center justify-between mt-1.5">
            <span className="text-[10px] font-mono text-[#A0A0B0]" data-testid="hero-time-elapsed">{formatTime(elapsedSec)}</span>
            <span className="text-[10px] uppercase tracking-wider text-[#FF6B00]/70 font-bold">30s Preview</span>
            <span className="text-[10px] font-mono text-[#A0A0B0]">{formatTime(totalSec)}</span>
          </div>
        </div>

        {/* Controls row — strictly utility: play/pause + back-to-search */}
        <div className="flex items-center justify-center gap-5 mt-7" data-testid="hero-controls">
          <Button
            onClick={togglePlayPause}
            data-testid="hero-play-pause-btn"
            className="w-16 h-16 rounded-full bg-gradient-to-br from-[#FF6B00] to-[#FF8533] hover:from-[#FF8533] hover:to-[#FF6B00] text-white transition-all hover:scale-105"
            style={{ boxShadow: "0 0 32px rgba(255,107,0,0.6), 0 8px 24px rgba(0,0,0,0.4)" }}
          >
            {isPlaying
              ? <Pause className="w-7 h-7" fill="white" />
              : <Play className="w-7 h-7 ml-0.5" fill="white" />}
          </Button>

          <Button
            onClick={onTapSearch}
            data-testid="hero-search-btn"
            variant="ghost"
            className="h-11 px-5 rounded-full border border-[#39FF14]/30 text-[#39FF14] hover:bg-[#39FF14]/10 hover:border-[#39FF14] gap-2"
            title="Back to search"
          >
            <Search className="w-4 h-4" />
            <span className="text-[11px] font-black uppercase tracking-wider">Search</span>
          </Button>
        </div>

        {/* Hint */}
        <p className="text-[10px] text-[#5C5C6B] mt-5 uppercase tracking-wider text-center">
          Tap search to find another track
        </p>
      </div>
    </div>
  );
}
