import { Play, Pause, Music2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function GlobalPlayer({ nowPlaying, isPlaying, progress, onTogglePlayPause, onOpenStudio }) {
  if (!nowPlaying) return null;
  return (
    <div className="fixed bottom-16 left-0 right-0 crystal-glass z-40" data-testid="global-now-playing">
      <div className="w-full h-[3px] bg-white/5">
        <div className="neon-progress" style={{ width: `${progress}%`, transition: "width 0.1s linear" }} />
      </div>
      <div className="px-4 py-2">
        <div className="flex items-center gap-3 max-w-2xl mx-auto">
          <div className="w-11 h-11 rounded-xl overflow-hidden flex-shrink-0 border border-white/10 neon-ambient-glow">
            <img src={nowPlaying.cover_url || nowPlaying.cover_thumb || ""} alt="" className="w-full h-full object-cover" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-white truncate" data-testid="global-track-title">{nowPlaying.title}</p>
            <p className="text-[10px] text-[#5C5C6B] truncate">{nowPlaying.artist}</p>
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
