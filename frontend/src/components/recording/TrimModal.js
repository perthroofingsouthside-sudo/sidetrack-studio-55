import { useMemo } from "react";
import { Scissors, X, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";

export default function TrimModal({ duration, trimStart, trimEnd, setTrimStart, setTrimEnd, trimming, onTrim, onClose, fmtDur }) {
  const bars = useMemo(() => Array.from({ length: 50 }, () => Math.random() * 80 + 20), []);
  const startSec = Math.round((trimStart / 100) * duration);
  const endSec = Math.round((trimEnd / 100) * duration);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" data-testid="trim-modal-overlay">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md mx-4 mb-4 sm:mb-0 rounded-2xl border border-white/10 bg-[#0F0F16] p-5 space-y-4 animate-slide-up" data-testid="trim-modal">
        <div className="flex items-center justify-between">
          <h3 className="font-['Outfit'] text-lg font-bold text-white flex items-center gap-2">
            <Scissors className="w-4 h-4 text-[#FF6B00]" /> Trim & Share
          </h3>
          <Button variant="ghost" size="icon" onClick={onClose} className="text-[#5C5C6B] hover:text-white w-8 h-8" data-testid="trim-modal-close">
            <X className="w-4 h-4" />
          </Button>
        </div>

        <div className="relative h-16 bg-[#05050A] rounded-xl overflow-hidden px-2">
          <div className="flex items-end h-full gap-[1px] py-2">
            {bars.map((h, i) => {
              const pct = (i / bars.length) * 100;
              const inRange = pct >= trimStart && pct <= trimEnd;
              return (
                <div key={`bar-${i}`} className={`flex-1 rounded-full transition-colors ${inRange ? "bg-[#FF6B00]" : "bg-white/10"}`} style={{ height: `${h}%` }} />
              );
            })}
          </div>
          <div className="absolute top-0 left-0 h-full bg-[#05050A]/60" style={{ width: `${trimStart}%` }} />
          <div className="absolute top-0 right-0 h-full bg-[#05050A]/60" style={{ width: `${100 - trimEnd}%` }} />
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <span className="text-xs text-[#A0A0B0] w-10">Start</span>
            <Slider data-testid="trim-modal-start" value={[trimStart]} onValueChange={([v]) => setTrimStart(Math.min(v, trimEnd - 5))} max={100} step={1} className="flex-1" />
            <span className="text-xs text-[#FF6B00] w-12 text-right font-mono">{fmtDur(startSec)}</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-[#A0A0B0] w-10">End</span>
            <Slider data-testid="trim-modal-end" value={[trimEnd]} onValueChange={([v]) => setTrimEnd(Math.max(v, trimStart + 5))} max={100} step={1} className="flex-1" />
            <span className="text-xs text-[#FF6B00] w-12 text-right font-mono">{fmtDur(endSec)}</span>
          </div>
        </div>

        <p className="text-[10px] text-[#5C5C6B] text-center">
          Selected: {fmtDur(startSec)} — {fmtDur(endSec)} ({fmtDur(endSec - startSec)} duration)
        </p>

        <div className="flex gap-3">
          <Button onClick={onClose} variant="ghost" className="flex-1 h-11 rounded-xl border border-white/10 text-[#5C5C6B]" data-testid="trim-cancel-btn">Cancel</Button>
          <Button onClick={onTrim} disabled={trimming} className="flex-1 h-11 rounded-xl bg-[#FF6B00] hover:bg-[#FF8533] text-white font-bold" style={{ boxShadow: "0 0 20px rgba(255,107,0,0.3)" }} data-testid="trim-confirm-btn">
            {trimming ? "Trimming..." : <><Share2 className="w-4 h-4 mr-1.5" /> Trim & Share</>}
          </Button>
        </div>
      </div>
    </div>
  );
}
