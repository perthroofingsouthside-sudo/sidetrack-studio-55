import { Play, Pause, Music2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRef } from "react";

export default function GlobalPlayer({ nowPlaying, isPlaying, progress, onTogglePlayPause, onOpenStudio, onSeek }) {
  const barRef = useRef(null);

  if (!nowPlaying) return null;

  const handleSeek = (e) => {
    if (!barRef.current || !onSeek) return;
    const rect = barRef.current.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    onSeek(pct);
  };

  return (
    <div className="fixed bottom-16 left-0 right-0 crystal-glass z-40" data-testid="global-now-playing">
      {/* Interactive seek bar */}
      <div
        ref={barRef}
        className="w-full h-[6px] bg-white/5 cursor-pointer group relative"
        onClick={handleSeek}
        data-testid="global-seek-bar"
      >
        <div className="neon-progress h-full" style={{ width: `${progress}%`, transition: "width 0.1s linear" }} />
        <div
          className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-[0_0_8px_rgba(255,107,0,0.6)] opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ left: `${progress}%`, transform: `translate(-50%, -50%)` }}
        />
      </div>
      <div className="px-4 py-2">
        <div className="flex items-center gap-3 max-w-2xl mx-auto">
          <div className="w-11 h-11 rounded-xl overflow-hidden flex-shrink-0 border border-white/10 neon-ambient-glow">
            <img src={nowPlaying.cover_url || nowPlaying.cover_thumb || ""} alt="" className="w-full h-full object-cover" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-white truncate" data-testid="global-track-title">{nowPlaying.title}</p>
            <p className="text-[10px] text-[#5C5C6B] truncate">{nowPlaying.artist}
              <span className="ml-1.5 text-[#FF6B00]/60 uppercase tracking-wider text-[8px] font-bold">30s Preview</span>
            </p>
          </div>
          <Button data-testid="global-play-pause" variant="ghost" size="icon" onClick={onTogglePlayPause}
            className="text-white hover:text-[#39FF14] rounded-full transition-colors">
            {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" fill="white" />}
          </Button>
          <Button data-testid="global-studio-btn" variant="ghost" size="icon" onClick={() => onOpenStudio(nowPlaying)}
            className="text-[#FF6B00] hover:text-[#39FF14] rounded-full transition-colors" title="Open in Studio">
            <Music2 className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
